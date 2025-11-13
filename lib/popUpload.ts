/**
 * POP Upload Utilities
 * Handles both Proof of Payment and Picture of Progress uploads
 * with Supabase Storage integration, file validation, and compression
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

// Upload types
export type POPUploadType = 'proof_of_payment' | 'picture_of_progress';

// File validation constants
export const FILE_VALIDATION = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  maxSizeBytesCompressed: 10 * 1024 * 1024, // 10MB for compressed images
  allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  allowedDocumentTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
  maxImageDimension: 2048, // Max width/height for images
  compressionQuality: 0.8,
};

// Storage buckets
export const STORAGE_BUCKETS = {
  proof_of_payment: 'proof-of-payment',
  picture_of_progress: 'picture-of-progress',
} as const;

// File validation result
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  fileSize?: number;
  fileType?: string;
}

// Upload result
export interface UploadResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  error?: string;
}

// Compressed file result
export interface CompressionResult {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
}

/**
 * Validate file for POP upload
 */
export const validatePOPFile = async (
  fileUri: string,
  uploadType: POPUploadType
): Promise<FileValidationResult> => {
  try {
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    
    if (!fileInfo.exists) {
      return {
        isValid: false,
        errors: ['File does not exist'],
      };
    }
    
    const fileSize = fileInfo.size || 0;
    
    // Get MIME type from file extension or metadata
    let fileType = '';
    const extension = fileUri.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        fileType = 'image/jpeg';
        break;
      case 'png':
        fileType = 'image/png';
        break;
      case 'webp':
        fileType = 'image/webp';
        break;
      case 'pdf':
        fileType = 'application/pdf';
        break;
      default:
        fileType = 'unknown';
    }
    
    const errors: string[] = [];
    
    // Check file size
    if (fileSize > FILE_VALIDATION.maxSizeBytes) {
      errors.push(`File size must be less than ${FILE_VALIDATION.maxSizeBytes / (1024 * 1024)}MB`);
    }
    
    // Check file type based on upload type
    const allowedTypes = uploadType === 'proof_of_payment' 
      ? FILE_VALIDATION.allowedDocumentTypes 
      : FILE_VALIDATION.allowedImageTypes;
    
    if (!allowedTypes.includes(fileType)) {
      if (uploadType === 'proof_of_payment') {
        errors.push('Only PDF and image files (JPG, PNG) are allowed for payment receipts');
      } else {
        errors.push('Only image files (JPG, PNG, WebP) are allowed for progress pictures');
      }
    }
    
    // Additional validation for images
    if (FILE_VALIDATION.allowedImageTypes.includes(fileType)) {
      try {
        // Try to get image info to validate it's a real image
        const imageInfo = await ImageManipulator.manipulateAsync(
          fileUri,
          [],
          { base64: false }
        );
        
        if (!imageInfo.uri) {
          errors.push('Invalid image file');
        }
      } catch (error) {
        errors.push('Invalid or corrupted image file');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      fileSize,
      fileType,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: ['Failed to validate file'],
    };
  }
};

/**
 * Compress image if needed
 */
export const compressImageIfNeeded = async (
  fileUri: string,
  fileSize: number
): Promise<CompressionResult | null> => {
  try {
    // Only compress if file is too large or dimensions might be too big
    if (fileSize <= FILE_VALIDATION.maxSizeBytesCompressed) {
      return null; // No compression needed
    }
    
    // Compress the image
    const compressedImage = await ImageManipulator.manipulateAsync(
      fileUri,
      [
        {
          resize: {
            width: FILE_VALIDATION.maxImageDimension,
            height: FILE_VALIDATION.maxImageDimension,
          },
        },
      ],
      {
        compress: FILE_VALIDATION.compressionQuality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    );
    
    // Get compressed file info
    const compressedFileInfo = await FileSystem.getInfoAsync(compressedImage.uri);
    const size = (compressedFileInfo && 'size' in compressedFileInfo) ? (compressedFileInfo as any).size || 0 : 0;
    
    return {
      uri: compressedImage.uri,
      width: compressedImage.width,
      height: compressedImage.height,
      fileSize: size,
    };
  } catch (error) {
    console.error('Image compression failed:', error);
    return null;
  }
};

/**
 * Generate unique file path for storage
 */
export const generateStorageFilePath = (
  uploadType: POPUploadType,
  userId: string,
  studentId: string,
  originalFileName: string
): string => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension = originalFileName.split('.').pop()?.toLowerCase() || 'jpg';
  
  // Create hierarchical path: userId/studentId/timestamp_random.ext
  return `${userId}/${studentId}/${timestamp}_${randomSuffix}.${extension}`;
};

/**
 * Upload file to Supabase Storage
 */
export const uploadPOPFile = async (
  fileUri: string,
  uploadType: POPUploadType,
  userId: string,
  studentId: string,
  originalFileName: string
): Promise<UploadResult> => {
  try {
    console.log('Starting POP file upload:', { uploadType, fileUri, originalFileName });
    
    // Validate file
    const validation = await validatePOPFile(fileUri, uploadType);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', '),
      };
    }
    
    let uploadUri = fileUri;
    let finalFileSize = validation.fileSize || 0;
    let finalFileType = validation.fileType || 'unknown';
    
    // Compress image if it's an image and too large
    if (FILE_VALIDATION.allowedImageTypes.includes(finalFileType)) {
      const compressed = await compressImageIfNeeded(fileUri, finalFileSize);
      if (compressed) {
        uploadUri = compressed.uri;
        finalFileSize = compressed.fileSize;
        finalFileType = 'image/jpeg'; // Compressed to JPEG
        console.log('Image compressed:', { originalSize: validation.fileSize, newSize: finalFileSize });
      }
    }
    
    // Generate storage path
    const storagePath = generateStorageFilePath(uploadType, userId, studentId, originalFileName);
    const bucket = STORAGE_BUCKETS[uploadType];
    
    // Read file as base64 for upload
    const base64 = await FileSystem.readAsStringAsync(uploadUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Convert base64 to blob
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: finalFileType });
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, blob, {
        contentType: finalFileType,
        upsert: false,
      });
    
    if (error) {
      console.error('Supabase storage upload error:', error);
      return {
        success: false,
        error: `Upload failed: ${error.message}`,
      };
    }
    
    console.log('POP file uploaded successfully:', data?.path);
    
    return {
      success: true,
      filePath: data?.path || storagePath,
      fileName: originalFileName,
      fileSize: finalFileSize,
      fileType: finalFileType,
    };
  } catch (error) {
    console.error('POP upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    };
  }
};

/**
 * Get signed URL for viewing uploaded file
 */
export const getPOPFileUrl = async (
  uploadType: POPUploadType,
  filePath: string,
  expiresIn = 3600 // 1 hour
): Promise<string | null> => {
  try {
    const bucket = STORAGE_BUCKETS[uploadType];
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      console.error('Failed to create signed URL:', error);
      return null;
    }
    
    return data?.signedUrl || null;
  } catch (error) {
    console.error('Error getting POP file URL:', error);
    return null;
  }
};

/**
 * Delete POP file from storage
 */
export const deletePOPFile = async (
  uploadType: POPUploadType,
  filePath: string
): Promise<boolean> => {
  try {
    const bucket = STORAGE_BUCKETS[uploadType];
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);
    
    if (error) {
      console.error('Failed to delete POP file:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting POP file:', error);
    return false;
  }
};

/**
 * Get file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Get file type icon name for display
 */
export const getFileTypeIcon = (fileType: string): string => {
  if (fileType.startsWith('image/')) {
    return 'image';
  } else if (fileType === 'application/pdf') {
    return 'document-text';
  } else {
    return 'document';
  }
};