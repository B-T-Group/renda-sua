import { Add, CloudUpload } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  Paper,
  Snackbar,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import {
  useDocumentManagement,
  UserDocument,
} from '../../hooks/useDocumentManagement';
import { DocumentList } from '../common/DocumentList';
import { DocumentUpload } from '../common/DocumentUpload';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`document-tabpanel-${index}`}
      aria-labelledby={`document-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const DocumentManagementPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const {
    documents,
    documentTypes,
    loading,
    error,
    deleteDocument,
    updateDocumentNote,
    refreshDocuments,
  } = useDocumentManagement();

  const handleTabChange = useCallback(
    (event: React.SyntheticEvent, newValue: number) => {
      setTabValue(newValue);
    },
    []
  );

  const handleUploadSuccess = useCallback(
    (document: UserDocument) => {
      setSnackbar({
        open: true,
        message: 'Document uploaded successfully!',
        severity: 'success',
      });
      setUploadDialogOpen(false);
      refreshDocuments();
    },
    [refreshDocuments]
  );

  const handleUploadError = useCallback((error: string) => {
    setSnackbar({
      open: true,
      message: `Upload failed: ${error}`,
      severity: 'error',
    });
  }, []);

  const handleDeleteSuccess = useCallback(() => {
    setSnackbar({
      open: true,
      message: 'Document deleted successfully!',
      severity: 'success',
    });
  }, []);

  const handleUpdateNoteSuccess = useCallback(() => {
    setSnackbar({
      open: true,
      message: 'Document note updated successfully!',
      severity: 'success',
    });
  }, []);

  const handleDelete = useCallback(
    async (documentId: string) => {
      const success = await deleteDocument(documentId);
      if (success) {
        handleDeleteSuccess();
      }
      return success;
    },
    [deleteDocument, handleDeleteSuccess]
  );

  const handleUpdateNote = useCallback(
    async (documentId: string, note: string) => {
      const success = await updateDocumentNote(documentId, note);
      if (success) {
        handleUpdateNoteSuccess();
      }
      return success;
    },
    [updateDocumentNote, handleUpdateNoteSuccess]
  );

  const handleRefresh = useCallback(
    (filters?: any) => {
      refreshDocuments(filters);
    },
    [refreshDocuments]
  );

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  // Group documents by type for tabs
  const documentsByType = documents.reduce((acc, doc) => {
    const typeName = doc.document_type.name;
    if (!acc[typeName]) {
      acc[typeName] = [];
    }
    acc[typeName].push(doc);
    return acc;
  }, {} as Record<string, UserDocument[]>);

  // Create tabs for document types
  const documentTypeTabs = Object.keys(documentsByType).map(
    (typeName, index) => ({
      label: typeName,
      value: index,
      documents: documentsByType[typeName],
    })
  );

  // Add "All Documents" tab
  const allTabs = [
    { label: 'All Documents', value: 0, documents },
    ...documentTypeTabs.map((tab, index) => ({
      ...tab,
      value: index + 1,
    })),
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Document Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Upload, view, and manage your documents by category
        </Typography>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Document Type Tabs */}
      <Paper sx={{ width: '100%', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="document type tabs"
        >
          {allTabs.map((tab) => (
            <Tab
              key={tab.value}
              label={`${tab.label} (${tab.documents.length})`}
              id={`document-tab-${tab.value}`}
              aria-controls={`document-tabpanel-${tab.value}`}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      {allTabs.map((tab) => (
        <TabPanel key={tab.value} value={tabValue} index={tab.value}>
          <DocumentList
            documents={tab.documents}
            documentTypes={documentTypes}
            loading={loading}
            error={error}
            onDelete={handleDelete}
            onUpdateNote={handleUpdateNote}
            onRefresh={handleRefresh}
          />
        </TabPanel>
      ))}

      {/* Upload FAB */}
      <Fab
        color="primary"
        aria-label="upload document"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setUploadDialogOpen(true)}
      >
        <Add />
      </Fab>

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudUpload />
            Upload New Document
          </Box>
        </DialogTitle>
        <DialogContent>
          <DocumentUpload
            documentTypes={documentTypes}
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};


