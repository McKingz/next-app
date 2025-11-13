/**
 * Simple Image Upload Utility
 * 
 * Dead simple image uploads to Supabase Storage
 * No complex RLS, no auth checks, just works
 */

import { assertSupabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const BUCKET_NAME = 'dash-attachments'; // switched from chat-images after RLS conflicts
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export interface SimpleImageUpload {
  url: string;
  path: string;
  base64?: string;
}

/**
 * Compress image if needed
 */
async function compressIfNeeded(uri: string): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    
    // If small enough, return as-is
    if (!info.exists || (info.size && info.size < MAX_SIZE_BYTES)) {
      return uri;
    }

    // Compress
    console.log('[ImageUpload] Compressing image...');
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.7, format: SaveFormat.JPEG }
    );
    
    return result.uri;
  } catch (error) {
    console.warn('[ImageUpload] Compression failed, using original:', error);
    return uri;
  }
}

/**
 * Convert image to base64 for AI
 */
async function toBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/**
 * Upload image to Supabase Storage
 * @param imageUri - Local file URI
 * @param includeBase64 - Whether to return base64 for AI APIs
 * @returns Public URL and optionally base64
 */
export async function uploadImage(
  imageUri: string,
  includeBase64: boolean = false
): Promise<SimpleImageUpload> {
  console.log('[ImageUpload] Starting upload:', imageUri);
  
  try {
    const supabase = assertSupabase();
    
    // Compress if needed
    const finalUri = await compressIfNeeded(imageUri);
    
    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const fileName = `${timestamp}_${random}.jpg`;
    
    // Read file
    const fileData = await fetch(finalUri);
    const blob = await fileData.blob();
    
    console.log('[ImageUpload] Uploading to storage...');
    
    // Upload (no path prefix, just filename in root)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });
    
    if (error) {
      console.error('[ImageUpload] Upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
    
    // Get public URL (bucket is public, so this works immediately)
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);
    
    console.log('[ImageUpload] Success! URL:', publicUrl);
    
    // Get base64 if requested
    let base64: string | undefined;
    if (includeBase64) {
      console.log('[ImageUpload] Converting to base64...');
      base64 = await toBase64(finalUri);
    }
    
    return {
      url: publicUrl,
      path: fileName,
      base64,
    };
    
  } catch (error) {
    console.error('[ImageUpload] Failed:', error);
    throw error;
  }
}

/**
 * Upload multiple images
 */
export async function uploadMultipleImages(
  imageUris: string[],
  includeBase64: boolean = false
): Promise<SimpleImageUpload[]> {
  console.log('[ImageUpload] Uploading', imageUris.length, 'images...');
  
  const results = await Promise.all(
    imageUris.map(uri => uploadImage(uri, includeBase64))
  );
  
  console.log('[ImageUpload] All uploads complete!');
  return results;
}

/**
 * Delete image from storage
 */
export async function deleteImage(path: string): Promise<void> {
  try {
    const supabase = assertSupabase();
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);
    
    if (error) {
      throw error;
    }
    
    console.log('[ImageUpload] Deleted:', path);
  } catch (error) {
    console.error('[ImageUpload] Delete failed:', error);
    throw error;
  }
}
