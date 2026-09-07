import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { MentionableParticipant } from '../../services/agentApi';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';


interface MentionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  mentionableParticipants: MentionableParticipant[];
  participantsLoading?: boolean;
  onMentionSelect: (participant: MentionableParticipant) => void;
  placeholder?: string;
  disabled?: boolean;
  inputStyle?: object;
}

export function MentionInput({
  value,
  onChangeText,
  mentionableParticipants,
  participantsLoading = false,
  onMentionSelect,
  placeholder,
  disabled,
  inputStyle,
}: MentionInputProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const personaPillColors = {
    client: { bg: colors.infoTint, text: colors.info.dark },
    agent: { bg: colors.warningTint, text: colors.warning.dark },
    business: { bg: colors.successTint, text: colors.success.dark },
  } as const;
  const [showPicker, setShowPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const skipNextRef = useRef(false);

  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText(text);

      if (skipNextRef.current) {
        skipNextRef.current = false;
        setShowPicker(false);
        return;
      }

      const atIndex = text.lastIndexOf('@');
      if (atIndex !== -1) {
        const afterAt = text.slice(atIndex + 1);
        if (!afterAt.includes(' ')) {
          setMentionQuery(afterAt);
          setShowPicker(true);
          return;
        }
      }
      setShowPicker(false);
    },
    [onChangeText]
  );

  const handleSelect = useCallback(
    (participant: MentionableParticipant) => {
      skipNextRef.current = true;
      Keyboard.dismiss();
      onMentionSelect(participant);
      setShowPicker(false);

      const atIndex = value.lastIndexOf('@');
      if (atIndex !== -1) {
        onChangeText(value.slice(0, atIndex));
      }
    },
    [onMentionSelect, value, onChangeText]
  );

  const filtered = mentionableParticipants.filter((p) =>
    p.displayName.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {showPicker && (
        <View
          style={[
            styles.picker,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
            },
          ]}
        >
          {participantsLoading ? (
            <ActivityIndicator size="small" style={styles.pickerSpinner} />
          ) : filtered.length === 0 ? (
            <Text style={[styles.pickerEmpty, { color: colors.text.secondary }, typography.caption]}>
              {t('messages.mentionNoResults', 'No one to mention yet')}
            </Text>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.userId}
              keyboardShouldPersistTaps="always"
              renderItem={({ item }) => {
                const pillColors = personaPillColors[item.persona];
                return (
                  <Pressable
                    onPress={() => handleSelect(item)}
                    style={({ pressed }) => [
                      styles.pickerRow,
                      { borderBottomColor: colors.divider, opacity: pressed ? 0.7 : 1 },
                    ]}
                    accessibilityLabel={t(
                      'messages.mentionAriaLabel',
                      'Mention {{name}}, {{persona}}',
                      { name: item.displayName, persona: item.persona }
                    )}
                  >
                    <View style={styles.pickerAvatar}>
                      <MaterialCommunityIcons name="at" size={14} color={colors.text.secondary} />
                    </View>
                    <Text
                      style={[
                        styles.pickerName,
                        { color: colors.text.primary },
                        typography.body2,
                      ]}
                      numberOfLines={1}
                    >
                      {item.displayName}
                    </Text>
                    <StatusPill
                      label={item.persona}
                      backgroundColor={pillColors.bg}
                      textColor={pillColors.text}
                      compact
                    />
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      )}
      <TextInput
        style={[
          styles.input,
          {
            borderColor: colors.divider,
            color: colors.text.primary,
            borderRadius: borderRadius.sm,
          },
          typography.body2 as object,
          inputStyle,
        ]}
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder ?? t('messages.mentionPlaceholder', 'Type your message... Use @ to mention')}
        placeholderTextColor={colors.text.disabled}
        multiline
        editable={!disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  picker: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    maxHeight: 200,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 4,
    zIndex: 100,
    overflow: 'hidden',
  },
  pickerSpinner: { padding: 12 },
  pickerEmpty: { padding: 12 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  pickerAvatar: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  pickerName: { flex: 1, minWidth: 0 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
