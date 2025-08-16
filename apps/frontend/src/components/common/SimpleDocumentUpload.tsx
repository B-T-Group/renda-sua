import { CloudUpload } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import { DocumentType } from '../../hooks/useDocumentManagement';
import { useDocumentUpload } from '../../hooks/useDocumentUpload';

interface SimpleDocumentUploadProps {
  documentTypes: DocumentType[];
  onUploadSuccess?: (document: any) => void;
  onUploadError?: (error: string) => void;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  className?: string;
  showNote?: boolean;
  compact?: boolean;
}

export const SimpleDocumentUpload: React.FC<SimpleDocumentUploadProps> = ({
  documentTypes,
  onUploadSuccess,
  onUploadError,
  maxFileSize = 10 * 1024 * 1024,
  allowedFileTypes = [
    'image/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
  ],
  className,
  showNote = true,
  compact = false,
}) => {
  const { uploadFile, isUploading, uploadProgress } = useDocumentUpload();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<number | ''>(
    ''
  );
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxFileSize) {
        return `File size must be less than ${(
          maxFileSize /
          (1024 * 1024)
        ).toFixed(1)}MB`;
      }

      const isAllowedType = allowedFileTypes.some((type) => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -1));
        }
        return file.type === type;
      });

      if (!isAllowedType) {
        return 'File type not allowed. Please select a valid document type.';
      }

      return null;
    },
    [maxFileSize, allowedFileTypes]
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        setSelectedFile(null);
        return;
      }

      setValidationError(null);
      setSelectedFile(file);
      setUploadStatus('idle');
    },
    [validateFile]
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !selectedDocumentType) {
      setValidationError('Please select a file and document type');
      return;
    }

    try {
      setUploadStatus('idle');
      const result = await uploadFile(
        selectedFile,
        selectedDocumentType,
        note || undefined
      );
      setUploadStatus('success');
      onUploadSuccess?.(result);

      // Reset form
      setSelectedFile(null);
      setSelectedDocumentType('');
      setNote('');
      setValidationError(null);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus('error');
      onUploadError?.(error instanceof Error ? error.message : 'Upload failed');
    }
  }, [
    selectedFile,
    selectedDocumentType,
    note,
    uploadFile,
    onUploadSuccess,
    onUploadError,
  ]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box className={className}>
      {/* Success/Error Messages */}
      {uploadStatus === 'success' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Document uploaded successfully!
        </Alert>
      )}

      {uploadStatus === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Upload failed. Please try again.
        </Alert>
      )}

      {/* File Selection */}
      <Box sx={{ mb: 2 }}>
        <input
          accept={allowedFileTypes.join(',')}
          style={{ display: 'none' }}
          id="simple-document-upload-input"
          type="file"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        <label htmlFor="simple-document-upload-input">
          <Button
            variant="outlined"
            component="span"
            startIcon={<CloudUpload />}
            disabled={isUploading}
            fullWidth
            sx={{ py: compact ? 1 : 2 }}
          >
            {selectedFile ? selectedFile.name : 'Choose File'}
          </Button>
        </label>

        {selectedFile && (
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={`${formatFileSize(selectedFile.size)}`}
              size="small"
              color="primary"
            />
            <Chip label={selectedFile.type} size="small" variant="outlined" />
          </Box>
        )}
      </Box>

      {/* Document Type Selection */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Document Type</InputLabel>
        <Select
          value={selectedDocumentType}
          label="Document Type"
          onChange={(e) => setSelectedDocumentType(e.target.value as number)}
          disabled={isUploading}
        >
          {documentTypes.map((type) => (
            <MenuItem key={type.id} value={type.id}>
              {type.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Note Field */}
      {showNote && (
        <TextField
          fullWidth
          label="Note (Optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          rows={compact ? 1 : 2}
          disabled={isUploading}
          sx={{ mb: 2 }}
        />
      )}

      {/* Validation Error */}
      {validationError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {validationError}
        </Alert>
      )}

      {/* Upload Progress */}
      {isUploading && uploadProgress && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography variant="body2">
              Uploading... {uploadProgress.percentage}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={uploadProgress.percentage}
          />
        </Box>
      )}

      {/* Action Button */}
      <Button
        variant="contained"
        onClick={handleUpload}
        disabled={!selectedFile || !selectedDocumentType || isUploading}
        fullWidth
        sx={{ py: compact ? 1 : 2 }}
      >
        {isUploading ? 'Uploading...' : 'Upload Document'}
      </Button>
    </Box>
  );
};


