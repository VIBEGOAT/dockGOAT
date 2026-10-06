/**
 * Cloudflare R2 client utility
 * Provides helpers for uploading and managing files in R2
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: 'auto',
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY || '',
    secretAccessKey: process.env.CF_R2_SECRET_KEY || '',
  },
  endpoint: process.env.CF_R2_ENDPOINT,
});

const BUCKET = process.env.CF_R2_BUCKET || 'dockgoat';
const PUBLIC_URL_BASE = process.env.CF_R2_PUBLIC_URL || '';

/**
 * Upload file to Cloudflare R2
 * @param key - S3 key (path in bucket)
 * @param body - File content
 * @param contentType - MIME type
 * @returns Public URL to the file
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await s3Client.send(command);

    // Return public URL
    return `${PUBLIC_URL_BASE}/${key}`;
  } catch (error) {
    console.error('Failed to upload to R2:', error);
    throw error;
  }
}

/**
 * Generate signed URL for downloading from R2 (valid for 1 hour)
 * @param key - S3 key
 * @returns Signed URL
 */
export async function getSignedDownloadUrl(key: string): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    console.error('Failed to generate signed URL:', error);
    throw error;
  }
}

/**
 * Get public URL for a file
 * (assumes file is in public/readable bucket)
 * @param key - S3 key
 * @returns Public URL
 */
export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL_BASE}/${key}`;
}

/**
 * Generate unique key for user file upload
 * @param userId - User ID
 * @param fileType - Type of file (ligand, protein, result)
 * @param fileName - Original file name
 * @returns Generated S3 key
 */
export function generateFileKey(
  userId: string,
  fileType: 'ligand' | 'protein' | 'result',
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${userId}/${fileType}/${timestamp}-${sanitized}`;
}

export const R2 = {
  uploadToR2,
  getSignedDownloadUrl,
  getPublicUrl,
  generateFileKey,
};
