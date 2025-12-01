import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { DeliveryTimeSlotRow } from '../../hooks/useApplicationSetup';

const renderTimeRange = (slot: DeliveryTimeSlotRow, t: (k: string, d: string) => string) => (
  <Box sx={{ display: 'flex', gap: 1 }}>
    <TextField
      fullWidth
      type="time"
      size="small"
      label={t('admin.applicationSetup.startTime', 'Start time')}
      value={slot.start_time}
      InputLabelProps={{ shrink: true }}
      inputProps={{ readOnly: true }}
    />
    <TextField
      fullWidth
      type="time"
      size="small"
      label={t('admin.applicationSetup.endTime', 'End time')}
      value={slot.end_time}
      InputLabelProps={{ shrink: true }}
      inputProps={{ readOnly: true }}
    />
  </Box>
);

interface DeliveryTimeSlotsSectionProps {
  slots: DeliveryTimeSlotRow[];
}

export const DeliveryTimeSlotsSection: React.FC<
  DeliveryTimeSlotsSectionProps
> = ({ slots }) => {
  const { t } = useTranslation();

  const uniqueStates = React.useMemo(
    () =>
      Array.from(
        new Set(
          slots
            .map((slot) => slot.state)
            .filter((state): state is string => !!state && state.trim() !== '')
        )
      ),
    [slots]
  );

  const [stateFilter, setStateFilter] = React.useState<string>(
    uniqueStates[0] || ''
  );

  const filteredSlots = React.useMemo(
    () =>
      !stateFilter
        ? slots
        : slots.filter((slot) => (slot.state || '') === stateFilter),
    [slots, stateFilter]
  );

  if (!slots.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t(
          'admin.applicationSetup.noTimeSlots',
          'No delivery time slots configured for this country.'
        )}
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {t(
          'admin.applicationSetup.timeSlotsTitle',
          'Delivery time slots'
        )}
      </Typography>

      <Card>
        <CardContent>
          {uniqueStates.length > 0 && (
            <Box sx={{ mb: 2, maxWidth: 320 }}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t('admin.applicationSetup.state', 'State/Province')}
                </InputLabel>
                <Select
                  label={t(
                    'admin.applicationSetup.state',
                    'State/Province'
                  )}
                  value={stateFilter}
                  onChange={(event) =>
                    setStateFilter(event.target.value as string)
                  }
                >
                  {uniqueStates.map((state) => (
                    <MenuItem key={state} value={state}>
                      {state}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  {t('admin.applicationSetup.slotName', 'Slot')}
                </TableCell>
                <TableCell>
                  {t('admin.applicationSetup.slotType', 'Type')}
                </TableCell>
                <TableCell>
                  {t('admin.applicationSetup.state', 'State/Province')}
                </TableCell>
                <TableCell>
                  {t('admin.applicationSetup.timeRange', 'Time range')}
                </TableCell>
                <TableCell>
                  {t('admin.applicationSetup.capacity', 'Capacity')}
                </TableCell>
                <TableCell>
                  {t('admin.applicationSetup.displayOrder', 'Order')}
                </TableCell>
                <TableCell>
                  {t('admin.applicationSetup.active', 'Active')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSlots.map((slot) => (
                <TableRow key={slot.id}>
                  <TableCell>{slot.slot_name}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={
                        slot.slot_type === 'fast'
                          ? t(
                              'admin.applicationSetup.fastSlot',
                              'Fast delivery'
                            )
                          : t(
                              'admin.applicationSetup.standardSlot',
                              'Standard delivery'
                            )
                      }
                      color={slot.slot_type === 'fast' ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{slot.state || '-'}</TableCell>
                  <TableCell>{renderTimeRange(slot, t)}</TableCell>
                  <TableCell>{slot.max_orders_per_slot ?? '-'}</TableCell>
                  <TableCell>{slot.display_order ?? '-'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={
                        slot.is_active
                          ? t('admin.applicationSetup.yes', 'Yes')
                          : t('admin.applicationSetup.no', 'No')
                      }
                      color={slot.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
};


