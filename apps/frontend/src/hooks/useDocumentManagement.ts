import { useCallback, useEffect, useState } from 'react';
import { useGraphQLClient } from './useGraphQLClient';

export interface DocumentType {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface UserDocument {
  id: string;
  user_id: string;
  document_type_id: number;
  note?: string;
  content_type: string;
  key: string;
  file_name: string;
  file_size: number;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
  document_type: DocumentType;
}

export interface DocumentFilters {
  document_type_id?: number;
  is_approved?: boolean;
  search?: string;
}

export const useDocumentManagement = () => {
  const { client } = useGraphQLClient();
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch document types
  const fetchDocumentTypes = useCallback(async () => {
    if (!client) return;

    try {
      const query = `
        query GetDocumentTypes {
          document_types {
            id
            name
            description
            created_at
            updated_at
          }
        }
      `;

      const response = await client.request(query);
      setDocumentTypes(response.document_types || []);
    } catch (err) {
      console.error('Error fetching document types:', err);
      setError('Failed to fetch document types');
    }
  }, [client]);

  // Fetch user documents
  const fetchDocuments = useCallback(
    async (filters?: DocumentFilters) => {
      if (!client) return;

      setLoading(true);
      setError(null);

      try {
        let whereClause: {
          document_type_id?: { _eq: number };
          is_approved?: { _eq: boolean };
          _or?: Array<{
            file_name?: { _ilike: string };
            note?: { _ilike: string };
          }>;
        } = {};

        if (filters) {
          if (filters.document_type_id) {
            whereClause.document_type_id = { _eq: filters.document_type_id };
          }

          if (filters.is_approved !== undefined) {
            whereClause.is_approved = { _eq: filters.is_approved };
          }

          if (filters.search) {
            whereClause._or = [
              { file_name: { _ilike: `%${filters.search}%` } },
              { note: { _ilike: `%${filters.search}%` } },
            ];
          }
        }

        const query = `
        query GetUserDocuments($where: user_uploads_bool_exp!) {
          user_uploads(where: $where, order_by: {created_at: desc}) {
            id
            user_id
            document_type_id
            note
            content_type
            key
            file_name
            file_size
            is_approved
            created_at
            updated_at
            document_type {
              id
              name
              description
              created_at
              updated_at
            }
          }
        }
      `;

        const response = await client.request(query, { where: whereClause });
        setDocuments(response.user_uploads || []);
      } catch (err) {
        console.error('Error fetching documents:', err);
        console.error('Where clause:', JSON.stringify(whereClause, null, 2));
        setError('Failed to fetch documents');
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  // Delete document
  const deleteDocument = useCallback(
    async (documentId: string) => {
      if (!client) return false;

      try {
        const mutation = `
        mutation DeleteDocument($id: uuid!) {
          delete_user_uploads_by_pk(id: $id) {
            id
          }
        }
      `;

        await client.request(mutation, { id: documentId });

        // Remove from local state
        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));

        return true;
      } catch (err) {
        console.error('Error deleting document:', err);
        setError('Failed to delete document');
        return false;
      }
    },
    [client]
  );

  // Update document note
  const updateDocumentNote = useCallback(
    async (documentId: string, note: string) => {
      if (!client) return false;

      try {
        const mutation = `
        mutation UpdateDocumentNote($id: uuid!, $note: String!) {
          update_user_uploads_by_pk(
            pk_columns: {id: $id}
            _set: {note: $note}
          ) {
            id
            note
            updated_at
          }
        }
      `;

        const response = await client.request(mutation, {
          id: documentId,
          note,
        });

        // Update local state
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  note: response.update_user_uploads_by_pk.note,
                  updated_at: response.update_user_uploads_by_pk.updated_at,
                }
              : doc
          )
        );

        return true;
      } catch (err) {
        console.error('Error updating document note:', err);
        setError('Failed to update document note');
        return false;
      }
    },
    [client]
  );

  // Get document preview URL
  const getDocumentPreviewUrl = useCallback((document: UserDocument) => {
    // This would need to be implemented based on your S3 setup
    // For now, we'll return a placeholder
    return `https://rendasua-user-uploads.s3.amazonaws.com/${document.key}`;
  }, []);

  // Format file size
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Get file icon based on content type
  const getFileIcon = useCallback((contentType: string): string => {
    if (contentType.startsWith('image/')) return '🖼️';
    if (contentType.includes('pdf')) return '📄';
    if (contentType.includes('word') || contentType.includes('document'))
      return '📝';
    if (contentType.includes('excel') || contentType.includes('spreadsheet'))
      return '📊';
    if (
      contentType.includes('powerpoint') ||
      contentType.includes('presentation')
    )
      return '📈';
    if (contentType.includes('zip') || contentType.includes('rar')) return '📦';
    return '📎';
  }, []);

  // Refresh documents
  const refreshDocuments = useCallback(
    (filters?: DocumentFilters) => {
      fetchDocuments(filters);
    },
    [fetchDocuments]
  );

  // Initialize
  useEffect(() => {
    fetchDocumentTypes();
    fetchDocuments();
  }, [fetchDocumentTypes, fetchDocuments]);

  return {
    documents,
    documentTypes,
    loading,
    error,
    fetchDocuments,
    deleteDocument,
    updateDocumentNote,
    getDocumentPreviewUrl,
    formatFileSize,
    getFileIcon,
    refreshDocuments,
  };
};
