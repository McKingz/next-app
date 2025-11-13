'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, X, Image as ImageIcon } from 'lucide-react';
import { uploadMultipleImages } from '@/lib/simple-image-upload';

interface ImageUploadProps {
  onSelect: (images: Array<{ data: string; media_type: string; preview: string; url?: string }>) => void;
  onClose: () => void;
  maxImages?: number;
}

export function ImageUpload({ onSelect, onClose, maxImages = 3 }: ImageUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    setError(null);
    const fileArray = Array.from(files).slice(0, maxImages);
    const newPreviews: string[] = [];
    
    // Check for oversized files
    const oversizedFiles = fileArray.filter(f => f.size > 50 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      const sizeMB = (oversizedFiles[0].size / 1024 / 1024).toFixed(1);
      setError(`Image too large (${sizeMB}MB). Please use photos under 50MB.`);
      return;
    }

    for (const file of fileArray) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            newPreviews.push(e.target.result as string);
            if (newPreviews.length === fileArray.length) {
              setPreviews(newPreviews);
              setSelectedFiles(fileArray);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleConfirm = async () => {
    setUploading(true);
    setCompressing(true);
    setError(null);
    
    try {
      console.log('[ImageUpload] Processing', selectedFiles.length, 'images...');
      
      // Show compression message for large files
      const hasLargeFiles = selectedFiles.some(f => f.size > 5 * 1024 * 1024);
      if (hasLargeFiles) {
        console.log('[ImageUpload] Large files detected, compression may take a moment...');
      }
      
      // Upload to storage and get base64
      const uploadResults = await uploadMultipleImages(selectedFiles, true);
      
      setCompressing(false);
      console.log('[ImageUpload] Upload complete, processing results...');
      
      // Convert to format expected by chat
      const processedImages = uploadResults.map((result, index) => ({
        data: result.base64!,
        media_type: 'image/jpeg' as const,
        preview: previews[index],
        url: result.url, // Include the storage URL
      }));

      onSelect(processedImages);
    } catch (err: any) {
      console.error('[ImageUpload] Upload failed:', err);
      setError(err?.message || 'Upload failed. Please try again.');
      setUploading(false);
      setCompressing(false);
    }
  };

  const removeImage = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 0,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface-0)',
          borderRadius: '24px 24px 0 0',
          padding: '24px 20px 32px',
          maxWidth: 600,
          width: '100%',
          maxHeight: '85vh',
          overflow: 'auto',
          border: '1px solid var(--border)',
          boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ImageIcon size={18} color="white" />
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              Add Images
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              padding: 8,
              borderRadius: '50%',
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Upload Options */}
        {selectedFiles.length === 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              style={{ display: 'none' }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFileSelect(e.target.files)}
              style={{ display: 'none' }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn"
              style={{
                flex: 1,
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                background: 'var(--surface-1)',
                border: '2px solid var(--border)',
                borderRadius: 16,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.background = 'var(--surface-2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--surface-1)';
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(236, 72, 153, 0.1))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Upload size={24} color="var(--primary)" />
              </div>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Gallery</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Choose from photos</span>
            </button>

            <button
              onClick={() => cameraInputRef.current?.click()}
              className="btn"
              style={{
                flex: 1,
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                background: 'var(--surface-1)',
                border: '2px solid var(--border)',
                borderRadius: 16,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.background = 'var(--surface-2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--surface-1)';
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(236, 72, 153, 0.1))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Camera size={24} color="var(--primary)" />
              </div>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Camera</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Take a photo</span>
            </button>
          </div>
        )}

        {/* Preview Grid */}
        {previews.length > 0 && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: 10,
                marginBottom: 16,
              }}
            >
              {previews.map((preview, index) => (
                <div
                  key={index}
                  style={{
                    position: 'relative',
                    paddingTop: '100%',
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '2px solid var(--primary)',
                    boxShadow: '0 2px 8px rgba(124, 58, 237, 0.2)',
                  }}
                >
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <button
                    onClick={() => removeImage(index)}
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.8)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                  >
                    <X size={14} color="white" />
                  </button>
                </div>
              ))}
            </div>

            {/* Info / Error */}
            {error ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 12,
                  marginBottom: 16,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#ef4444',
                  }}
                />
                <p style={{ fontSize: 13, color: '#ef4444', margin: 0, fontWeight: 500 }}>
                  {error}
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(236, 72, 153, 0.05))',
                  borderRadius: 12,
                  marginBottom: 16,
                  border: '1px solid rgba(124, 58, 237, 0.1)',
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                  }}
                />
                <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, fontWeight: 500 }}>
                  {selectedFiles.length} of {maxImages} images selected
                  {selectedFiles.some(f => f.size > 5 * 1024 * 1024) && 
                    ' • Large photos will be compressed'}
                </p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  setSelectedFiles([]);
                  setPreviews([]);
                  setError(null);
                }}
                className="btn"
                disabled={uploading}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.5 : 1,
                }}
              >
                Clear
              </button>
              <button
                onClick={handleConfirm}
                disabled={uploading}
                className="btn btnPrimary"
                style={{
                  flex: 2,
                  padding: '12px 20px',
                  background: uploading 
                    ? 'var(--surface-2)' 
                    : 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                  color: uploading ? 'var(--text)' : 'white',
                  border: 'none',
                  fontWeight: 600,
                  borderRadius: 12,
                  fontSize: 15,
                  boxShadow: uploading ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.3)',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {uploading ? (
                  <>
                    <div 
                      style={{
                        width: 16,
                        height: 16,
                        border: '2px solid rgba(124, 58, 237, 0.3)',
                        borderTopColor: 'var(--primary)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    {compressing ? 'Compressing...' : 'Uploading...'}
                  </>
                ) : (
                  'Add to Message'
                )}
              </button>
            </div>
          </>
        )}

        {/* Help Text */}
        <div
          style={{
            marginTop: 20,
            padding: '12px 16px',
            background: 'var(--surface-1)',
            borderRadius: 12,
            borderLeft: '3px solid var(--primary)',
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            💡 <strong>Dash can analyze images</strong> to help with diagrams, math problems, homework, and more!
          </p>
        </div>
      </div>
      
      {/* Spinner animation */}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
