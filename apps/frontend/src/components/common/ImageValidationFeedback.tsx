import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ImageValidationResult } from '../../types/imageValidation';

interface ImageValidationFeedbackProps {
  results: ImageValidationResult[];
  fileNames?: string[];
}

const issueKey = (code: string) =>
  `business.images.validation.codes.${code}`;

const ImageValidationFeedback: React.FC<ImageValidationFeedbackProps> = ({
  results,
  fileNames,
}) => {
  const { t } = useTranslation();
  if (!results.length) return null;

  return (
    <Stack spacing={1.5} sx={{ mt: 1 }}>
      {results.map((result, idx) => {
        const label =
          result.fileName ?? fileNames?.[result.clientIndex ?? idx] ?? '';
        const hasIssues =
          result.errors.length > 0 || result.warnings.length > 0;
        if (!hasIssues) return null;
        return (
          <Stack key={`${label}-${idx}`} spacing={0.5}>
            {label ? (
              <Typography variant="subtitle2" color="text.secondary">
                {label}
              </Typography>
            ) : null}
            {result.errors.map((issue) => (
              <Alert key={`e-${issue.code}`} severity="error" icon={false}>
                <List dense disablePadding>
                  <ListItem disablePadding>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <ErrorOutlineIcon color="error" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={t(issueKey(issue.code), issue.message)}
                    />
                  </ListItem>
                </List>
              </Alert>
            ))}
            {result.warnings.map((issue) => (
              <Alert key={`w-${issue.code}`} severity="warning" icon={false}>
                <List dense disablePadding>
                  <ListItem disablePadding>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <WarningAmberIcon color="warning" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={t(issueKey(issue.code), issue.message)}
                    />
                  </ListItem>
                </List>
              </Alert>
            ))}
          </Stack>
        );
      })}
    </Stack>
  );
};

export default ImageValidationFeedback;
