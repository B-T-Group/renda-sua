import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApplicationConfiguration,
  UpdateConfigurationRequest,
} from '../../hooks/useApplicationConfigurations';

interface ConfigurationEditDialogProps {
  open: boolean;
  onClose: () => void;
  configuration: ApplicationConfiguration | null;
  onSave: (id: string, updates: UpdateConfigurationRequest) => Promise<void>;
  loading?: boolean;
}

export const ConfigurationEditDialog: React.FC<
  ConfigurationEditDialogProps
> = ({ open, onClose, configuration, onSave, loading = false }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<UpdateConfigurationRequest>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (configuration) {
      setFormData({
        config_name: configuration.config_name,
        description: configuration.description || '',
        data_type: configuration.data_type,
        string_value: configuration.string_value || '',
        number_value: configuration.number_value,
        boolean_value: configuration.boolean_value,
        json_value: configuration.json_value,
        array_value: configuration.array_value || [],
        date_value: configuration.date_value || null,
        country_code: configuration.country_code || '',
        status: configuration.status,
        tags: configuration.tags || [],
        min_value: configuration.min_value,
        max_value: configuration.max_value,
        allowed_values: configuration.allowed_values || [],
      });
    } else {
      setFormData({});
    }
    setErrors({});
  }, [configuration]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleArrayChange = (
    field: 'array_value' | 'allowed_values',
    value: string
  ) => {
    const arrayValue = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    handleInputChange(field, arrayValue);
  };

  const handleTagsChange = (value: string) => {
    const tags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    handleInputChange('tags', tags);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Only validate editable fields: value, tags, min/max, and allowed values
    // Validate based on data type
    if (formData.data_type) {
      switch (formData.data_type) {
        case 'string':
        case 'currency':
          if (!formData.string_value?.trim()) {
            newErrors.string_value = t(
              'admin.configurations.errors.stringValueRequired',
              'String value is required'
            );
          }
          break;
        case 'number':
          if (
            formData.number_value === undefined ||
            formData.number_value === null
          ) {
            newErrors.number_value = t(
              'admin.configurations.errors.numberValueRequired',
              'Number value is required'
            );
          }
          break;
        case 'boolean':
          if (
            formData.boolean_value === undefined ||
            formData.boolean_value === null
          ) {
            newErrors.boolean_value = t(
              'admin.configurations.errors.booleanValueRequired',
              'Boolean value is required'
            );
          }
          break;
        case 'json':
          if (!formData.json_value) {
            newErrors.json_value = t(
              'admin.configurations.errors.jsonValueRequired',
              'JSON value is required'
            );
          }
          break;
        case 'array':
          if (!formData.array_value || formData.array_value.length === 0) {
            newErrors.array_value = t(
              'admin.configurations.errors.arrayValueRequired',
              'Array value is required'
            );
          }
          break;
        case 'date':
          if (!formData.date_value?.trim()) {
            newErrors.date_value = t(
              'admin.configurations.errors.dateValueRequired',
              'Date value is required'
            );
          }
          break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!configuration || !validateForm()) {
      return;
    }

    try {
      // Only send editable fields: value, tags, min/max, and allowed values
      const editableData: UpdateConfigurationRequest = {
        string_value: formData.string_value,
        number_value: formData.number_value,
        boolean_value: formData.boolean_value,
        json_value: formData.json_value,
        array_value: formData.array_value,
        date_value:
          formData.date_value && formData.date_value.trim() !== ''
            ? formData.date_value
            : null,
        tags: formData.tags,
        min_value: formData.min_value,
        max_value: formData.max_value,
        allowed_values: formData.allowed_values,
      };

      // Remove undefined values and convert empty strings to null for date_value
      Object.keys(editableData).forEach((key) => {
        if (editableData[key] === undefined) {
          delete editableData[key];
        } else if (key === 'date_value' && editableData[key] === '') {
          editableData[key] = null;
        }
      });

      await onSave(configuration.id, editableData);
      onClose();
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  };

  const renderValueInput = () => {
    if (!formData.data_type) return null;

    switch (formData.data_type) {
      case 'string':
      case 'currency':
        return (
          <TextField
            fullWidth
            label={t('admin.configurations.stringValue', 'String Value')}
            value={formData.string_value || ''}
            onChange={(e) => handleInputChange('string_value', e.target.value)}
            error={!!errors.string_value}
            helperText={errors.string_value}
            multiline
            rows={3}
          />
        );

      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            label={t('admin.configurations.numberValue', 'Number Value')}
            value={formData.number_value || ''}
            onChange={(e) =>
              handleInputChange('number_value', parseFloat(e.target.value) || 0)
            }
            error={!!errors.number_value}
            helperText={errors.number_value}
          />
        );

      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={formData.boolean_value || false}
                onChange={(e) =>
                  handleInputChange('boolean_value', e.target.checked)
                }
              />
            }
            label={t('admin.configurations.booleanValue', 'Boolean Value')}
          />
        );

      case 'json':
        return (
          <TextField
            fullWidth
            label={t('admin.configurations.jsonValue', 'JSON Value')}
            value={
              formData.json_value
                ? JSON.stringify(formData.json_value, null, 2)
                : ''
            }
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleInputChange('json_value', parsed);
              } catch {
                handleInputChange('json_value', e.target.value);
              }
            }}
            error={!!errors.json_value}
            helperText={
              errors.json_value ||
              t('admin.configurations.jsonHelp', 'Enter valid JSON')
            }
            multiline
            rows={6}
          />
        );

      case 'array':
        return (
          <TextField
            fullWidth
            label={t('admin.configurations.arrayValue', 'Array Value')}
            value={(formData.array_value || []).join(', ')}
            onChange={(e) => handleArrayChange('array_value', e.target.value)}
            error={!!errors.array_value}
            helperText={
              errors.array_value ||
              t('admin.configurations.arrayHelp', 'Comma-separated values')
            }
            multiline
            rows={3}
          />
        );

      case 'date':
        return (
          <TextField
            fullWidth
            type="datetime-local"
            label={t('admin.configurations.dateValue', 'Date Value')}
            value={formData.date_value || ''}
            onChange={(e) => handleInputChange('date_value', e.target.value)}
            error={!!errors.date_value}
            helperText={errors.date_value}
            InputLabelProps={{ shrink: true }}
          />
        );

      default:
        return null;
    }
  };

  if (!configuration) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t('admin.configurations.editTitle', 'Edit Configuration')}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Configuration Key (Read-only) */}
          <TextField
            fullWidth
            label={t('admin.configurations.configKey', 'Configuration Key')}
            value={configuration.config_key}
            disabled
            helperText={t(
              'admin.configurations.configKeyHelp',
              'Configuration key cannot be changed'
            )}
          />

          {/* Configuration Name */}
          <TextField
            fullWidth
            label={t('admin.configurations.configName', 'Configuration Name')}
            value={formData.config_name || ''}
            disabled
            helperText={t(
              'admin.configurations.configNameHelp',
              'Configuration name cannot be changed'
            )}
          />

          {/* Description */}
          <TextField
            fullWidth
            label={t('admin.configurations.description', 'Description')}
            value={formData.description || ''}
            disabled
            multiline
            rows={2}
            helperText={t(
              'admin.configurations.descriptionHelp',
              'Description cannot be changed'
            )}
          />

          {/* Data Type */}
          <FormControl fullWidth disabled>
            <InputLabel>
              {t('admin.configurations.dataType', 'Data Type')}
            </InputLabel>
            <Select
              value={formData.data_type || ''}
              label={t('admin.configurations.dataType', 'Data Type')}
            >
              <MenuItem value="string">
                {t('admin.configurations.dataTypes.string', 'String')}
              </MenuItem>
              <MenuItem value="number">
                {t('admin.configurations.dataTypes.number', 'Number')}
              </MenuItem>
              <MenuItem value="boolean">
                {t('admin.configurations.dataTypes.boolean', 'Boolean')}
              </MenuItem>
              <MenuItem value="json">
                {t('admin.configurations.dataTypes.json', 'JSON')}
              </MenuItem>
              <MenuItem value="array">
                {t('admin.configurations.dataTypes.array', 'Array')}
              </MenuItem>
              <MenuItem value="date">
                {t('admin.configurations.dataTypes.date', 'Date')}
              </MenuItem>
              <MenuItem value="currency">
                {t('admin.configurations.dataTypes.currency', 'Currency')}
              </MenuItem>
            </Select>
            <Typography
              variant="caption"
              sx={{ mt: 0.5, ml: 1.75, color: 'text.secondary' }}
            >
              {t(
                'admin.configurations.dataTypeHelp',
                'Data type cannot be changed'
              )}
            </Typography>
          </FormControl>

          {/* Dynamic Value Input */}
          {renderValueInput()}

          {/* Country Code */}
          <FormControl fullWidth disabled>
            <InputLabel>
              {t('admin.configurations.countryCode', 'Country Code')}
            </InputLabel>
            <Select
              value={formData.country_code || ''}
              label={t('admin.configurations.countryCode', 'Country Code')}
            >
              <MenuItem value="">
                {t('admin.configurations.global', 'Global')}
              </MenuItem>
              <MenuItem value="CM">Cameroon</MenuItem>
              <MenuItem value="GA">Gabon</MenuItem>
              <MenuItem value="CA">Canada</MenuItem>
              <MenuItem value="US">United States</MenuItem>
              <MenuItem value="FR">France</MenuItem>
              <MenuItem value="GB">United Kingdom</MenuItem>
              <MenuItem value="DE">Germany</MenuItem>
              <MenuItem value="IT">Italy</MenuItem>
              <MenuItem value="ES">Spain</MenuItem>
              <MenuItem value="NL">Netherlands</MenuItem>
              <MenuItem value="BE">Belgium</MenuItem>
              <MenuItem value="CH">Switzerland</MenuItem>
              <MenuItem value="AT">Austria</MenuItem>
              <MenuItem value="SE">Sweden</MenuItem>
              <MenuItem value="NO">Norway</MenuItem>
              <MenuItem value="DK">Denmark</MenuItem>
              <MenuItem value="FI">Finland</MenuItem>
              <MenuItem value="IE">Ireland</MenuItem>
              <MenuItem value="PT">Portugal</MenuItem>
              <MenuItem value="GR">Greece</MenuItem>
              <MenuItem value="PL">Poland</MenuItem>
              <MenuItem value="CZ">Czech Republic</MenuItem>
              <MenuItem value="HU">Hungary</MenuItem>
              <MenuItem value="RO">Romania</MenuItem>
              <MenuItem value="BG">Bulgaria</MenuItem>
              <MenuItem value="HR">Croatia</MenuItem>
              <MenuItem value="SI">Slovenia</MenuItem>
              <MenuItem value="SK">Slovakia</MenuItem>
              <MenuItem value="EE">Estonia</MenuItem>
              <MenuItem value="LV">Latvia</MenuItem>
              <MenuItem value="LT">Lithuania</MenuItem>
              <MenuItem value="MT">Malta</MenuItem>
              <MenuItem value="CY">Cyprus</MenuItem>
              <MenuItem value="LU">Luxembourg</MenuItem>
              <MenuItem value="JP">Japan</MenuItem>
              <MenuItem value="KR">South Korea</MenuItem>
              <MenuItem value="CN">China</MenuItem>
              <MenuItem value="IN">India</MenuItem>
              <MenuItem value="AU">Australia</MenuItem>
              <MenuItem value="NZ">New Zealand</MenuItem>
              <MenuItem value="BR">Brazil</MenuItem>
              <MenuItem value="AR">Argentina</MenuItem>
              <MenuItem value="CL">Chile</MenuItem>
              <MenuItem value="CO">Colombia</MenuItem>
              <MenuItem value="MX">Mexico</MenuItem>
              <MenuItem value="ZA">South Africa</MenuItem>
              <MenuItem value="NG">Nigeria</MenuItem>
              <MenuItem value="KE">Kenya</MenuItem>
              <MenuItem value="GH">Ghana</MenuItem>
              <MenuItem value="EG">Egypt</MenuItem>
              <MenuItem value="MA">Morocco</MenuItem>
              <MenuItem value="TN">Tunisia</MenuItem>
              <MenuItem value="DZ">Algeria</MenuItem>
              <MenuItem value="LY">Libya</MenuItem>
              <MenuItem value="SD">Sudan</MenuItem>
              <MenuItem value="ET">Ethiopia</MenuItem>
              <MenuItem value="UG">Uganda</MenuItem>
              <MenuItem value="TZ">Tanzania</MenuItem>
              <MenuItem value="RW">Rwanda</MenuItem>
              <MenuItem value="BI">Burundi</MenuItem>
              <MenuItem value="CD">Democratic Republic of Congo</MenuItem>
              <MenuItem value="CG">Republic of Congo</MenuItem>
              <MenuItem value="CF">Central African Republic</MenuItem>
              <MenuItem value="TD">Chad</MenuItem>
              <MenuItem value="NE">Niger</MenuItem>
              <MenuItem value="ML">Mali</MenuItem>
              <MenuItem value="BF">Burkina Faso</MenuItem>
              <MenuItem value="CI">Ivory Coast</MenuItem>
              <MenuItem value="GN">Guinea</MenuItem>
              <MenuItem value="SN">Senegal</MenuItem>
              <MenuItem value="GM">Gambia</MenuItem>
              <MenuItem value="GW">Guinea-Bissau</MenuItem>
              <MenuItem value="SL">Sierra Leone</MenuItem>
              <MenuItem value="LR">Liberia</MenuItem>
              <MenuItem value="TG">Togo</MenuItem>
              <MenuItem value="BJ">Benin</MenuItem>
              <MenuItem value="AO">Angola</MenuItem>
              <MenuItem value="ZM">Zambia</MenuItem>
              <MenuItem value="ZW">Zimbabwe</MenuItem>
              <MenuItem value="BW">Botswana</MenuItem>
              <MenuItem value="NA">Namibia</MenuItem>
              <MenuItem value="SZ">Eswatini</MenuItem>
              <MenuItem value="LS">Lesotho</MenuItem>
              <MenuItem value="MG">Madagascar</MenuItem>
              <MenuItem value="MU">Mauritius</MenuItem>
              <MenuItem value="SC">Seychelles</MenuItem>
              <MenuItem value="KM">Comoros</MenuItem>
              <MenuItem value="DJ">Djibouti</MenuItem>
              <MenuItem value="SO">Somalia</MenuItem>
              <MenuItem value="ER">Eritrea</MenuItem>
            </Select>
            <Typography
              variant="caption"
              sx={{ mt: 0.5, ml: 1.75, color: 'text.secondary' }}
            >
              {t(
                'admin.configurations.countryCodeHelp',
                'Country code cannot be changed'
              )}
            </Typography>
          </FormControl>

          {/* Status */}
          <FormControl fullWidth disabled>
            <InputLabel>
              {t('admin.configurations.status', 'Status')}
            </InputLabel>
            <Select
              value={formData.status || 'active'}
              label={t('admin.configurations.status', 'Status')}
            >
              <MenuItem value="active">
                {t('admin.configurations.statuses.active', 'Active')}
              </MenuItem>
              <MenuItem value="inactive">
                {t('admin.configurations.statuses.inactive', 'Inactive')}
              </MenuItem>
              <MenuItem value="deprecated">
                {t('admin.configurations.statuses.deprecated', 'Deprecated')}
              </MenuItem>
            </Select>
            <Typography
              variant="caption"
              sx={{ mt: 0.5, ml: 1.75, color: 'text.secondary' }}
            >
              {t('admin.configurations.statusHelp', 'Status cannot be changed')}
            </Typography>
          </FormControl>

          {/* Tags */}
          <TextField
            fullWidth
            label={t('admin.configurations.tags', 'Tags')}
            value={(formData.tags || []).join(', ')}
            onChange={(e) => handleTagsChange(e.target.value)}
            helperText={t(
              'admin.configurations.tagsHelp',
              'Comma-separated tags for categorization'
            )}
          />

          {/* Validation Rules */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('admin.configurations.validationRules', 'Validation Rules')}
            </Typography>

            <Stack direction="row" spacing={2}>
              <TextField
                type="number"
                label={t('admin.configurations.minValue', 'Min Value')}
                value={formData.min_value || ''}
                onChange={(e) =>
                  handleInputChange(
                    'min_value',
                    parseFloat(e.target.value) || undefined
                  )
                }
                size="small"
              />
              <TextField
                type="number"
                label={t('admin.configurations.maxValue', 'Max Value')}
                value={formData.max_value || ''}
                onChange={(e) =>
                  handleInputChange(
                    'max_value',
                    parseFloat(e.target.value) || undefined
                  )
                }
                size="small"
              />
            </Stack>

            <TextField
              fullWidth
              label={t('admin.configurations.allowedValues', 'Allowed Values')}
              value={(formData.allowed_values || []).join(', ')}
              onChange={(e) =>
                handleArrayChange('allowed_values', e.target.value)
              }
              helperText={t(
                'admin.configurations.allowedValuesHelp',
                'Comma-separated allowed values for enum-like validation'
              )}
              sx={{ mt: 2 }}
            />
          </Box>

          {/* Current Tags Display */}
          {formData.tags && formData.tags.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('admin.configurations.currentTags', 'Current Tags')}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {formData.tags.map((tag, index) => (
                  <Chip key={index} label={tag} size="small" />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {t('common.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
