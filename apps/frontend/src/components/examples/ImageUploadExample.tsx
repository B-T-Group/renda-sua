import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { GeneratePresignedUrlRequest, useAws } from '../../hooks/useAws';

const ImageUploadExample: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [bucketName, setBucketName] = useState('your-bucket-name');

  const { loading, error, generateImageUploadUrl, clearError } = useAws();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadedUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !bucketName) {
      return;
    }

    try {
      // Step 1: Generate presigned URL
      const request: GeneratePresignedUrlRequest = {
        bucketName,
        originalFileName: selectedFile.name,
        contentType: selectedFile.type,
        expiresIn: 3600, // 1 hour
        prefix: 'images',
        metadata: {
          'uploaded-by': 'user',
          'file-size': selectedFile.size.toString(),
        },
      };

      const presignedResponse = await generateImageUploadUrl(request);

      if (!presignedResponse?.data) {
        console.error('Failed to generate presigned URL');
        return;
      }

      // Step 2: Upload file directly to S3 using PUT with presigned URL
      const uploadResponse = await fetch(presignedResponse.data.url, {
        method: 'PUT',
        headers: {
          'Content-Type': selectedFile.type,
        },
        body: selectedFile,
      });

      if (uploadResponse.ok) {
        // Construct the final URL (you might need to adjust this based on your S3 setup)
        const finalUrl = `https://${bucketName}.s3.amazonaws.com/${presignedResponse.data.key}`;
        setUploadedUrl(finalUrl);
        console.log('File uploaded successfully:', finalUrl);
      } else {
        console.error('Upload failed:', uploadResponse.statusText);
      }
    } catch (err) {
      console.error('Upload error:', err);
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Image Upload Example
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Upload Image to S3
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
              {error}
            </Alert>
          )}

          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="S3 Bucket Name"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              helperText="Enter your S3 bucket name"
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="image-file-input"
              type="file"
              onChange={handleFileSelect}
            />
            <label htmlFor="image-file-input">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUploadIcon />}
                disabled={loading}
              >
                Select Image
              </Button>
            </label>
            {selectedFile && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Selected: {selectedFile.name} (
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </Typography>
            )}
          </Box>

          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!selectedFile || loading || !bucketName}
            startIcon={
              loading ? <CircularProgress size={20} /> : <CloudUploadIcon />
            }
          >
            {loading ? 'Uploading...' : 'Upload Image'}
          </Button>

          {uploadedUrl && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success">Image uploaded successfully!</Alert>
              <Typography variant="body2" sx={{ mt: 1 }}>
                URL: {uploadedUrl}
              </Typography>
              <img
                src={uploadedUrl}
                alt="Uploaded"
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  marginTop: '10px',
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            How it works
          </Typography>
          <Typography variant="body2" paragraph>
            1. User selects an image file
          </Typography>
          <Typography variant="body2" paragraph>
            2. Frontend calls backend API to generate a presigned URL
          </Typography>
          <Typography variant="body2" paragraph>
            3. Frontend uploads directly to S3 using the presigned URL
          </Typography>
          <Typography variant="body2" paragraph>
            4. No file data passes through the backend server
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ImageUploadExample;
