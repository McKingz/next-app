/**
 * Dash Image Attachment Utilities
 * 
 * Handles image upload, compression, and processing for Dash AI vision features
 */

import { assertSupabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { DashAttachment } from '@/services/dash-ai/types';

const BUCKET_NAME = 'dash-attachments';
// Increase mobile/native attachments default to 4MB to allow slightly larger uploads
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB
const THUMBNAIL_SIZE = 200; // 200px thumbnail

export interface ImageUploadResult {
  attachment: DashAttachment;
  publicUrl: string;
  base64?: string; // For AI API calls
}

/**
 * Compress image to meet size requirements
 */
export async function compressImage(
  imageUri: string,
  maxSizeBytes: number = MAX_IMAGE_SIZE
): Promise<string> {
  try {
    // Get original image info
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) {
      throw new Error('Image file not found');
    }

    // If already small enough, return original
    if (fileInfo.size && fileInfo.size <= maxSizeBytes) {
      return imageUri;
    }

    // Calculate compression quality based on size
    const sizeRatio = maxSizeBytes / (fileInfo.size || maxSizeBytes);
    const quality = Math.min(0.9, Math.max(0.3, sizeRatio));

    // Compress image
    const compressed = await manipulateAsync(
      imageUri,
      [{ resize: { width: 1920 } }], // Max width 1920px
      {
        compress: quality,
        format: SaveFormat.JPEG,
      }
    );

    return compressed.uri;
  } catch (error) {
    console.error('[Attachments] Image compression failed:', error);
    return imageUri; // Return original on error
  }
}

/**
 * Generate thumbnail for image
 */
export async function generateThumbnail(
  imageUri: string,
  size: number = THUMBNAIL_SIZE
): Promise<string> {
  try {
    const thumbnail = await manipulateAsync(
      imageUri,
      [{ resize: { width: size } }],
      {
        compress: 0.7,
        format: SaveFormat.JPEG,
      }
    );
    return thumbnail.uri;
  } catch (error) {
    console.error('[Attachments] Thumbnail generation failed:', error);
    return imageUri; // Return original on error
  }
}

/**
 * Convert image to base64 for AI API calls
 */
export async function imageToBase64(imageUri: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    console.error('[Attachments] Base64 conversion failed:', error);
    throw error;
  }
}

/**
 * Detect MIME type from file URI
 */
export function detectMimeType(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

/**
 * Upload image to Supabase Storage
 */
export async function uploadImage(
  imageUri: string,
  options: {
    generateThumbnail?: boolean;
    convertToBase64?: boolean;
  } = {}
): Promise<ImageUploadResult> {
  try {
    const supabase = assertSupabase();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    // Compress image
    const compressedUri = await compressImage(imageUri);
    
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(compressedUri);
    if (!fileInfo.exists) {
      throw new Error('Compressed image not found');
    }

    // Detect MIME type
    const mimeType = detectMimeType(compressedUri);
    
    // Generate unique filename
    const timestamp = Date.now();
    const extension = mimeType.split('/')[1];
    const fileName = `${timestamp}.${extension}`;
    const filePath = `${user.id}/${fileName}`;

    // Read file as blob
    const fileData = await fetch(compressedUri);
    const blob = await fileData.blob();

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, blob, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    // Generate thumbnail if requested
    let thumbnailUri: string | undefined;
    if (options.generateThumbnail) {
      thumbnailUri = await generateThumbnail(compressedUri);
    }

    // Convert to base64 if requested (for AI API)
    let base64: string | undefined;
    if (options.convertToBase64) {
      base64 = await imageToBase64(compressedUri);
    }

    // Create attachment object
    const attachment: DashAttachment = {
      id: `att_${timestamp}`,
      name: fileName,
      mimeType,
      size: fileInfo.size || 0,
      bucket: BUCKET_NAME,
      storagePath: filePath,
      kind: 'image',
      status: 'uploaded',
      previewUri: thumbnailUri,
      meta: {
        uploadedAt: timestamp,
        compressed: compressedUri !== imageUri,
      },
    };

    return {
      attachment,
      publicUrl,
      base64,
    };
  } catch (error) {
    console.error('[Attachments] Image upload failed:', error);
    throw error;
  }
}

/**
 * Delete image from storage
 */
export async function deleteImage(storagePath: string): Promise<void> {
  try {
    const supabase = assertSupabase();
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('[Attachments] Image deletion failed:', error);
    throw error;
  }
}

/**
 * Get signed URL for private image access
 */
export async function getSignedUrl(
  storagePath: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  try {
    const supabase = assertSupabase();
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, expiresIn);

    if (error || !data) {
      throw error || new Error('Failed to generate signed URL');
    }

    return data.signedUrl;
  } catch (error) {
    console.error('[Attachments] Signed URL generation failed:', error);
    throw error;
  }
}

/**
 * Batch upload multiple images
 */
export async function uploadMultipleImages(
  imageUris: string[],
  options: {
    generateThumbnails?: boolean;
    convertToBase64?: boolean;
  } = {}
): Promise<ImageUploadResult[]> {
  const uploads = imageUris.map(uri => uploadImage(uri, options));
  return Promise.all(uploads);
}
