import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { AppealEvidence } from '../../../types/itemRejectionRecovery';
import { isAppealEvidenceExpired } from '../../../utils/itemRejectionRecovery';

type Props = {
  evidence: AppealEvidence[] | null | undefined;
  onExpired: () => void;
};

export function AppealEvidenceGallery({ evidence, onExpired }: Props) {
  const { t } = useTranslation();
  if (!evidence?.length) return null;
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
      {evidence.map((item) => (
        <Box
          key={item.key}
          component="img"
          src={item.url}
          alt={t('business.items.recovery.appeal.evidencePhoto', 'Appeal evidence')}
          onError={() => {
            if (isAppealEvidenceExpired(item.expiresAt)) onExpired();
          }}
          sx={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 1 }}
        />
      ))}
    </Box>
  );
}
