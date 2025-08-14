import { Close, CloudUpload, Error } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import { DocumentType } from '../../hooks/useDocumentManagement';
import { useDocumentUpload } from '../../hooks/useDocumentUpload';

interface DocumentUploadProps {
  documentTypes: DocumentType[];
  onUploadSuccess?: (document: any) => void;
  onUploadError?: (error: string) => void;
  maxFileSize?: number; // in bytes
  allowedFileTypes?: string[];
  className?: string;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documentTypes,
  onUploadSuccess,
  onUploadError,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
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
}) => {
  const { uploadFile, isUploading, uploadProgress, cancelUpload } =
    useDocumentUpload();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<number | ''>(
    ''
  );
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');
  const [uploadResult, setUploadResult] = useState<any>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file size
      if (file.size > maxFileSize) {
        return `File size must be less than ${(
          maxFileSize /
          (1024 * 1024)
        ).toFixed(1)}MB`;
      }

      // Check file type
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
      setUploadResult(result);
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

  const handleCancel = useCallback(() => {
    cancelUpload();
    setUploadStatus('idle');
    setValidationError(null);
  }, [cancelUpload]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setSelectedDocumentType('');
    setNote('');
    setValidationError(null);
    setUploadStatus('idle');
    setUploadResult(null);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className={className} sx={{ maxWidth: 600, mx: 'auto' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Upload Document
        </Typography>

        {/* Success/Error Messages */}
        {uploadStatus === 'success' && (
          <Alert
            severity="success"
            action={
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={handleReset}
              >
                <Close fontSize="inherit" />
              </IconButton>
            }
            sx={{ mb: 2 }}
          >
            Document uploaded successfully!
          </Alert>
        )}

        {uploadStatus === 'error' && (
          <Alert
            severity="error"
            action={
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={handleReset}
              >
                <Close fontSize="inherit" />
              </IconButton>
            }
            sx={{ mb: 2 }}
          >
            Upload failed. Please try again.
          </Alert>
        )}

        {/* File Selection */}
        <Box sx={{ mb: 2 }}>
          <input
            accept={allowedFileTypes.join(',')}
            style={{ display: 'none' }}
            id="document-upload-input"
            type="file"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
          <label htmlFor="document-upload-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<CloudUpload />}
              disabled={isUploading}
              fullWidth
              sx={{ py: 2 }}
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
        <TextField
          fullWidth
          label="Note (Optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          rows={2}
          disabled={isUploading}
          sx={{ mb: 2 }}
        />

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

        {/* Action Buttons */}
        <Stack direction="row" spacing={2}>
          {!isUploading ? (
            <>
              <Button
                variant="contained"
                onClick={handleUpload}
                disabled={!selectedFile || !selectedDocumentType}
                fullWidth
              >
                Upload Document
              </Button>
              {selectedFile && (
                <Button variant="outlined" onClick={handleReset} fullWidth>
                  Reset
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="outlined"
              color="error"
              onClick={handleCancel}
              fullWidth
            >
              Cancel Upload
            </Button>
          )}
        </Stack>

        {/* File Type Info */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Allowed file types: {allowedFileTypes.join(', ')}
          </Typography>
          <br />
          <Typography variant="caption" color="text.secondary">
            Maximum file size: {formatFileSize(maxFileSize)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

