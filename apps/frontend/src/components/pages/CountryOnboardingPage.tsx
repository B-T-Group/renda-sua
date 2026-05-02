import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  CountryOnboardingConfig,
  useCountryOnboardingConfig,
} from '../../hooks/useCountryOnboardingConfig';
import { useCountryStateCity } from '../../hooks/useCountryStateCity';
import {
  ServiceHoursEditor,
  type ServiceHoursValue,
} from '../admin/ServiceHoursEditor';
import LoadingScreen from '../common/LoadingScreen';
import SEOHead from '../seo/SEOHead';

const CountryOnboardingPage: React.FC = () => {
  const { t } = useTranslation();
  const { module: countryStateCity } = useCountryStateCity();
  const { profile, loading, error } = useUserProfileContext();
  const {
    data,
    loading: loadingConfig,
    error: configError,
    fetchConfig,
    applyConfig,
    applying,
  } = useCountryOnboardingConfig();
  const [countryCode, setCountryCode] = useState<string>('GA');
  const [step, setStep] = useState(0);
  const [workingConfig, setWorkingConfig] = useState<CountryOnboardingConfig | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const steps = [
    t('admin.countryOnboarding.stepCountry', 'Country'),
    t('admin.countryOnboarding.stepDeliveryConfig', 'Delivery config'),
    t('admin.countryOnboarding.stepFastHours', 'Fast delivery hours'),
    t('admin.countryOnboarding.stepTimeSlots', 'Time slots'),
    t('admin.countryOnboarding.stepStates', 'Supported states'),
    t('admin.countryOnboarding.stepReview', 'Review'),
  ];

  const countries = useMemo(
    () =>
      countryStateCity
        ? countryStateCity.Country.getAllCountries().map((c) => ({
            code: c.isoCode,
            name: c.name,
          }))
        : [],
    [countryStateCity]
  );

  const statesForCountry = useMemo(
    () =>
      countryStateCity
        ? countryStateCity.State.getStatesOfCountry(countryCode).map((s) => s.name)
        : [],
    [countryStateCity, countryCode]
  );

  useEffect(() => {
    fetchConfig(countryCode);
  }, [countryCode, fetchConfig]);

  useEffect(() => {
    if (data) {
      setWorkingConfig(data);
    } else {
      const emptyConfig: CountryOnboardingConfig = {
        countryCode,
        countryDeliveryConfig: null,
        deliveryTimeSlots: [],
        supportedStates: [],
      };
      setWorkingConfig(emptyConfig);
    }
  }, [data, countryCode]);

  const updateCountryConfig = (
    configKey: string,
    field: 'config_value',
    value: string
  ) => {
    setWorkingConfig((prev) => {
      if (!prev || !prev.countryDeliveryConfig) return prev;
      const configs = prev.countryDeliveryConfig.configs.map((c) =>
        c.config_key === configKey
          ? {
              ...c,
              [field]: value,
            }
          : c
      );
      return {
        ...prev,
        countryDeliveryConfig: {
          ...prev.countryDeliveryConfig,
          configs,
        },
      };
    });
  };

  const updateTimeSlot = (
    index: number,
    field:
      | 'slot_name'
      | 'slot_type'
      | 'state'
      | 'start_time'
      | 'end_time'
      | 'max_orders_per_slot'
      | 'display_order',
    value: string
  ) => {
    setWorkingConfig((prev) => {
      if (!prev) return prev;
      const slots = prev.deliveryTimeSlots.map((slot, i) =>
        i === index
          ? {
              ...slot,
              [field]:
                field === 'max_orders_per_slot' || field === 'display_order'
                  ? value === ''
                    ? null
                    : Number(value)
                  : value,
            }
          : slot
      );
      return { ...prev, deliveryTimeSlots: slots };
    });
  };

  const updateSupportedState = (
    index: number,
    field: 'state_name' | 'service_status' | 'delivery_enabled',
    value: string | boolean
  ) => {
    setWorkingConfig((prev) => {
      if (!prev) return prev;
      const states = prev.supportedStates.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      );
      return { ...prev, supportedStates: states };
    });
  };

  if (loading) {
    return <LoadingScreen open />;
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h6" color="error">
          {t('common.error', 'Error')}: {error}
        </Typography>
      </Container>
    );
  }

  if (!profile?.business || !profile.business.is_admin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h6" color="error">
          {t(
            'admin.countryOnboarding.unauthorized',
            'You are not authorized to access the country onboarding page'
          )}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t(
          'admin.countryOnboarding.pageTitle',
          'Country onboarding configuration'
        )}
        description={t(
          'admin.countryOnboarding.pageDescription',
          'Configure and review rollout settings for a specific country before applying them.'
        )}
        keywords={t(
          'admin.countryOnboarding.pageKeywords',
          'admin, country, onboarding, configuration, delivery'
        )}
      />

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t(
            'admin.countryOnboarding.pageTitle',
            'Country onboarding configuration'
          )}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t(
            'admin.countryOnboarding.pageSubtitle',
            'Use the multi-step wizard to configure delivery time slots, delivery configs, and supported states for a selected country.'
          )}
        </Typography>
      </Box>

      {error && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error">
            {t('common.error', 'Error')}: {error}
          </Alert>
        </Box>
      )}

      {configError && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error">
            {t('common.error', 'Error')}: {configError}
          </Alert>
        </Box>
      )}

      {applyError && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error">
            {t('common.error', 'Error')}: {applyError}
          </Alert>
        </Box>
      )}

      {loadingConfig && <LoadingScreen open />}

      {workingConfig && (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                {t(
                  'admin.countryOnboarding.countrySelection',
                  'Select country to configure'
                )}
              </Typography>
              <FormControl size="small" sx={{ minWidth: 220, mr: 2 }}>
                <InputLabel>
                  {t('admin.countryOnboarding.countryLabel', 'Country')}
                </InputLabel>
                <Select
                  label={t('admin.countryOnboarding.countryLabel', 'Country')}
                  value={countryCode}
                  onChange={(event) => {
                    setStep(0);
                    setCountryCode(event.target.value as string);
                  }}
                >
                  {countries.map((country) => (
                    <MenuItem key={country.code} value={country.code}>
                      {country.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="body2" component="span">
                {countries.find((c) => c.code === countryCode)?.name ||
                  countryCode}
              </Typography>
            </CardContent>
          </Card>

          <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box sx={{ mb: 3 }}>
            {step === 0 && (
              <Card>
                <CardContent>
                  <Typography variant="body1" color="text.secondary">
                    {t(
                      'admin.countryOnboarding.countryStepDescription',
                      'Use the main application setup page to manage country-level delivery configurations. This wizard focuses on reviewing and applying all settings together.'
                    )}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {step === 1 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {t(
                      'admin.countryOnboarding.deliveryConfigTitle',
                      'Country delivery configuration'
                    )}
                  </Typography>
                  {workingConfig.countryDeliveryConfig &&
                  workingConfig.countryDeliveryConfig.configs.filter(
                    (config) =>
                      config.config_key !== 'fast_delivery_service_hours' &&
                      config.config_key !== 'timezone'
                  ).length > 0 ? (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            {t(
                              'admin.countryOnboarding.configDescription',
                              'Configuration'
                            )}
                          </TableCell>
                          <TableCell>
                            {t('admin.countryOnboarding.configValue', 'Value')}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {workingConfig.countryDeliveryConfig.configs
                          .filter(
                            (config) =>
                              config.config_key !==
                                'fast_delivery_service_hours' &&
                              config.config_key !== 'timezone'
                          )
                          .map((config) => (
                            <TableRow key={config.config_key}>
                              <TableCell>
                                <Typography variant="body2">
                                  {config.description || config.config_key}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block' }}
                                >
                                  {config.config_key}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {config.data_type === 'boolean' ? (
                                  <FormControl size="small" fullWidth>
                                    <Select
                                      value={
                                        config.config_value === 'true'
                                          ? 'true'
                                          : 'false'
                                      }
                                      onChange={(e) =>
                                        updateCountryConfig(
                                          config.config_key,
                                          'config_value',
                                          e.target.value as string
                                        )
                                      }
                                    >
                                      <MenuItem value="true">
                                        {t('common.yes', 'Yes')}
                                      </MenuItem>
                                      <MenuItem value="false">
                                        {t('common.no', 'No')}
                                      </MenuItem>
                                    </Select>
                                  </FormControl>
                                ) : config.config_key === 'currency' ? (
                                  <FormControl size="small" fullWidth>
                                    <Select
                                      value={config.config_value}
                                      onChange={(e) =>
                                        updateCountryConfig(
                                          config.config_key,
                                          'config_value',
                                          e.target.value as string
                                        )
                                      }
                                    >
                                      <MenuItem value="XAF">XAF</MenuItem>
                                      <MenuItem value="XOF">XOF</MenuItem>
                                      <MenuItem value="USD">USD</MenuItem>
                                      <MenuItem value="EUR">EUR</MenuItem>
                                      <MenuItem value="CAD">CAD</MenuItem>
                                    </Select>
                                  </FormControl>
                                ) : (
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type={
                                      config.data_type === 'number'
                                        ? 'number'
                                        : 'text'
                                    }
                                    value={config.config_value}
                                    onChange={(e) =>
                                      updateCountryConfig(
                                        config.config_key,
                                        'config_value',
                                        e.target.value
                                      )
                                    }
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'admin.countryOnboarding.noCountryConfigs',
                        'No country delivery configurations found for this country.'
                      )}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {t(
                      'admin.countryOnboarding.fastHoursTitle',
                      'Fast delivery service hours'
                    )}
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <FormControl size="small" sx={{ minWidth: 260 }}>
                      <InputLabel>
                        {t(
                          'admin.countryOnboarding.timezoneLabel',
                          'Timezone (IANA)'
                        )}
                      </InputLabel>
                      <Select
                        label={t(
                          'admin.countryOnboarding.timezoneLabel',
                          'Timezone (IANA)'
                        )}
                        value={
                          workingConfig.countryDeliveryConfig?.configs.find(
                            (c) => c.config_key === 'timezone'
                          )?.config_value || 'Africa/Libreville'
                        }
                        onChange={(event) => {
                          const value = event.target.value as string;
                          setWorkingConfig((prev) => {
                            if (!prev) return prev;
                            const current =
                              prev.countryDeliveryConfig?.configs || [];
                            const idx = current.findIndex(
                              (c) => c.config_key === 'timezone'
                            );
                            const nextConfigs =
                              idx === -1
                                ? [
                                    ...current,
                                    {
                                      config_key: 'timezone',
                                      config_value: value,
                                      data_type: 'string' as const,
                                    },
                                  ]
                                : current.map((c, i) =>
                                    i === idx
                                      ? {
                                          ...c,
                                          config_value: value,
                                          data_type: 'string' as const,
                                        }
                                      : c
                                  );
                            return {
                              ...prev,
                              countryDeliveryConfig: {
                                country_code: prev.countryCode,
                                configs: nextConfigs,
                              },
                            };
                          });
                        }}
                      >
                        <MenuItem value="Africa/Libreville">
                          Africa/Libreville
                        </MenuItem>
                        <MenuItem value="Africa/Douala">Africa/Douala</MenuItem>
                        <MenuItem value="Africa/Lagos">Africa/Lagos</MenuItem>
                        <MenuItem value="Africa/Johannesburg">
                          Africa/Johannesburg
                        </MenuItem>
                        <MenuItem value="UTC">UTC</MenuItem>
                        <MenuItem value="Europe/Paris">Europe/Paris</MenuItem>
                        <MenuItem value="America/New_York">
                          America/New_York
                        </MenuItem>
                        <MenuItem value="America/Toronto">
                          America/Toronto
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  <ServiceHoursEditor
                    value={((): ServiceHoursValue => {
                      const jsonConfig =
                        workingConfig.countryDeliveryConfig?.configs.find(
                          (c) => c.config_key === 'fast_delivery_service_hours'
                        );
                      if (!jsonConfig || jsonConfig.data_type !== 'json') {
                        return {};
                      }
                      try {
                        const parsed = JSON.parse(
                          jsonConfig.config_value
                        ) as ServiceHoursValue;
                        return parsed || {};
                      } catch {
                        return {};
                      }
                    })()}
                    onChange={(value) => {
                      setWorkingConfig((prev) => {
                        if (!prev) return prev;
                        const current =
                          prev.countryDeliveryConfig?.configs || [];
                        const idx = current.findIndex(
                          (c) => c.config_key === 'fast_delivery_service_hours'
                        );
                        const jsonValue = JSON.stringify(value);
                        const nextConfigs =
                          idx === -1
                            ? [
                                ...current,
                                {
                                  config_key: 'fast_delivery_service_hours',
                                  config_value: jsonValue,
                                  data_type: 'json' as const,
                                },
                              ]
                            : current.map((c, i) =>
                                i === idx
                                  ? {
                                      ...c,
                                      config_value: jsonValue,
                                      data_type: 'json' as const,
                                    }
                                  : c
                              );
                        return {
                          ...prev,
                          countryDeliveryConfig: {
                            country_code: prev.countryCode,
                            configs: nextConfigs,
                          },
                        };
                      });
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {t(
                      'admin.countryOnboarding.timeSlotsTitle',
                      'Delivery time slots'
                    )}
                  </Typography>
                  {workingConfig.deliveryTimeSlots.length > 0 ? (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            {t('admin.countryOnboarding.slotName', 'Slot')}
                          </TableCell>
                          <TableCell>
                            {t('admin.countryOnboarding.slotType', 'Type')}
                          </TableCell>
                          <TableCell>
                            {t(
                              'admin.countryOnboarding.slotState',
                              'State/Province'
                            )}
                          </TableCell>
                          <TableCell>
                            {t(
                              'admin.countryOnboarding.slotTimeRange',
                              'Time range'
                            )}
                          </TableCell>
                          <TableCell>
                            {t(
                              'admin.countryOnboarding.slotCapacity',
                              'Capacity'
                            )}
                          </TableCell>
                          <TableCell>
                            {t(
                              'admin.countryOnboarding.slotOrder',
                              'Display order'
                            )}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {workingConfig.deliveryTimeSlots.map((slot, index) => (
                          <TableRow
                            key={
                              slot.id ??
                              `${slot.slot_name}-${slot.start_time}-${slot.end_time}`
                            }
                          >
                            <TableCell>
                              <TextField
                                fullWidth
                                size="small"
                                value={slot.slot_name}
                                onChange={(e) =>
                                  updateTimeSlot(
                                    index,
                                    'slot_name',
                                    e.target.value
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <FormControl size="small" fullWidth>
                                <Select
                                  value={slot.slot_type}
                                  onChange={(e) =>
                                    updateTimeSlot(
                                      index,
                                      'slot_type',
                                      e.target.value as string
                                    )
                                  }
                                >
                                  <MenuItem value="standard">
                                    {t(
                                      'admin.countryOnboarding.slotTypeStandard',
                                      'Standard'
                                    )}
                                  </MenuItem>
                                  <MenuItem value="fast">
                                    {t(
                                      'admin.countryOnboarding.slotTypeFast',
                                      'Fast'
                                    )}
                                  </MenuItem>
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell>
                              <FormControl size="small" fullWidth>
                                <Select
                                  value={slot.state ?? ''}
                                  displayEmpty
                                  onChange={(e) =>
                                    updateTimeSlot(
                                      index,
                                      'state',
                                      e.target.value as string
                                    )
                                  }
                                >
                                  <MenuItem value="">
                                    {t('common.all', 'All')}
                                  </MenuItem>
                                  {statesForCountry.map((state) => (
                                    <MenuItem key={state} value={state}>
                                      {state}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <TextField
                                  type="time"
                                  size="small"
                                  fullWidth
                                  value={slot.start_time}
                                  onChange={(e) =>
                                    updateTimeSlot(
                                      index,
                                      'start_time',
                                      e.target.value
                                    )
                                  }
                                  InputLabelProps={{ shrink: true }}
                                />
                                <TextField
                                  type="time"
                                  size="small"
                                  fullWidth
                                  value={slot.end_time}
                                  onChange={(e) =>
                                    updateTimeSlot(
                                      index,
                                      'end_time',
                                      e.target.value
                                    )
                                  }
                                  InputLabelProps={{ shrink: true }}
                                />
                              </Box>
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                fullWidth
                                value={slot.max_orders_per_slot ?? ''}
                                onChange={(e) =>
                                  updateTimeSlot(
                                    index,
                                    'max_orders_per_slot',
                                    e.target.value
                                  )
                                }
                                inputProps={{ min: 0 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                fullWidth
                                value={slot.display_order ?? ''}
                                onChange={(e) =>
                                  updateTimeSlot(
                                    index,
                                    'display_order',
                                    e.target.value
                                  )
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'admin.countryOnboarding.noTimeSlots',
                        'No delivery time slots configured for this country.'
                      )}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )}

            {step === 4 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {t(
                      'admin.countryOnboarding.statesTitle',
                      'Supported states'
                    )}
                  </Typography>
                  {workingConfig.supportedStates.length > 0 ? (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            {t(
                              'admin.countryOnboarding.stateName',
                              'State/Province'
                            )}
                          </TableCell>
                          <TableCell>
                            {t(
                              'admin.countryOnboarding.stateStatus',
                              'Service status'
                            )}
                          </TableCell>
                          <TableCell>
                            {t(
                              'admin.countryOnboarding.stateDeliveryEnabled',
                              'Delivery enabled'
                            )}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {workingConfig.supportedStates.map((state, index) => (
                          <TableRow key={state.id ?? state.state_name}>
                            <TableCell>
                              <FormControl size="small" fullWidth>
                                <Select
                                  value={state.state_name}
                                  onChange={(e) =>
                                    updateSupportedState(
                                      index,
                                      'state_name',
                                      e.target.value as string
                                    )
                                  }
                                >
                                  {statesForCountry.map((name) => (
                                    <MenuItem key={name} value={name}>
                                      {name}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell>
                              <FormControl size="small" fullWidth>
                                <Select
                                  value={state.service_status}
                                  onChange={(e) =>
                                    updateSupportedState(
                                      index,
                                      'service_status',
                                      e.target.value as string
                                    )
                                  }
                                >
                                  <MenuItem value="active">
                                    {t('common.active', 'Active')}
                                  </MenuItem>
                                  <MenuItem value="coming_soon">
                                    {t(
                                      'admin.countryOnboarding.statusComingSoon',
                                      'Coming soon'
                                    )}
                                  </MenuItem>
                                  <MenuItem value="suspended">
                                    {t(
                                      'admin.countryOnboarding.statusSuspended',
                                      'Suspended'
                                    )}
                                  </MenuItem>
                                  <MenuItem value="inactive">
                                    {t(
                                      'admin.countryOnboarding.statusInactive',
                                      'Inactive'
                                    )}
                                  </MenuItem>
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="small"
                                variant={state.delivery_enabled ? 'contained' : 'outlined'}
                                color={state.delivery_enabled ? 'success' : 'inherit'}
                                onClick={() =>
                                  updateSupportedState(
                                    index,
                                    'delivery_enabled',
                                    !state.delivery_enabled
                                  )
                                }
                              >
                                {state.delivery_enabled
                                  ? t('common.yes', 'Yes')
                                  : t('common.no', 'No')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'admin.countryOnboarding.noStates',
                        'No supported states configured for this country.'
                      )}
                    </Typography>
                  )}
                  {statesForCountry.length > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      {t(
                        'admin.countryOnboarding.availableStatesHint',
                        'Available states from reference data: {{count}}',
                        { count: statesForCountry.length }
                      )}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )}

            {step === 5 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {t(
                      'admin.countryOnboarding.reviewTitle',
                      'Review configuration'
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t(
                      'admin.countryOnboarding.reviewCountry',
                      'Country: {{country}}',
                      {
                        country:
                          countries.find((c) => c.code === countryCode)?.name ||
                          countryCode,
                      }
                    )}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      {t(
                        'admin.countryOnboarding.reviewCountryConfigs',
                        'Country delivery configuration'
                      )}
                    </Typography>
                    {workingConfig.countryDeliveryConfig &&
                    workingConfig.countryDeliveryConfig.configs.filter(
                      (config) =>
                        config.config_key !== 'fast_delivery_service_hours' &&
                        config.config_key !== 'timezone'
                    ).length > 0 ? (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>
                              {t(
                                'admin.countryOnboarding.configDescription',
                                'Configuration'
                              )}
                            </TableCell>
                            <TableCell>
                              {t(
                                'admin.countryOnboarding.configValue',
                                'Value'
                              )}
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {workingConfig.countryDeliveryConfig.configs
                            .filter(
                              (config) =>
                                config.config_key !==
                                  'fast_delivery_service_hours' &&
                                config.config_key !== 'timezone'
                            )
                            .map((config) => (
                              <TableRow key={config.config_key}>
                                <TableCell>
                                  <Typography variant="body2">
                                    {config.description || config.config_key}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {config.config_key === 'currency'
                                      ? config.config_value
                                      : config.config_value}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {t(
                          'admin.countryOnboarding.noCountryConfigs',
                          'No country delivery configurations found for this country.'
                        )}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      {t(
                        'admin.countryOnboarding.reviewFastHours',
                        'Fast delivery service hours'
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {t(
                        'admin.countryOnboarding.timezoneLabel',
                        'Timezone (IANA)'
                      )}
                      :{' '}
                      {workingConfig.countryDeliveryConfig?.configs.find(
                        (c) => c.config_key === 'timezone'
                      )?.config_value || 'Africa/Libreville'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {workingConfig.countryDeliveryConfig?.configs.find(
                        (c) => c.config_key === 'fast_delivery_service_hours'
                      )
                        ? t(
                            'admin.countryOnboarding.fastHoursConfigured',
                            'Custom fast delivery hours configured.'
                          )
                        : t(
                            'admin.countryOnboarding.fastHoursNotConfigured',
                            'No custom fast delivery hours configured.'
                          )}
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      {t(
                        'admin.countryOnboarding.reviewTimeSlots',
                        'Delivery time slots'
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {t(
                        'admin.countryOnboarding.reviewTimeSlotsCount',
                        'Total time slots: {{count}}',
                        { count: workingConfig.deliveryTimeSlots.length }
                      )}
                    </Typography>
                    {workingConfig.deliveryTimeSlots.length > 0 && (
                      <Typography variant="body2" color="text.secondary">
                        {t(
                          'admin.countryOnboarding.reviewTimeSlotsStates',
                          'Distinct states with slots: {{count}}',
                          {
                            count: Array.from(
                              new Set(
                                workingConfig.deliveryTimeSlots
                                  .map((s) => s.state || '')
                                  .filter((s) => s)
                              )
                            ).length,
                          }
                        )}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      {t(
                        'admin.countryOnboarding.reviewStates',
                        'Supported states'
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {t(
                        'admin.countryOnboarding.reviewStatesCount',
                        'Total supported states: {{count}}',
                        { count: workingConfig.supportedStates.length }
                      )}
                    </Typography>
                    {workingConfig.supportedStates.length > 0 && (
                      <Typography variant="body2" color="text.secondary">
                        {t(
                          'admin.countryOnboarding.reviewStatesActive',
                          'Active states: {{count}}',
                          {
                            count: workingConfig.supportedStates.filter(
                              (s) => s.service_status === 'active'
                            ).length,
                          }
                        )}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              disabled={step === 0}
              onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
            >
              {t('common.back', 'Back')}
            </Button>

            {step < steps.length - 1 && (
              <Button
                variant="contained"
                onClick={() =>
                  setStep((prev) => Math.min(prev + 1, steps.length - 1))
                }
              >
                {t('common.next', 'Next')}
              </Button>
            )}

            {step === steps.length - 1 && (
              <Button
                variant="contained"
                color="primary"
                disabled={applying}
                onClick={async () => {
                  if (!workingConfig) {
                    return;
                  }
                  setApplyError(null);
                  const ok = await applyConfig(workingConfig);
                  if (!ok) {
                    setApplyError(
                      t(
                        'admin.countryOnboarding.applyFailed',
                        'Failed to apply country onboarding configuration.'
                      )
                    );
                  }
                }}
              >
                {t('admin.countryOnboarding.apply', 'Apply configuration')}
              </Button>
            )}
          </Box>
        </Box>
      )}
    </Container>
  );
};

export default CountryOnboardingPage;

