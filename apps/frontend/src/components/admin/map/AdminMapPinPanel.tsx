import { Close as CloseIcon } from '@mui/icons-material';
import { Box, Chip, IconButton, Link, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminMapPin } from './adminMap.types';
import { pinColor } from './adminMapMarker';

interface AdminMapPinPanelProps {
  pin: AdminMapPin;
  onClose: () => void;
}

const AdminMapPinPanel: React.FC<AdminMapPinPanelProps> = ({ pin, onClose }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2, width: { xs: '100%', md: 320 }, borderLeft: 1, borderColor: 'divider' }}>
      <PanelHeader pin={pin} onClose={onClose} closeLabel={t('admin.map.close', 'Close')} />
      <ContactRows pin={pin} />
    </Box>
  );
};

function PanelHeader({
  pin,
  onClose,
  closeLabel,
}: AdminMapPinPanelProps & { closeLabel: string }) {
  const { t } = useTranslation();
  const activity = t(`admin.map.activity.${pin.activity}`, pin.activity);
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
      <Box>
        <Typography variant="h6">{pin.title}</Typography>
        {pin.subtitle && pin.subtitle !== pin.title ? (
          <Typography variant="body2" color="text.secondary">{pin.subtitle}</Typography>
        ) : null}
        <Chip size="small" label={activity} sx={{ mt: 1, bgcolor: pinColor(pin.activity), color: '#fff' }} />
      </Box>
      <IconButton aria-label={closeLabel} onClick={onClose}><CloseIcon /></IconButton>
    </Stack>
  );
}

function ContactRows({ pin }: { pin: AdminMapPin }) {
  const { t } = useTranslation();
  return (
    <Stack spacing={1.5} sx={{ mt: 2 }}>
      <ContactLink label={t('admin.map.phone', 'Phone')} value={pin.phone} href={pin.phone ? `tel:${pin.phone}` : null} />
      <ContactLink label={t('admin.map.email', 'Email')} value={pin.email} href={pin.email ? `mailto:${pin.email}` : null} />
      <TextRow label={t('admin.map.address', 'Address')} value={pin.addressLine} />
      <PositionRow pin={pin} />
    </Stack>
  );
}

function ContactLink({ label, value, href }: { label: string; value: string | null; href: string | null }) {
  if (!value || !href) return null;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Link href={href} display="block">{value}</Link>
    </Box>
  );
}

function TextRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

function PositionRow({ pin }: { pin: AdminMapPin }) {
  const { t } = useTranslation();
  if (pin.kind !== 'agent') return null;
  const source = pin.positionSource === 'live_gps'
    ? t('admin.map.positionLive', 'Live GPS')
    : t('admin.map.positionAddress', 'Registered address');
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{source}</Typography>
      {pin.lastSeenAt ? (
        <Typography variant="body2">
          {t('admin.map.lastSeen', 'Last position')}: {new Date(pin.lastSeenAt).toLocaleString()}
        </Typography>
      ) : null}
    </Box>
  );
}

export default AdminMapPinPanel;
