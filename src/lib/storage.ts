/**
 * Storage Abstraction Layer — Laravel API only
 */

import api from "@/lib/api";
import { API_PUBLIC_ROOT } from "@/lib/apiBaseUrl";

export interface UploadResult {
  publicUrl: string;
  path: string;
}

export interface StorageProvider {
  upload(bucket: string, path: string, file: File, options?: { upsert?: boolean }): Promise<UploadResult>;
  getPublicUrl(bucket: string, path: string): string;
  delete(bucket: string, paths: string[]): Promise<void>;
  list(bucket: string, prefix?: string): Promise<{ name: string }[]>;
  download(bucket: string, path: string): Promise<Blob>;
}

// ─── Laravel Storage Provider ──────────────────────────────────
const laravelStorage: StorageProvider = {
  async upload(bucket, path, file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucket);
    formData.append('path', path);
    if (options.upsert) formData.append('upsert', 'true');

    const { data } = await api.post('/storage/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const publicUrl = `${API_PUBLIC_ROOT}/storage/${bucket}/${data.path || path}`;
    return { publicUrl, path: data.path || path };
  },

  getPublicUrl(bucket, path) {
    return `${API_PUBLIC_ROOT}/storage/${bucket}/${path}`;
  },

  async delete(bucket, paths) {
    await api.post('/storage/delete', { bucket, paths });
  },

  async list(bucket, prefix = '') {
    const { data } = await api.get(`/storage/list`, { params: { bucket, prefix } });
    return data || [];
  },

  async download(bucket, path) {
    const { data } = await api.get(`/storage/download`, {
      params: { bucket, path },
      responseType: 'blob',
    });
    return data;
  },
};

// ─── Active Provider ────────────────────────────────────────────
let activeProvider: StorageProvider = laravelStorage;

export function setStorageProvider(provider: StorageProvider) {
  activeProvider = provider;
}

// ─── Public API ─────────────────────────────────────────────────
export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  options?: { upsert?: boolean }
): Promise<UploadResult> {
  return activeProvider.upload(bucket, path, file, options);
}

export function getPublicUrl(bucket: string, path: string): string {
  return activeProvider.getPublicUrl(bucket, path);
}

export async function deleteFiles(bucket: string, paths: string[]): Promise<void> {
  return activeProvider.delete(bucket, paths);
}

export async function listFiles(bucket: string, prefix?: string): Promise<{ name: string }[]> {
  return activeProvider.list(bucket, prefix);
}

export async function downloadFile(bucket: string, path: string): Promise<Blob> {
  return activeProvider.download(bucket, path);
}

// ─── Convenience helpers ────────────────────────────────────────
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/avatar.${ext}`;
  const result = await uploadFile("avatars", path, file);
  return result.publicUrl;
}

export async function uploadCustomerPhoto(customerId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `customer-photos/${customerId}.${ext}`;
  const result = await uploadFile("avatars", path, file, { upsert: true });
  return result.publicUrl;
}

export async function uploadCompanyLogo(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/company-logo.${ext}`;
  const result = await uploadFile("avatars", path, file);
  return result.publicUrl;
}
