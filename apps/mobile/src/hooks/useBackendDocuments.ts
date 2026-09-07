import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/apiClient';
import type { PickedUploadFile } from '../utils/documentPickers';

export type { PickedUploadFile };

export interface BackendDocumentType {
  id: number;
  name: string;
  description: string;
}

export interface BackendUserDocument {
  id: string;
  document_type_id?: number;
  file_name: string;
  file_size: number;
  content_type?: string;
  created_at?: string;
  is_approved: boolean;
  note?: string | null;
  document_type?: { id: number; name: string; description: string };
}

/** Government ID types used by agent/business verification. */
export const ID_TYPE_NAMES = ['id_card', 'passport', 'driver_license'];

async function resolveFileSize(file: PickedUploadFile): Promise<number> {
  if (file.fileSize > 0) return file.fileSize;
  const blob = await (await fetch(file.uri)).blob();
  return blob.size;
}

export function useBackendDocuments(enabled = true) {
  const [documents, setDocuments] = useState<BackendUserDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<BackendDocumentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [typesRes, uploadsRes] = await Promise.all([
        api.get<{ success: boolean; data: { documentTypes: BackendDocumentType[] } }>(
          '/uploads/document-types'
        ),
        api.get<{ success: boolean; data: { uploads: BackendUserDocument[] } }>('/uploads/me'),
      ]);
      setDocumentTypes(typesRes.data?.documentTypes ?? []);
      setDocuments(uploadsRes.data?.uploads ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadFile = useCallback(
    async (documentTypeId: number, file: PickedUploadFile): Promise<boolean> => {
      setUploading(true);
      setError(null);
      try {
        const fileSize = await resolveFileSize(file);
        const urlRes = await api.post<{
          success: boolean;
          presigned_url: string;
        }>('/uploads/get_upload_url', {
          file_name: file.fileName,
          content_type: file.contentType,
          file_size: fileSize,
          document_type_id: documentTypeId,
        });
        if (!urlRes.success || !urlRes.presigned_url) {
          throw new Error('Upload URL failed');
        }

        const blob = await (await fetch(file.uri)).blob();
        const putRes = await fetch(urlRes.presigned_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.contentType },
          body: blob,
        });
        if (!putRes.ok) throw new Error('Upload failed');

        await load();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
        return false;
      } finally {
        setUploading(false);
      }
    },
    [load]
  );

  return {
    documents,
    documentTypes,
    loading,
    uploading,
    error,
    refetch: load,
    uploadFile,
  };
}
