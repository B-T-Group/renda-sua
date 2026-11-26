import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import { Box, Chip, IconButton, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BusinessRentalRequestRow } from '../../hooks/useRentalApi';
import { requestPhotoUrl, respondWithinAmber, respondWithinHours } from '../../utils/dashboardRentalRequests';
import { buildRequestCardModel, type RequestCardModel } from '../../utils/rentalRequestCardModel';

export function BusinessDashboardRentalRequestCard({
  request,
  onAccept,
  onDecline,
}: {
  request: BusinessRentalRequestRow;
  onAccept: (request: BusinessRentalRequestRow) => void;
  onDecline: (request: BusinessRentalRequestRow) => void;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const model = buildRequestCardModel(request, i18n.language, new Date(), t);
  const hours = request.respond_by ? respondWithinHours(request.respond_by) : 0;
  const amber = request.respond_by ? respondWithinAmber(request.respond_by) : false;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 1.5,
        alignItems: { xs: 'stretch', sm: 'flex-start' },
        p: 1.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
        <ItemThumb request={request} />
        <CardCopy model={model} hours={hours} amber={amber} open={open} onToggle={() => setOpen((value) => !value)} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'flex-start' } }}>
        <DecisionButtons request={request} disabled={model.acceptDisabled} onAccept={onAccept} onDecline={onDecline} />
      </Box>
    </Box>
  );
}

function CardCopy({
  model,
  hours,
  amber,
  open,
  onToggle,
}: {
  model: RequestCardModel;
  hours: number;
  amber: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <CardChips model={model} />
      <Typography fontWeight={800} noWrap>{model.itemName}{model.quantity ? ` × ${model.quantity}` : ''}</Typography>
      {model.renterName ? <Typography variant="body2" noWrap>{model.renterName}</Typography> : null}
      {model.place ? <Typography variant="body2" color="text.secondary" noWrap>{model.place}</Typography> : null}
      <ScheduleLine model={model} open={open} onToggle={onToggle} />
      {model.receiveLine ? (
        <Typography fontWeight={800} color={model.expired ? 'text.secondary' : 'text.primary'}>
          {model.receiveLine}
        </Typography>
      ) : null}
      {model.breakdown ? <Typography variant="caption" color="text.secondary">{model.breakdown}</Typography> : null}
      {model.depositAmount ? <Typography variant="caption" display="block">{t('rentals.requestCard.deposit', 'Deposit {{amount}}', { amount: model.depositAmount })}</Typography> : null}
      {model.changeDetail ? <Typography variant="caption" color="info.main" display="block">{t('rentals.modify.changed', 'Changed: {{detail}}', { detail: model.changeDetail })}</Typography> : null}
      <Countdown hours={hours} amber={amber} />
      {model.sentClock ? <Typography variant="caption" color="text.secondary" display="block">{t('rentals.requestCard.sent', 'Sent {{time}}', { time: model.sentClock })}</Typography> : null}
    </Box>
  );
}

function ItemThumb({ request }: { request: Parameters<typeof requestPhotoUrl>[0] }) {
  const url = requestPhotoUrl(request);
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <Box
        component="img"
        src={url}
        alt=""
        onError={() => setFailed(true)}
        sx={{ width: 56, height: 56, borderRadius: 1.5, objectFit: 'cover', flexShrink: 0, bgcolor: 'action.hover' }}
      />
    );
  }
  const Icon = categoryIcon(request.rental_location_listing.rental_item.rental_category?.name || request.rental_location_listing.rental_item.name);
  return (
    <Box sx={{ width: 56, height: 56, borderRadius: 1.5, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon color="action" />
    </Box>
  );
}

function categoryIcon(name: string) {
  if (/camera|photo|caméra|appareil/i.test(name)) return PhotoCameraOutlinedIcon;
  if (/equipment|équipement|equipement|tool|outil|light/i.test(name)) return HandymanOutlinedIcon;
  if (/power|électr|electr|éclair/i.test(name)) return BoltOutlinedIcon;
  return CategoryOutlinedIcon;
}

function CardChips({ model }: { model: RequestCardModel }) {
  const { t } = useTranslation();
  if (model.expired) {
    return (
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          data-testid="rental-request-expired-chip"
          label={t('rentals.requestCard.expired', 'Expired')}
          sx={{ bgcolor: 'action.hover', color: 'text.secondary', fontWeight: 800 }}
        />
      </Stack>
    );
  }
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      <Chip size="small" label={t('business.dashboard.rentalRequests.requested', 'Requested')} />
      {model.startsIn?.kind === 'today' ? <Chip size="small" color="info" label={t('rentals.requestCard.startsToday', 'Starts today')} /> : null}
      {model.startsIn?.kind === 'days' ? <Chip size="small" label={t('rentals.requestCard.startsIn', 'Starts in {{count}} days', { count: model.startsIn.count })} /> : null}
      {model.updated ? <Chip size="small" color="info" label={t('business.dashboard.rentalRequests.updated', 'Updated')} /> : null}
      {model.acceptDisabled ? <Chip size="small" color="warning" label={t('rentals.requestCard.alreadyBooked', 'These dates are already booked')} /> : null}
    </Stack>
  );
}

function ScheduleLine({ model, open, onToggle }: { model: RequestCardModel; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  if (!model.schedule.summary) return null;
  return (
    <Box>
      <Typography
        variant="body2"
        component={model.schedule.expandable ? 'button' : 'p'}
        onClick={model.schedule.expandable ? onToggle : undefined}
        aria-label={model.schedule.expandable ? t('rentals.requestCard.seeTimesA11y', 'Show each time') : undefined}
        sx={{ m: 0, p: 0, border: 0, bgcolor: 'transparent', textAlign: 'left', whiteSpace: 'nowrap', cursor: model.schedule.expandable ? 'pointer' : 'default' }}
      >
        {open ? t('rentals.requestCard.hideTimes', 'Hide times') : model.schedule.summary}
      </Typography>
      {open ? model.schedule.lines.map((line) => <Typography key={line} variant="caption" display="block">{line}</Typography>) : null}
    </Box>
  );
}

function Countdown({ hours, amber }: { hours: number; amber: boolean }) {
  const { t } = useTranslation();
  if (hours <= 0) return null;
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: amber ? 'warning.dark' : 'text.secondary' }}>
      <AccessTimeIcon sx={{ fontSize: 16 }} />
      <Typography variant="body2" fontWeight={800}>
        {t('business.dashboard.rentalRequests.respondWithin', 'Respond within {{hours}}h', { hours })}
      </Typography>
    </Stack>
  );
}

function DecisionButtons({
  request,
  disabled,
  onAccept,
  onDecline,
}: {
  request: BusinessRentalRequestRow;
  disabled: boolean;
  onAccept: (request: BusinessRentalRequestRow) => void;
  onDecline: (request: BusinessRentalRequestRow) => void;
}) {
  const { t } = useTranslation();
  const acceptLabel = disabled
    ? t('rentals.requestCard.acceptUnavailable', 'Accept unavailable — dates are taken')
    : t('business.dashboard.rentalRequests.accept', 'Accept');
  return (
    <Stack direction="row" spacing={1} data-testid="rental-request-actions">
      <IconButton data-testid="rental-request-decline" aria-label={t('business.dashboard.rentalRequests.decline', 'Decline')} color="error" onClick={() => onDecline(request)} sx={{ border: 1, borderColor: 'divider' }}>
        <CloseIcon />
      </IconButton>
      <IconButton data-testid="rental-request-accept" aria-label={acceptLabel} disabled={disabled} color="success" onClick={() => onAccept(request)} sx={{ bgcolor: 'success.main', color: 'common.white', '&:hover': { bgcolor: 'success.dark' } }}>
        <CheckIcon />
      </IconButton>
    </Stack>
  );
}
