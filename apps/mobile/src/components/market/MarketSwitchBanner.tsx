import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../../contexts/ThemeContext';
import { NoticeBanner } from '../common/NoticeBanner';
import { useMarket } from '../../hooks/useMarket';
import { isoToFlagEmoji } from '../../utils/countryFlagEmoji';

/**
 * Dismissible banner shown when the device is detected in a different market
 * than the user's current MANUAL selection.
 * Renders nothing when there is no pending prompt.
 */
export const MarketSwitchBanner = observer(function MarketSwitchBanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { pendingPromptCountry, markets, acceptPrompt, dismissPrompt } = useMarket();

  if (!pendingPromptCountry) return null;

  const targetMarket = markets.find(
    (m) => m.countryCode === pendingPromptCountry
  );
  const targetName = targetMarket?.name ?? pendingPromptCountry;
  const targetFlag = targetMarket?.flag ?? isoToFlagEmoji(pendingPromptCountry);

  return (
    <NoticeBanner
      tone="info"
      icon="map-marker-outline"
      title={t('market.switchBanner.title', 'You appear to be in {{flag}} {{name}}', {
        flag: targetFlag,
        name: targetName,
      })}
      message={t('market.switchBanner.message', 'Switch to the {{name}} marketplace?', {
        name: targetName,
      })}
      style={styles.banner}
    >
      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={acceptPrompt}
          buttonColor={colors.info.dark}
          textColor={colors.onDark}
          style={styles.btn}
        >
          {t('market.switchBanner.switch', 'Switch')}
        </Button>
        <Button
          mode="text"
          onPress={dismissPrompt}
          textColor={colors.text.secondary}
          style={styles.btn}
        >
          {t('market.switchBanner.notNow', 'Not now')}
        </Button>
      </View>
    </NoticeBanner>
  );
});

const styles = StyleSheet.create({
  banner: { marginBottom: 12 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  btn: { alignSelf: 'flex-start' },
});
