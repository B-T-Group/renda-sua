import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { ExportViewerRole } from '../../utils/exportItemRules';
import { formatExportDestinations } from '../../utils/exportItemRules';

export interface ExportDestinationsLineProps {
  destinations: string[];
  max?: number;
}

/** Globe + "CM · GA · CI +2" on tiles and cards. */
export function ExportDestinationsLine({ destinations, max = 3 }: ExportDestinationsLineProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (destinations.length === 0) return null;
  const codes = formatExportDestinations(destinations, max);
  return (
    <View
      style={styles.line}
      accessibilityLabel={t('exportItem.exportedToLine', 'Exported to: {{codes}}', {
        codes: destinations.join(', '),
      })}
    >
      <MaterialCommunityIcons name="earth" size={13} color={colors.text.secondary} />
      <Text
        style={[styles.codes, { color: colors.text.secondary }]}
        numberOfLines={1}
        testID="export-destinations-line"
      >
        {codes}
      </Text>
    </View>
  );
}

export interface ExportViewerNoteProps {
  role: ExportViewerRole;
  marketCode?: string | null;
}

/** Origin / third-market explanation where I’m interested would be. */
export function ExportViewerNote({ role, marketCode }: ExportViewerNoteProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (role === 'destination') return null;
  const text =
    role === 'origin'
      ? t(
          'exportItem.originLine',
          'Exported from your market. It isn’t sold here. You can still like or share it.'
        )
      : t('exportItem.thirdLine', 'Not exported to your market ({{code}}). You can still like or share it.', {
          code: marketCode?.trim().toUpperCase() || '—',
        });
  return (
    <View style={styles.note} testID={`export-viewer-note-${role}`}>
      <MaterialCommunityIcons name="information-outline" size={16} color={colors.text.secondary} />
      <Text style={[styles.noteText, { color: colors.text.secondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  codes: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  noteText: { fontSize: 13, lineHeight: 18, flex: 1 },
});
