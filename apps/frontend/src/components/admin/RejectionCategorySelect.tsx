import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  REJECTION_CATEGORIES,
  type RejectionCategory,
} from '../../types/itemRejectionRecovery';
import {
  categoryDefaultLabel,
  categoryLabelKey,
} from '../../utils/itemRejectionRecovery';

type Props = {
  value: RejectionCategory | '';
  onChange: (value: RejectionCategory | '') => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
};

export function RejectionCategorySelect({
  value,
  onChange,
  disabled,
  required = true,
  label,
}: Props) {
  const { t } = useTranslation();
  const fieldLabel =
    label ?? t('admin.itemModeration.rejectionCategory', 'Rejection category');
  return (
    <FormControl fullWidth required={required} disabled={disabled} sx={{ mb: 2 }}>
      <InputLabel>{fieldLabel}</InputLabel>
      <Select
        label={fieldLabel}
        value={value}
        onChange={(e) => onChange(e.target.value as RejectionCategory | '')}
      >
        {!required ? (
          <MenuItem value="">
            {t('admin.itemAppeals.allCategories', 'All categories')}
          </MenuItem>
        ) : null}
        {REJECTION_CATEGORIES.map((category) => (
          <MenuItem key={category} value={category}>
            {t(categoryLabelKey(category), categoryDefaultLabel(category))}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
