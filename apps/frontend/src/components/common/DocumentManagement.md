# Document Management System

This document describes the document management system components and their usage in the Rendasua frontend application.

## Overview

The document management system allows users (clients, agents, and businesses) to upload, view, manage, and organize their documents. The system integrates with AWS S3 for file storage and uses the backend API for document metadata management.

## Components

### 1. DocumentUpload

A comprehensive document upload component with progress tracking and validation.

**Features:**

- File selection with drag-and-drop support
- File type and size validation
- Document type categorization
- Upload progress tracking
- Error handling and success feedback
- Optional note field

**Usage:**

```tsx
import { DocumentUpload } from '../common/DocumentUpload';

<DocumentUpload
  documentTypes={documentTypes}
  onUploadSuccess={(document) => console.log('Uploaded:', document)}
  onUploadError={(error) => console.error('Upload failed:', error)}
  maxFileSize={10 * 1024 * 1024} // 10MB
  allowedFileTypes={['image/*', 'application/pdf']}
/>;
```

### 2. SimpleDocumentUpload

A simplified version of the upload component for use in forms or smaller contexts.

**Features:**

- Compact design
- Same validation and progress tracking
- Configurable note field
- Smaller footprint

**Usage:**

```tsx
import { SimpleDocumentUpload } from '../common/SimpleDocumentUpload';

<SimpleDocumentUpload documentTypes={documentTypes} onUploadSuccess={(document) => console.log('Uploaded:', document)} compact={true} showNote={false} />;
```

### 3. DocumentList

A comprehensive document management interface with filtering, preview, and editing capabilities.

**Features:**

- Document listing with filtering
- Search functionality
- Document type and status filtering
- Preview dialog for images and documents
- Edit document notes
- Delete documents with confirmation
- Download functionality
- Loading states with skeletons

**Usage:**

```tsx
import { DocumentList } from '../common/DocumentList';

<DocumentList documents={documents} documentTypes={documentTypes} loading={loading} error={error} onDelete={handleDelete} onUpdateNote={handleUpdateNote} onRefresh={handleRefresh} />;
```

### 4. DocumentManagementPage

The main document management page that combines all components.

**Features:**

- Tabbed interface by document type
- Upload dialog with FAB
- Comprehensive document management
- Success/error notifications
- Responsive design

**Usage:**

```tsx
import { DocumentManagementPage } from '../pages/DocumentManagementPage';

// Use as a route component
<Route path="/documents" element={<DocumentManagementPage />} />;
```

## Hooks

### useDocumentUpload

Handles file upload to AWS S3 via the backend API.

**Features:**

- Progress tracking
- Error handling
- Upload cancellation
- File validation

**Usage:**

```tsx
import { useDocumentUpload } from '../../hooks/useDocumentUpload';

const { uploadFile, isUploading, uploadProgress, cancelUpload } = useDocumentUpload();

const handleUpload = async (file, documentTypeId, note) => {
  try {
    const result = await uploadFile(file, documentTypeId, note);
    console.log('Upload successful:', result);
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

### useDocumentManagement

Manages document data and operations.

**Features:**

- Fetch documents with filtering
- Delete documents
- Update document notes
- Document type management
- Error handling

**Usage:**

```tsx
import { useDocumentManagement } from '../../hooks/useDocumentManagement';

const { documents, documentTypes, loading, error, deleteDocument, updateDocumentNote, refreshDocuments } = useDocumentManagement();
```

## Document Types

The system supports various document types including:

- **Identity Documents**: ID cards, passports, driver licenses
- **Business Documents**: Company registration, business licenses, tax clearance
- **Financial Documents**: Bank statements, pay slips, utility bills
- **Legal Documents**: Rental agreements, employment letters
- **Other**: General documents, training certificates

## File Types Supported

- Images: JPEG, PNG, GIF, WebP
- Documents: PDF, Word, Excel, PowerPoint
- Text files: TXT
- Archives: ZIP, RAR
- Maximum file size: 10MB (configurable)

## Integration Points

### Backend API

- `POST /users/get_upload_url` - Get presigned URL for S3 upload
- GraphQL mutations for document CRUD operations

### AWS S3

- File storage in `rendasua-user-uploads` bucket
- Presigned URLs for secure uploads
- Organized by user type and user ID

### Hasura GraphQL

- Document metadata storage
- User permissions and access control
- Real-time updates

## Security Features

- File type validation
- File size limits
- User-specific access control
- Secure S3 uploads with presigned URLs
- Input sanitization

## Error Handling

The system provides comprehensive error handling:

- Upload failures with retry options
- Network errors with user feedback
- Validation errors with clear messages
- Permission errors with appropriate responses

## Performance Considerations

- Lazy loading of document lists
- Skeleton loading states
- Optimized image previews
- Efficient filtering and search
- Progress tracking for large files

## Accessibility

- ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility
- High contrast support
- Focus management

## Future Enhancements

- Bulk upload functionality
- Document versioning
- Advanced search with OCR
- Document sharing between users
- Integration with external document services
- Mobile-optimized upload interface

