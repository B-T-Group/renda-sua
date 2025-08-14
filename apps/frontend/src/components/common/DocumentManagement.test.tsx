import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { theme } from '../../theme/theme';
import { DocumentList } from './DocumentList';
import { DocumentUpload } from './DocumentUpload';
import { SimpleDocumentUpload } from './SimpleDocumentUpload';

// Mock the hooks
jest.mock('../../hooks/useDocumentUpload', () => ({
  useDocumentUpload: () => ({
    uploadFile: jest.fn(),
    isUploading: false,
    uploadProgress: null,
    cancelUpload: jest.fn(),
  }),
}));

jest.mock('../../hooks/useDocumentManagement', () => ({
  useDocumentManagement: () => ({
    documents: [],
    documentTypes: [
      { id: 1, name: 'ID Card', description: 'National ID Card' },
      { id: 2, name: 'Passport', description: 'Passport' },
      { id: 3, name: 'Business License', description: 'Business License' },
    ],
    loading: false,
    error: null,
    deleteDocument: jest.fn(),
    updateDocumentNote: jest.fn(),
    refreshDocuments: jest.fn(),
  }),
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('Document Management Components', () => {
  describe('DocumentUpload', () => {
    it('renders upload form correctly', () => {
      const documentTypes = [
        { id: 1, name: 'ID Card', description: 'National ID Card' },
        { id: 2, name: 'Passport', description: 'Passport' },
      ];

      renderWithTheme(
        <DocumentUpload
          documentTypes={documentTypes}
          onUploadSuccess={jest.fn()}
          onUploadError={jest.fn()}
        />
      );

      expect(screen.getByText('Upload Document')).toBeInTheDocument();
      expect(screen.getByText('Choose File')).toBeInTheDocument();
      expect(screen.getByText('Document Type')).toBeInTheDocument();
      expect(screen.getByText('Note (Optional)')).toBeInTheDocument();
    });

    it('shows file selection when file is chosen', () => {
      const documentTypes = [
        { id: 1, name: 'ID Card', description: 'National ID Card' },
      ];

      renderWithTheme(
        <DocumentUpload
          documentTypes={documentTypes}
          onUploadSuccess={jest.fn()}
          onUploadError={jest.fn()}
        />
      );

      const file = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      });
      const input = screen.getByLabelText(/choose file/i);

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
  });

  describe('SimpleDocumentUpload', () => {
    it('renders simplified upload form', () => {
      const documentTypes = [
        { id: 1, name: 'ID Card', description: 'National ID Card' },
      ];

      renderWithTheme(
        <SimpleDocumentUpload
          documentTypes={documentTypes}
          onUploadSuccess={jest.fn()}
          onUploadError={jest.fn()}
          compact={true}
        />
      );

      expect(screen.getByText('Choose File')).toBeInTheDocument();
      expect(screen.getByText('Document Type')).toBeInTheDocument();
    });

    it('hides note field when showNote is false', () => {
      const documentTypes = [
        { id: 1, name: 'ID Card', description: 'National ID Card' },
      ];

      renderWithTheme(
        <SimpleDocumentUpload
          documentTypes={documentTypes}
          onUploadSuccess={jest.fn()}
          onUploadError={jest.fn()}
          showNote={false}
        />
      );

      expect(screen.queryByText('Note (Optional)')).not.toBeInTheDocument();
    });
  });

  describe('DocumentList', () => {
    it('renders empty state when no documents', () => {
      const documentTypes = [
        { id: 1, name: 'ID Card', description: 'National ID Card' },
      ];

      renderWithTheme(
        <DocumentList
          documents={[]}
          documentTypes={documentTypes}
          loading={false}
          error={null}
          onDelete={jest.fn()}
          onUpdateNote={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      expect(screen.getByText('No documents found')).toBeInTheDocument();
    });

    it('renders documents when available', () => {
      const documentTypes = [
        { id: 1, name: 'ID Card', description: 'National ID Card' },
      ];

      const documents = [
        {
          id: '1',
          user_id: 'user1',
          document_type_id: 1,
          note: 'Test document',
          content_type: 'application/pdf',
          key: 'test-key',
          file_name: 'test.pdf',
          file_size: 1024,
          is_approved: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          document_type: {
            id: 1,
            name: 'ID Card',
            description: 'National ID Card',
          },
        },
      ];

      renderWithTheme(
        <DocumentList
          documents={documents}
          documentTypes={documentTypes}
          loading={false}
          error={null}
          onDelete={jest.fn()}
          onUpdateNote={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      expect(screen.getByText('test.pdf')).toBeInTheDocument();
      expect(screen.getByText('ID Card')).toBeInTheDocument();
      expect(screen.getByText('Test document')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      const documentTypes = [
        { id: 1, name: 'ID Card', description: 'National ID Card' },
      ];

      renderWithTheme(
        <DocumentList
          documents={[]}
          documentTypes={documentTypes}
          loading={true}
          error={null}
          onDelete={jest.fn()}
          onUpdateNote={jest.fn()}
          onRefresh={jest.fn()}
        />
      );

      // Should show skeleton loading elements
      expect(screen.getByText('Documents (0)')).toBeInTheDocument();
    });
  });
});

