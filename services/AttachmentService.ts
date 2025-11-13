/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Attachment Service
 * 
 * Handles file picking, upload, and basic management for Dash AI attachments.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Platform, Alert } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { DashAttachment, DashAttachmentKind } from '@/services/dash-ai/types';
import { base64ToUint8Array } from '@/lib/utils/base64';

// File size limits (in bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

// Supported file types
const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
];

const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
];

const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
];

/**
 * Pick documents using expo-document-picker
 */
export async function pickDocuments(): Promise<DashAttachment[]> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: SUPPORTED_DOCUMENT_TYPES,
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return [];
    }

    const attachments: DashAttachment[] = [];

    for (const asset of result.assets) {
      // Validate file size
      if (asset.size && asset.size > MAX_FILE_SIZE) {
        Alert.alert(
          'File Too Large',
          `${asset.name} is too large. Maximum file size is ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB.`
        );
        continue;
      }

      // Validate file type
      if (asset.mimeType && !SUPPORTED_DOCUMENT_TYPES.includes(asset.mimeType)) {
        Alert.alert(
          'Unsupported File Type',
          `${asset.name} is not a supported file type.`
        );
        continue;
      }

      const attachment: DashAttachment = {
        id: `attach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
        size: asset.size || 0,
        bucket: 'attachments',
        storagePath: '', // Will be set during upload
        kind: determineAttachmentKind(asset.mimeType || ''),
        status: 'pending',
        previewUri: asset.uri,
        uploadProgress: 0,
      };

      attachments.push(attachment);
    }

    return attachments;
  } catch (error) {
    console.error('Failed to pick documents:', error);
    throw new Error('Failed to select documents. Please try again.');
  }
}

/**
 * Take a photo using the camera
 */
export async function takePhoto(): Promise<DashAttachment[]> {
  try {
    // Check permission first
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.status !== 'granted') {
      // Determine if permission was denied or needs more action
      if (permissionResult.canAskAgain === false) {
        Alert.alert(
          'Camera Permission Denied',
          'Camera access has been permanently denied. Please enable it in your device settings to take photos.',
          [
            { text: 'OK', style: 'default' },
            ...(Platform.OS === 'ios' 
              ? [{ text: 'Open Settings', onPress: () => {
                  // iOS: Link to Settings unavailable in Expo without expo-linking
                  console.log('[Camera] User needs to open Settings manually');
                }}]
              : []
            )
          ]
        );
      } else {
        Alert.alert(
          'Camera Permission Required',
          'EduDash Pro needs camera access to take photos. Please grant permission when prompted.',
          [{ text: 'OK', style: 'default' }]
        );
      }
      return [];
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    // Handle cancellation gracefully
    if (result.canceled || !result.assets || result.assets.length === 0) {
      if (__DEV__) console.log('[Camera] User cancelled or no photo taken');
      return [];
    }

    const attachments: DashAttachment[] = [];

    for (const asset of result.assets) {
      // Get file info to check size
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      
      if (fileInfo.exists && fileInfo.size && fileInfo.size > MAX_IMAGE_SIZE) {
        Alert.alert(
          'Image Too Large',
          `Photo is too large. Maximum image size is ${Math.round(MAX_IMAGE_SIZE / (1024 * 1024))}MB.`
        );
        continue;
      }

      const attachment: DashAttachment = {
        id: `attach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `photo_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        size: fileInfo.exists ? (fileInfo.size || 0) : 0,
        bucket: 'attachments',
        storagePath: '', // Will be set during upload
        kind: 'image',
        status: 'pending',
        previewUri: asset.uri,
        uploadProgress: 0,
        meta: {
          width: asset.width,
          height: asset.height,
        },
      };

      attachments.push(attachment);
    }

    return attachments;
  } catch (error) {
    console.error('Failed to take photo:', error);
    throw new Error('Failed to take photo. Please try again.');
  }
}

/**
 * Pick images using expo-image-picker
 */
export async function pickImages(): Promise<DashAttachment[]> {
  try {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need access to your photo library to upload images.'
      );
      return [];
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled) {
      return [];
    }

    const attachments: DashAttachment[] = [];

    for (const asset of result.assets) {
      // Get file info to check size
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      
      if (fileInfo.exists && fileInfo.size && fileInfo.size > MAX_IMAGE_SIZE) {
        Alert.alert(
          'Image Too Large',
          `One of the selected images is too large. Maximum image size is ${Math.round(MAX_IMAGE_SIZE / (1024 * 1024))}MB.`
        );
        continue;
      }

      const attachment: DashAttachment = {
        id: `attach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        mimeType: 'image/jpeg', // Default for images
        size: fileInfo.exists ? (fileInfo.size || 0) : 0,
        bucket: 'attachments',
        storagePath: '', // Will be set during upload
        kind: 'image',
        status: 'pending',
        previewUri: asset.uri,
        uploadProgress: 0,
        meta: {
          width: asset.width,
          height: asset.height,
        },
      };

      attachments.push(attachment);
    }

    return attachments;
  } catch (error) {
    console.error('Failed to pick images:', error);
    throw new Error('Failed to select images. Please try again.');
  }
}

/**
 * Compute SHA256 checksum of a file
 */
export async function computeChecksum(uri: string): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      // For web, we'll use a simpler approach
      return `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uri,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    
    return hash;
  } catch (error) {
    console.error('Failed to compute checksum:', error);
    // Return a fallback unique identifier
    return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Upload attachment to Supabase Storage
 */
export async function uploadAttachment(
  attachment: DashAttachment,
  conversationId: string,
  onProgress?: (progress: number) => void
): Promise<DashAttachment> {
  try {
    const supabase = assertSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Generate storage path
    const timestamp = Date.now();
    const fileName = `${timestamp}_${attachment.name}`;
    const storagePath = `${user.id}/${conversationId}/${fileName}`;
    
    // Update attachment with storage path
    const updatedAttachment: DashAttachment = {
      ...attachment,
      storagePath,
      status: 'uploading',
    };

    // Read file content
    let fileData: any;
    
    if (Platform.OS === 'web') {
      // For web, use fetch to get blob
      const response = await fetch(attachment.previewUri || '');
      fileData = await response.blob();
    } else {
      // For mobile, read as base64 and convert to Uint8Array
      const base64Data = await FileSystem.readAsStringAsync(
        attachment.previewUri || '',
        { encoding: FileSystem.EncodingType.Base64 }
      );
      
      const uint8Array = base64ToUint8Array(base64Data);
      fileData = uint8Array;
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(storagePath, fileData, {
        contentType: attachment.mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Update status
    updatedAttachment.status = 'uploaded';
    updatedAttachment.uploadProgress = 100;
    
    if (onProgress) {
      onProgress(100);
    }

    return updatedAttachment;
  } catch (error) {
    console.error('Failed to upload attachment:', error);
    
    const failedAttachment: DashAttachment = {
      ...attachment,
      status: 'failed',
      uploadProgress: 0,
    };
    
    throw error;
  }
}

/**
 * Create signed URL for attachment access
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  ttlSeconds: number = 3600
): Promise<string> {
  try {
    const supabase = assertSupabase();
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, ttlSeconds);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Failed to create signed URL:', error);
    throw error;
  }
}

/**
 * Enqueue file for ingestion processing
 */
export async function enqueueIngestion(payload: {
  user_id: string;
  conversation_id: string;
  bucket: string;
  storage_path: string;
  name: string;
  mime_type: string;
  size: number;
}): Promise<{ document_id: string }> {
  try {
    const supabase = assertSupabase();
    
    const { data, error } = await supabase.functions.invoke('ingest-file', {
      body: payload,
    });

    if (error) {
      throw new Error(`Ingestion failed: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Failed to enqueue ingestion:', error);
    throw error;
  }
}

/**
 * Determine attachment kind from MIME type
 */
function determineAttachmentKind(mimeType: string): DashAttachmentKind {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return 'spreadsheet';
  }
  
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return 'presentation';
  }
  
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  
  if (
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType.startsWith('text/')
  ) {
    return 'document';
  }
  
  return 'other';
}

/**
 * Get file icon name based on attachment kind
 */
export function getFileIconName(kind: DashAttachmentKind): any {
  switch (kind) {
    case 'image':
      return 'image-outline';
    case 'pdf':
      return 'document-text-outline';
    case 'document':
      return 'document-outline';
    case 'spreadsheet':
      return 'grid-outline';
    case 'presentation':
      return 'easel-outline';
    case 'audio':
      return 'musical-notes-outline';
    default:
      return 'attach-outline';
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}