/**
 * Simple Image Upload for Web
 * 
 * Browser-based image upload to Supabase Storage
 * No complex RLS, just works
 */

import { createClient } from '@/lib/supabase/client';

const BUCKET_NAME = 'dash-attachments'; // switched from chat-images after RLS conflicts
// Allow up to 50MB initial file size - we'll compress aggressively
const MAX_UPLOAD_MB = 50;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
// Target size after compression (3MB max for efficient upload/AI processing)
const TARGET_SIZE_MB = 3;
const TARGET_SIZE_BYTES = TARGET_SIZE_MB * 1024 * 1024;

export interface WebImageUpload {
  url: string;
  path: string;
  base64?: string;
}

/**
 * Compress image using Canvas API with smart quality adjustment
 */
async function compressImage(file: File, maxWidth: number = 1920, quality: number = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      // Scale down if image is too large
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      
      // Draw with high quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to blob with compression
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log('[WebImageUpload] Compressed:', 
              `${(file.size / 1024 / 1024).toFixed(2)}MB → ${(blob.size / 1024 / 1024).toFixed(2)}MB`,
              `(${Math.round((1 - blob.size / file.size) * 100)}% reduction)`
            );
            resolve(blob);
          } else {
            reject(new Error('Canvas compression failed'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Aggressively compress image to target size
 */
async function smartCompress(file: File): Promise<Blob> {
  // Check if file is too large to even try
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_UPLOAD_MB}MB.`);
  }

  // If already small enough, just optimize dimensions
  if (file.size <= TARGET_SIZE_BYTES) {
    return await compressImage(file, 1920, 0.85);
  }

  // Large file (common from phone cameras) - compress aggressively
  console.log('[WebImageUpload] Large image detected, applying smart compression...');
  
  // Try progressive compression
  let quality = 0.8;
  let maxWidth = 1920;
  
  // For very large files, start more aggressive
  if (file.size > 10 * 1024 * 1024) {
    quality = 0.7;
    maxWidth = 1600;
  }
  if (file.size > 20 * 1024 * 1024) {
    quality = 0.6;
    maxWidth = 1400;
  }
  
  let compressed = await compressImage(file, maxWidth, quality);
  
  // If still too large, try one more aggressive pass
  if (compressed.size > TARGET_SIZE_BYTES && quality > 0.5) {
    console.log('[WebImageUpload] Still large, applying second pass...');
    const tempFile = new File([compressed], 'temp.jpg', { type: 'image/jpeg' });
    compressed = await compressImage(tempFile, 1200, 0.65);
  }
  
  return compressed;
}

/**
 * Convert file/blob to base64
 */
async function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data:image/...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload image to Supabase Storage
 * @param file - Browser File object
 * @param includeBase64 - Whether to return base64 for AI APIs
 * @returns Public URL and optionally base64
 */
export async function uploadImage(
  file: File,
  includeBase64: boolean = false
): Promise<WebImageUpload> {
  console.log('[WebImageUpload] Starting upload:', file.name, `${(file.size / 1024 / 1024).toFixed(2)}MB`);
  
  try {
    const supabase = createClient();
    
    // Always compress images for optimal size and quality
    const blob = await smartCompress(file);
    
    console.log('[WebImageUpload] Final size:', `${(blob.size / 1024 / 1024).toFixed(2)}MB`);
    
    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const fileName = `${timestamp}_${random}.jpg`;
    
    console.log('[WebImageUpload] Uploading to storage...');
    
    // Upload (no path prefix, just filename in root)
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });
    
    if (error) {
      console.error('[WebImageUpload] Upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
    
    // Get public URL (bucket is public, so this works immediately)
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);
    
    console.log('[WebImageUpload] Success! URL:', publicUrl);
    
    // Get base64 if requested
    let base64: string | undefined;
    if (includeBase64) {
      console.log('[WebImageUpload] Converting to base64...');
      base64 = await toBase64(blob);
    }
    
    return {
      url: publicUrl,
      path: fileName,
      base64,
    };
    
  } catch (error: any) {
    console.error('[WebImageUpload] Failed:', error);
    
    // Provide user-friendly error messages
    if (error.message?.includes('too large')) {
      throw new Error(error.message);
    } else if (error.message?.includes('Failed to load')) {
      throw new Error('Could not process image. Please try a different photo.');
    } else if (error.message?.includes('Upload failed')) {
      throw new Error('Upload to server failed. Please check your connection and try again.');
    } else {
      throw new Error('Image upload failed. Please try again.');
    }
  }
}

/**
 * Upload multiple images
 */
export async function uploadMultipleImages(
  files: File[],
  includeBase64: boolean = false
): Promise<WebImageUpload[]> {
  console.log('[WebImageUpload] Uploading', files.length, 'images...');
  
  const results = await Promise.all(
    files.map(file => uploadImage(file, includeBase64))
  );
  
  console.log('[WebImageUpload] All uploads complete!');
  return results;
}

/**
 * Delete image from storage
 */
export async function deleteImage(path: string): Promise<void> {
  try {
    const supabase = createClient();
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);
    
    if (error) {
      throw error;
    }
    
    console.log('[WebImageUpload] Deleted:', path);
  } catch (error) {
    console.error('[WebImageUpload] Delete failed:', error);
    throw error;
  }
}
