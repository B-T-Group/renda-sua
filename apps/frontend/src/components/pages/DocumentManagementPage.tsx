import { Add, ArrowBack, CloudUpload } from '@mui/icons-material';
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
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
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
  const { t } = useTranslation();
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
        message: t('common.documentManagement.uploadSuccess'),
        severity: 'success',
      });
      setUploadDialogOpen(false);
      refreshDocuments();
    },
    [refreshDocuments, t]
  );

  const handleUploadError = useCallback(
    (error: string) => {
      setSnackbar({
        open: true,
        message: `${t('common.documentManagement.uploadError')}: ${error}`,
        severity: 'error',
      });
    },
    [t]
  );

  const handleDeleteSuccess = useCallback(() => {
    setSnackbar({
      open: true,
      message: t('common.documentManagement.deleteSuccess'),
      severity: 'success',
    });
  }, [t]);

  const handleUpdateNoteSuccess = useCallback(() => {
    setSnackbar({
      open: true,
      message: t('common.documentManagement.noteUpdateSuccess'),
      severity: 'success',
    });
  }, [t]);

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
    {
      label: t('common.documentManagement.allDocuments'),
      value: 0,
      documents,
    },
    ...documentTypeTabs.map((tab, index) => ({
      ...tab,
      value: index + 1,
    })),
  ];

  const hasDocuments = documents.length > 0;
  const hasDocumentTypes = documentTypes.length > 0;

  return (
    <Container
      maxWidth="xl"
      sx={{
        py: { xs: 2, sm: 3, md: 4 },
        px: { xs: 2, sm: 3 },
        pb: { xs: 10, md: 4 },
      }}
    >
      {/* Page Header with back link and upload button */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <IconButton
              component={RouterLink}
              to="/profile"
              aria-label={t('common.documentManagement.backToProfile')}
              size="small"
              sx={{ mr: 0.5 }}
            >
              <ArrowBack />
            </IconButton>
            <Typography variant="h4" component="h1" fontWeight={600}>
              {t('common.documentManagement.title')}
            </Typography>
          </Stack>
          <Typography variant="body1" color="text.secondary">
            {t('common.documentManagement.subtitle')}
          </Typography>
        </Box>
        {hasDocumentTypes && (
          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={() => setUploadDialogOpen(true)}
            sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}
          >
            {t('common.documentManagement.uploadNew')}
          </Button>
        )}
      </Stack>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Empty state when no documents */}
      {!loading && !hasDocuments && (
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            textAlign: 'center',
            mb: 3,
          }}
        >
          <CloudUpload sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {t('common.documentManagement.noDocuments')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('common.documentManagement.noDocumentsHint')}
          </Typography>
          {hasDocumentTypes && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setUploadDialogOpen(true)}
            >
              {t('common.documentManagement.uploadNew')}
            </Button>
          )}
        </Paper>
      )}

      {/* Document Type Tabs - only when we have documents */}
      {hasDocuments && (
        <Paper sx={{ width: '100%', mb: 3, overflow: 'hidden' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="document type tabs"
            sx={{ minHeight: 48 }}
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
      )}

      {/* Tab Panels */}
      {hasDocuments &&
        allTabs.map((tab) => (
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

      {/* Upload FAB - mobile friendly, clears bottom nav */}
      {hasDocumentTypes && (
        <Fab
          color="primary"
          aria-label={t('common.documentManagement.uploadNew')}
          sx={{
            position: 'fixed',
            bottom: { xs: 80, md: 24 },
            right: { xs: 16, md: 24 },
            zIndex: 1100,
          }}
          onClick={() => setUploadDialogOpen(true)}
        >
          <Add />
        </Fab>
      )}

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { m: { xs: 1 } } }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CloudUpload />
            <Typography variant="h6">
              {t('common.documentManagement.uploadNew')}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DocumentUpload
            documentTypes={documentTypes}
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUploadDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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



