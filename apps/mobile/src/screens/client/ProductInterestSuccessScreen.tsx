import { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import type { ClientRootStackParamList } from '../../navigation/types';

function ProductInterestSuccessScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      headerLeft: () => null,
      gestureEnabled: false,
    });
  }, [navigation]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={[
        styles.content,
        {
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.primaryTint, borderRadius: borderRadius.lg },
        ]}
      >
        <MaterialCommunityIcons
          name="check-circle"
          size={56}
          color={colors.primary.main}
        />
      </View>
      <Text
        style={[
          typography.h4,
          {
            color: colors.text.primary,
            fontWeight: '800',
            textAlign: 'center',
            marginTop: spacing.md,
          },
        ]}
      >
        {t(
          'productInterest.successScreen.title',
          'Interest submitted successfully'
        )}
      </Text>
      <Text
        style={[
          typography.body1,
          {
            color: colors.text.secondary,
            textAlign: 'center',
            marginTop: spacing.sm,
          },
        ]}
      >
        {t(
          'productInterest.successScreen.body',
          'A representative will reach out to you about this item.'
        )}
      </Text>
      <Button
        mode="contained"
        onPress={() =>
          navigation.navigate('ClientMainTabs', { screen: 'ClientBrowse' })
        }
        style={{ marginTop: spacing.xl, borderRadius: borderRadius.button }}
      >
        {t(
          'productInterest.successScreen.browseMore',
          'Continue browsing'
        )}
      </Button>
      <Button
        mode="outlined"
        onPress={() => navigation.navigate('ClientProductInterest')}
        style={{ marginTop: spacing.sm, borderRadius: borderRadius.button }}
      >
        {t(
          'productInterest.successScreen.viewRequests',
          'View my interest requests'
        )}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  iconWrap: {
    alignSelf: 'center',
    padding: 20,
  },
});

export default observer(ProductInterestSuccessScreen);
