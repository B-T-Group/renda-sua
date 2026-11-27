import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { addTags, removeTag } from '../../../utils/rentals/rentalTags';

export interface RentalTagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  testID?: string;
}

/** Tag editor: type a tag, press enter / comma / plus to turn it into a removable chip. */
export function RentalTagsInput({
  value,
  onChange,
  disabled,
  testID = 'rental-tags-input',
}: RentalTagsInputProps) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const [draft, setDraft] = useState('');

  const commit = useCallback(
    (raw: string) => {
      onChange(addTags(value, raw));
      setDraft('');
    },
    [onChange, value]
  );

  const handleChange = useCallback(
    (text: string) => {
      if (text.includes(',')) commit(text);
      else setDraft(text);
    },
    [commit]
  );

  return (
    <View style={styles.wrap}>
      <TextInput
        testID={`${testID}-field`}
        label={t('business.rentals.wizard.details.tags', 'Tags')}
        placeholder={t('business.rentals.wizard.details.tagsPlaceholder', 'Type a tag and press enter')}
        value={draft}
        onChangeText={handleChange}
        onSubmitEditing={() => commit(draft)}
        onBlur={() => draft.trim() && commit(draft)}
        returnKeyType="done"
        blurOnSubmit={false}
        autoCapitalize="none"
        mode="outlined"
        disabled={disabled}
        right={
          <TextInput.Icon
            icon="plus"
            disabled={disabled || !draft.trim()}
            onPress={() => commit(draft)}
            accessibilityLabel={t('business.rentals.wizard.details.tagsAdd', 'Add tag')}
          />
        }
      />
      {value.length > 0 ? (
        <View testID={`${testID}-chips`} style={styles.chips}>
          {value.map((tag) => (
            <Chip
              key={tag}
              compact
              disabled={disabled}
              onClose={() => onChange(removeTag(value, tag))}
              closeIconAccessibilityLabel={t(
                'business.rentals.wizard.details.tagsRemove',
                'Remove {{tag}}',
                { tag }
              )}
              style={{ backgroundColor: colors.primaryTint, borderRadius: borderRadius.chip }}
              textStyle={{ color: colors.primary.main }}
            >
              {tag}
            </Chip>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
});
