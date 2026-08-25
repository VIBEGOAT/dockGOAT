/**
 * Supabase Storage client utility
 * Provides helpers for uploading and managing files in Supabase Storage
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const bucketName = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'dockgoat-files';

let supabase: any = null;

/**
 * Initialize Supabase client (lazy initialization)
 */
function initSupabase() {
  if (supabase) return supabase;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables are required');
  }
  
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  return supabase;
}

/**
 * Upload file to Supabase Storage
 * @param fileName - File path in bucket (e.g., "user123/ligands/file.pdbqt")
 * @param fileContent - File content as Buffer or string
 * @param contentType - MIME type (default: application/octet-stream)
 * @returns Public URL to the file
 */
export async function uploadToSupabase(
  fileName: string,
  fileContent: Buffer | Uint8Array | string,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  try {
    const client = initSupabase();
    
    // Convert string to buffer if needed
    const buffer =
      typeof fileContent === 'string'
        ? Buffer.from(fileContent)
        : fileContent;

    const { data, error } = await client.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase upload error: ${error.message}`);
    }

    // Return public URL
    const { data: publicUrlData } = client.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Failed to upload to Supabase:', error);
    throw error;
  }
}

/**
 * Download file from Supabase Storage
 * @param fileName - File path in bucket
 * @returns File content as Buffer
 */
export async function downloadFromSupabase(
  fileName: string
): Promise<Buffer> {
  try {
    const client = initSupabase();
    
    const { data, error } = await client.storage
      .from(bucketName)
      .download(fileName);

    if (error) {
      throw new Error(`Supabase download error: ${error.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  } catch (error) {
    console.error('Failed to download from Supabase:', error);
    throw error;
  }
}

/**
 * Get public URL for a file
 * @param fileName - File path in bucket
 * @returns Public URL
 */
export function getPublicUrl(fileName: string): string {
  const client = initSupabase();
  const { data } = client.storage.from(bucketName).getPublicUrl(fileName);
  return data.publicUrl;
}

/**
 * Delete file from Supabase Storage
 * @param fileName - File path in bucket
 */
export async function deleteFromSupabase(fileName: string): Promise<void> {
  try {
    const client = initSupabase();
    
    const { error } = await client.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      throw new Error(`Supabase delete error: ${error.message}`);
    }
  } catch (error) {
    console.error('Failed to delete from Supabase:', error);
    throw error;
  }
}

/**
 * Generate unique file key for user file upload
 * @param userId - User ID
 * @param fileType - Type of file (ligands, proteins, results)
 * @param fileName - Original file name
 * @returns Generated file path for Supabase Storage
 */
export function generateFileKey(
  userId: string,
  fileType: 'ligands' | 'proteins' | 'results',
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${userId}/${fileType}/${timestamp}-${sanitized}`;
}

/**
 * List files in a directory
 * @param path - Directory path (e.g., "user123/ligands/")
 * @returns Array of file paths
 */
export async function listFiles(path: string): Promise<string[]> {
  try {
    const client = initSupabase();
    
    const { data, error } = await client.storage
      .from(bucketName)
      .list(path);

    if (error) {
      throw new Error(`Supabase list error: ${error.message}`);
    }

    return data?.map((file) => `${path}${file.name}`) || [];
  } catch (error) {
    console.error('Failed to list files from Supabase:', error);
    throw error;
  }
}

export const SupabaseStorage = {
  uploadToSupabase,
  downloadFromSupabase,
  getPublicUrl,
  deleteFromSupabase,
  generateFileKey,
  listFiles,
};
