import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

const PRIVACY_POLICY_URL = 'https://rendasua.com/privacy';

type Props = {
  open: boolean;
  saving?: boolean;
  onAccept: () => void;
  onDefer: () => void;
};

export default function AgentLocationDisclosureModal({
  open,
  saving,
  onAccept,
  onDefer,
}: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle>
        {t('agent.locationTracking.disclosureTitle', 'Location data disclosure')}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" paragraph>
          {t(
            'agent.locationTracking.disclosureProminent',
            "Rendasua collects, transmits, and stores your device's precise location data to enable finding nearby open delivery orders and live delivery tracking for customers."
          )}
        </Typography>
        <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 600 }}>
          {t('agent.locationTracking.disclosureHowUsedTitle', 'How your location is used')}
        </Typography>
        <Typography variant="body2" component="ul" sx={{ pl: 2, mt: 1 }}>
          <li>
            {t(
              'agent.locationTracking.disclosureUseCaseNearbyFull',
              'Nearby orders: to show open orders near you when you browse available deliveries.'
            )}
          </li>
          <li>
            {t(
              'agent.locationTracking.disclosureUseCaseDeliveryFull',
              'Active deliveries: to share your live position with customers on orders you are delivering.'
            )}
          </li>
        </Typography>
        <Typography variant="body2" sx={{ mt: 2 }}>
          {t(
            'agent.locationTracking.disclosureSharingBody',
            'Location data is sent to Rendasua servers and shared with customers only for orders you are delivering or viewing. It is not used for advertising.'
          )}
        </Typography>
        <Link href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" sx={{ mt: 2, display: 'inline-block' }}>
          {t('agent.locationTracking.privacyPolicyLink', 'Privacy Policy')}
        </Link>
      </DialogContent>
      <DialogActions>
        <Button onClick={onDefer} disabled={saving}>
          {t('agent.locationTracking.disclosureDecline', 'Not now')}
        </Button>
        <Button variant="contained" onClick={onAccept} disabled={saving}>
          {t('agent.locationTracking.disclosureAgree', 'I agree')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
