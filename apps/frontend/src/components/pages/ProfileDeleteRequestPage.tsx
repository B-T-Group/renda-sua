import {
  ArrowBack as ArrowBackIcon,
  Email as EmailIcon,
  InfoOutlined as InfoIcon,
  PersonOff as PersonOffIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import SEOHead from '../seo/SEOHead';

const DEVELOPER_EMAIL = 'tech@rendasua.com';
const APP_NAME = 'Rendasua';

const ProfileDeleteRequestPage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth0();

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(
      t('profile.deleteRequest.emailSubject', 'Account deletion request')
    );
    const body = encodeURIComponent(
      t(
        'profile.deleteRequest.emailBody',
        'Hello Rendasua team,\n\nI would like to request deletion of my account.\n\nRegistered email:\nRegistered phone (if any):\n\nThank you.'
      )
    );
    return `mailto:${DEVELOPER_EMAIL}?subject=${subject}&body=${body}`;
  }, [t]);

  const steps = useMemo(
    () => [
      {
        title: t(
          'profile.deleteRequest.steps.email.title',
          'Email us from your registered address'
        ),
        body: t(
          'profile.deleteRequest.steps.email.body',
          'Send your request to {{email}} using the same email linked to your Rendasua account so we can verify you.',
          { email: DEVELOPER_EMAIL }
        ),
      },
      {
        title: t(
          'profile.deleteRequest.steps.confirm.title',
          'Confirm your identity'
        ),
        body: t(
          'profile.deleteRequest.steps.confirm.body',
          'We may reply to ask for extra confirmation (for example your phone number or a recent order number) before we process the deletion.'
        ),
      },
      {
        title: t(
          'profile.deleteRequest.steps.process.title',
          'We process your request'
        ),
        body: t(
          'profile.deleteRequest.steps.process.body',
          'After verification, we deactivate your account and begin removing eligible personal data within 30 days.'
        ),
      },
      {
        title: t(
          'profile.deleteRequest.steps.done.title',
          'You receive confirmation'
        ),
        body: t(
          'profile.deleteRequest.steps.done.body',
          'We email you when deletion is complete or if we must retain specific records for legal reasons (see below).'
        ),
      },
    ],
    [t]
  );

  const deletedRows = useMemo(
    () => [
      {
        category: t(
          'profile.deleteRequest.data.deleted.profile.category',
          'Account profile'
        ),
        detail: t(
          'profile.deleteRequest.data.deleted.profile.detail',
          'Name, email, phone, profile photo, timezone, and persona preferences'
        ),
      },
      {
        category: t(
          'profile.deleteRequest.data.deleted.addresses.category',
          'Saved addresses'
        ),
        detail: t(
          'profile.deleteRequest.data.deleted.addresses.detail',
          'Delivery and billing addresses stored on your account'
        ),
      },
      {
        category: t(
          'profile.deleteRequest.data.deleted.documents.category',
          'Verification documents'
        ),
        detail: t(
          'profile.deleteRequest.data.deleted.documents.detail',
          'ID and other files you uploaded for verification (where law allows erasure)'
        ),
      },
      {
        category: t(
          'profile.deleteRequest.data.deleted.notifications.category',
          'Notification tokens'
        ),
        detail: t(
          'profile.deleteRequest.data.deleted.notifications.detail',
          'Push notification registrations and in-app notification preferences'
        ),
      },
    ],
    [t]
  );

  const keptRows = useMemo(
    () => [
      {
        category: t(
          'profile.deleteRequest.data.kept.orders.category',
          'Orders & delivery records'
        ),
        detail: t(
          'profile.deleteRequest.data.kept.orders.detail',
          'Order history, statuses, and delivery logs (anonymized or minimized where possible)'
        ),
        reason: t(
          'profile.deleteRequest.data.kept.orders.reason',
          'Contract fulfillment, disputes, and consumer protection'
        ),
      },
      {
        category: t(
          'profile.deleteRequest.data.kept.payments.category',
          'Payments & wallet ledger'
        ),
        detail: t(
          'profile.deleteRequest.data.kept.payments.detail',
          'Transaction records, reconciliation entries, and mobile-money references'
        ),
        reason: t(
          'profile.deleteRequest.data.kept.payments.reason',
          'Accounting, anti-fraud, and regulatory obligations'
        ),
      },
      {
        category: t(
          'profile.deleteRequest.data.kept.support.category',
          'Support & safety records'
        ),
        detail: t(
          'profile.deleteRequest.data.kept.support.detail',
          'Support tickets and abuse-prevention logs tied to resolved incidents'
        ),
        reason: t(
          'profile.deleteRequest.data.kept.support.reason',
          'Legal defense and platform safety'
        ),
      },
    ],
    [t]
  );

  const backPath = isAuthenticated ? '/profile' : '/';

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 } }}>
      <SEOHead
        title={t('seo.profile-delete-request.title', 'Delete your account - Rendasua')}
        description={t(
          'seo.profile-delete-request.description',
          'How to request deletion of your Rendasua account and what data is removed or retained.'
        )}
        keywords={t(
          'seo.profile-delete-request.keywords',
          'account deletion, delete account, Rendasua, data privacy'
        )}
      />

      <Button
        component={RouterLink}
        to={backPath}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        {isAuthenticated
          ? t('profile.deleteRequest.backToProfile', 'Back to profile')
          : t('common.back', 'Back')}
      </Button>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 4 },
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          mb: 3,
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.main}12 0%, ${theme.palette.background.paper} 55%)`,
        }}
      >
        <Stack spacing={2} alignItems={{ xs: 'center', sm: 'flex-start' }}>
          <Chip
            icon={<PersonOffIcon />}
            label={t('profile.deleteRequest.badge', 'Account deletion')}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
          <Typography variant="h4" component="h1" fontWeight={800}>
            {t('profile.deleteRequest.title', 'Request account deletion')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560 }}>
            {t(
              'profile.deleteRequest.intro',
              'This page explains how to ask {{app}} to delete your account and personal data. The same developer name and contact appear on our app store listings.',
              { app: APP_NAME }
            )}
          </Typography>
          <Card
            variant="outlined"
            sx={{
              width: '100%',
              borderColor: 'primary.main',
              borderWidth: 2,
              bgcolor: 'background.paper',
            }}
          >
            <CardContent>
              <Typography variant="overline" color="primary" fontWeight={700}>
                {t('profile.deleteRequest.developerLabel', 'App & developer')}
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                {APP_NAME}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
                <EmailIcon color="primary" fontSize="small" />
                <Link href={mailtoHref} underline="hover" fontWeight={600} variant="body1">
                  {DEVELOPER_EMAIL}
                </Link>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Paper>

      <Typography variant="h5" fontWeight={700} gutterBottom>
        {t('profile.deleteRequest.stepsHeading', 'How to request deletion')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'profile.deleteRequest.stepsSubtitle',
          'Follow these steps. We do not delete accounts from in-app chat alone—you must email us.'
        )}
      </Typography>

      <Stack spacing={2} sx={{ mb: 4 }}>
        {steps.map((step, i) => (
          <StepCard key={step.title} step={i + 1} title={step.title} body={step.body} />
        ))}
      </Stack>

      <Box sx={{ mb: 4, textAlign: { xs: 'stretch', sm: 'center' } }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<EmailIcon />}
          href={mailtoHref}
          component="a"
          sx={{ px: 4 }}
        >
          {t('profile.deleteRequest.cta', 'Email deletion request')}
        </Button>
      </Box>

      <Alert
        severity="info"
        icon={<ScheduleIcon />}
        sx={{ mb: 4 }}
      >
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          {t('profile.deleteRequest.retention.title', 'Retention period')}
        </Typography>
        <Typography variant="body2">
          {t(
            'profile.deleteRequest.retention.body',
            'Most personal data is deleted within 30 days after we confirm your request. Financial and order records may be kept longer (typically up to 7 years) where required by law, then deleted or anonymized.'
          )}
        </Typography>
      </Alert>

      <DataTableSection
        title={t('profile.deleteRequest.deletedHeading', 'Data we delete')}
        subtitle={t(
          'profile.deleteRequest.deletedSubtitle',
          'Removed or anonymized after your account is deleted, except where we must keep copies for legal reasons.'
        )}
        rows={deletedRows}
        twoColumn
        categoryLabel={t('profile.deleteRequest.table.category', 'Category')}
        detailsLabel={t('profile.deleteRequest.table.details', 'Details')}
      />

      <DataTableSection
        title={t('profile.deleteRequest.keptHeading', 'Data we may keep')}
        subtitle={t(
          'profile.deleteRequest.keptSubtitle',
          'Retained in limited form for the reasons below. Personal identifiers are minimized where possible.'
        )}
        rows={keptRows}
        twoColumn={false}
        categoryLabel={t('profile.deleteRequest.table.category', 'Category')}
        detailsLabel={t('profile.deleteRequest.table.details', 'Details')}
        reasonLabel={t('profile.deleteRequest.table.reason', 'Why kept')}
      />

      <Alert severity="warning" icon={<InfoIcon />} sx={{ mt: 3 }}>
        <Typography variant="body2">
          {t(
            'profile.deleteRequest.warning',
            'Pending orders, open disputes, or wallet balances may delay deletion until resolved. We will explain any delay in our reply to your email.'
          )}
        </Typography>
      </Alert>
    </Container>
  );
};

function StepCard({
  step,
  title,
  body,
}: {
  step: number;
  title: string;
  body: string;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <Chip label={step} color="primary" size="small" sx={{ fontWeight: 800, minWidth: 32 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {body}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function DataTableSection({
  title,
  subtitle,
  rows,
  twoColumn,
  categoryLabel,
  detailsLabel,
  reasonLabel,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ category: string; detail: string; reason?: string }>;
  twoColumn: boolean;
  categoryLabel: string;
  detailsLabel: string;
  reasonLabel?: string;
}) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {subtitle}
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 700 }}>{categoryLabel}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{detailsLabel}</TableCell>
              {!twoColumn && reasonLabel ? (
                <TableCell sx={{ fontWeight: 700 }}>{reasonLabel}</TableCell>
              ) : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.category} hover>
                <TableCell sx={{ fontWeight: 600, verticalAlign: 'top' }}>
                  {row.category}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', verticalAlign: 'top' }}>
                  {row.detail}
                </TableCell>
                {!twoColumn && row.reason ? (
                  <TableCell sx={{ color: 'text.secondary', verticalAlign: 'top' }}>
                    {row.reason}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default ProfileDeleteRequestPage;
