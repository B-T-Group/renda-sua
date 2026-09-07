import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import Logo from '../../components/Logo';
import { agentDisplayName, agentInitial } from '../../utils/agentProfileDisplay';
import { formatAppFooterLabel } from '../../utils/appVersion';

const ICON_SIZE = 24;

const mainNav = [
  { name: 'Home', route: 'Home' as const, icon: 'home' },
  { name: 'OpenOrders', route: 'OpenOrders' as const, icon: 'package-variant-closed' },
  { name: 'Orders', route: 'Orders' as const, icon: 'truck-delivery' },
  { name: 'Earnings', route: 'Earnings' as const, icon: 'cash-multiple' },
  { name: 'Documents', route: 'Documents' as const, icon: 'file-document-multiple-outline' },
  { name: 'Profile', route: 'Profile' as const, icon: 'account' },
];

const helpNav = [
  { name: 'Terms', route: 'Terms' as const, icon: 'file-document-outline' },
  { name: 'Privacy', route: 'Privacy' as const, icon: 'shield-lock-outline' },
  { name: 'FAQ', route: 'FAQ' as const, icon: 'help-circle-outline' },
];

function MenuIcon({ name, color }: { name: string; color: string }) {
  const Icon = require('@expo/vector-icons/MaterialCommunityIcons').default;
  return <Icon name={name} size={ICON_SIZE} color={color} />;
}

export type MainStackParamList = {
  MainMenu: undefined;
  Home: undefined;
  OpenOrders: undefined;
  Orders: undefined;
  Earnings: undefined;
  Documents: undefined;
  Profile: undefined;
  Terms: undefined;
  Privacy: undefined;
  FAQ: undefined;
};

type Props = {
  navigation: { navigate: (name: keyof MainStackParamList) => void };
};

function MainMenuScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const { auth } = useStore();
  const user = auth.user;

  const navLabels: Record<string, string> = {
    Home: t('nav.home'),
    OpenOrders: t('agent.openOrders.available'),
    Orders: t('nav.orders'),
    Earnings: t('nav.earnings'),
    Documents: t('nav.documents'),
    Profile: t('nav.profile'),
    Terms: t('nav.terms'),
    Privacy: t('nav.privacy', 'Privacy Policy'),
    FAQ: t('nav.faq'),
  };

  const renderNavItem = (item: { name: string; route: keyof MainStackParamList; icon: string }) => (
    <Pressable
      key={item.route}
      onPress={() => navigation.navigate(item.route)}
      style={({ pressed }) => [
        styles.itemRow,
        {
          backgroundColor: colors.primaryTint,
          borderLeftColor: colors.primary.main,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.itemIcon}>
        <MenuIcon name={item.icon} color={colors.primary.main} />
      </View>
      <Text
        style={[styles.itemLabel, typography.subtitle2, { color: colors.primary.main }]}
        numberOfLines={1}
      >
        {navLabels[item.route] ?? item.route}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.surface }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { borderBottomColor: colors.divider }]}>
          <Logo />
        </View>

        <View
          style={[
            styles.userBlock,
            { backgroundColor: colors.pageBackground, borderRadius: borderRadius.md },
          ]}
        >
          {auth.displayProfilePhotoUri ? (
            <Image source={{ uri: auth.displayProfilePhotoUri }} style={[styles.avatarPlaceholder, { borderRadius: 20 }]} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary.light }]}>
              <Text style={[styles.avatarText, { color: colors.primary.contrast }]}>
                {user ? agentInitial(user) : '?'}
              </Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text.primary }, typography.subtitle2]} numberOfLines={1}>
              {user ? agentDisplayName(user) : t('auth.profile')}
            </Text>
            {user?.email || user?.phoneNumber ? (
              <Text style={[styles.userEmail, { color: colors.text.secondary }, typography.caption]} numberOfLines={1}>
                {user.email || user.phoneNumber}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.menu}>
          <Text style={[styles.sectionLabel, { color: colors.text.secondary }, typography.overline]}>
            {t('menu.sectionMain')}
          </Text>
          {mainNav.map(renderNavItem)}
          <Text style={[styles.sectionLabel, { color: colors.text.secondary }, typography.overline]}>
            {t('menu.sectionHelp')}
          </Text>
          {helpNav.map(renderNavItem)}
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        <Text style={[styles.footerText, { color: colors.text.disabled }, typography.overline]}>
          {formatAppFooterLabel('Rendasua Agent')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  header: {
    paddingTop: Platform.OS === 'android' ? 48 : 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  userBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 12,
    gap: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '600' },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { marginBottom: 2 },
  userEmail: {},
  menu: { marginTop: 24, paddingHorizontal: 12 },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 6,
    marginHorizontal: 12,
    letterSpacing: 0.8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 2,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  itemIcon: { width: ICON_SIZE + 8, marginRight: 12, alignItems: 'center' },
  itemLabel: { flex: 1 },
  footer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerText: { textTransform: 'uppercase', letterSpacing: 0.5 },
});

export default observer(MainMenuScreen);
