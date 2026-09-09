import { uploadFileToSupabaseStorage, isSupabaseConfigured, getSupabaseClient } from './supabase';

/**
 * Optimizes an avatar image file (or Blob) to a lightweight, crisp square avatar.
 * Auto-crops to center square, resizes to maxDimension x maxDimension (default 320px),
 * and compresses as WebP (or JPEG fallback).
 *
 * Resulting size is typically 15KB - 30KB, which:
 * 1. Easily fits inside browser localStorage (no QuotaExceededError).
 * 2. Easily fits inside Supabase Realtime broadcast WebSocket message (limit 256KB).
 * 3. Delivers crisp, retina-ready quality on all devices.
 */
export async function optimizeAvatarImage(
  file: File | Blob,
  maxDimension = 320,
  quality = 0.85
): Promise<{ dataUrl: string; blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image element.'));
      img.onload = () => {
        try {
          const originalWidth = img.naturalWidth || img.width;
          const originalHeight = img.naturalHeight || img.height;

          // Determine square crop dimensions (center crop)
          const minSide = Math.min(originalWidth, originalHeight);
          const cropX = (originalWidth - minSide) / 2;
          const cropY = (originalHeight - minSide) / 2;

          // Target output dimensions
          const targetSize = Math.min(maxDimension, minSide);

          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas 2D context not available.');
          }

          // Crisp rendering settings
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw cropped center square into canvas
          ctx.drawImage(
            img,
            cropX,
            cropY,
            minSide,
            minSide,
            0,
            0,
            targetSize,
            targetSize
          );

          // Try WebP first for optimal compression; fallback to JPEG
          let dataUrl = '';
          try {
            dataUrl = canvas.toDataURL('image/webp', quality);
            if (!dataUrl.startsWith('data:image/webp')) {
              dataUrl = canvas.toDataURL('image/jpeg', quality);
            }
          } catch {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          // Convert canvas to Blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({
                  dataUrl,
                  blob,
                  width: targetSize,
                  height: targetSize,
                });
              } else {
                // Fallback blob creation from dataUrl
                const arr = dataUrl.split(',');
                const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                  u8arr[n] = bstr.charCodeAt(n);
                }
                const fallbackBlob = new Blob([u8arr], { type: mime });
                resolve({
                  dataUrl,
                  blob: fallbackBlob,
                  width: targetSize,
                  height: targetSize,
                });
              }
            },
            dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg',
            quality
          );
        } catch (err) {
          reject(err);
        }
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Upload an avatar photo with automatic client-side optimization and cloud storage fallback.
 * 1. Centers, resizes to 320x320 and compresses image to ~20KB.
 * 2. If Supabase is connected, uploads to Supabase Storage bucket ('avatars' or 'workspace_media').
 * 3. If storage upload succeeds, returns the public CDN URL.
 * 4. Otherwise, returns the ~20KB high-speed dataUrl which syncs reliably across all devices.
 */
export async function uploadAvatarImage(
  file: File | Blob,
  userId?: string
): Promise<{ url: string; isCloudStorage: boolean; error?: string }> {
  // 1. Optimize image client-side to ~20KB
  const { dataUrl, blob } = await optimizeAvatarImage(file, 320, 0.85);

  // 2. Try Supabase Storage if configured
  const client = getSupabaseClient();
  if (client && isSupabaseConfigured()) {
    try {
      const cleanUser = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
      const ext = blob.type.includes('webp') ? 'webp' : 'jpg';
      const filePath = `avatar_${cleanUser}_${Date.now()}.${ext}`;

      // Try 'avatars' bucket first
      let uploadRes = await uploadFileToSupabaseStorage('avatars', filePath, blob);

      // If 'avatars' bucket failed or doesn't exist, try 'workspace_media'
      if (!uploadRes.url) {
        uploadRes = await uploadFileToSupabaseStorage('workspace_media', filePath, blob);
      }

      if (uploadRes.url) {
        return {
          url: uploadRes.url,
          isCloudStorage: true,
        };
      }
    } catch (err: any) {
      console.warn('Supabase storage upload notice (using optimized fallback):', err);
    }
  }

  // 3. Fallback to ultra-optimized 20KB base64 DataURL
  return {
    url: dataUrl,
    isCloudStorage: false,
  };
}
