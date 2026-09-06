import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { AppModal } from '../../components/common/AppModal';
import { KeyboardAwareScrollView } from '../../components/layout/KeyboardAwareScrollView';
import { keyboardAwareScrollProps } from '../../hooks/useKeyboardVerticalOffset';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  Banner,
  Button,
  Divider,
  IconButton,
  Text,
  TextInput,
} from 'react-native-paper';
import { StatusPill } from '../../components/common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import {
  IMAGE_LIBRARY_PICKER_OPTIONS,
  isSupportedImageAsset,
} from '../../utils/supportedImageFormats';
import { useAddresses } from '../../hooks/useAddresses';
import { useProfileMe } from '../../hooks/useProfileMe';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { agentApi } from '../../services/agentApi';
import type { MeUser } from '../../types/me';
import type { UserAddress } from '../../types/agent';
import { AddressCapture } from '../../components/forms/AddressCapture';
import { agentInitial } from '../../utils/agentProfileDisplay';
import type { Theme } from '../../theme';
import { ConfirmActionDialog } from '../../components/dialogs/ConfirmActionDialog';
import { ProfileCompletenessCard } from '../../components/profile/ProfileCompletenessCard';
import { CustomerActivationChecklist } from '../../components/client/CustomerActivationChecklist';
import { ProfileRolesSection } from '../../components/enroll/ProfileRolesSection';
import { AgentReferralCodeCard } from '../../components/profile/AgentReferralCodeCard';
import { AgentFocusSettings } from '../../components/profile/AgentFocusSettings';
import { showsCommercialChrome } from '../../types/agentFocus';
import { EntityRatingsSection } from '../../components/rating/EntityRatingsSection';
import { useDeleteAccount } from '../../hooks/useDeleteAccount';
import { PhoneVerificationDialog } from '../../components/dialogs/PhoneVerificationDialog';
import PhoneNumberInput from '../../components/PhoneNumberInput';
import {
  checkAddressDeletionEligibility,
  mapAddressErrorCodeToMessage,
  extractErrorCode,
} from '../../utils/addressDeletionPolicy';
import { pickDefaultPhoneCountry } from '../../utils/deviceDefaultCountry';
import { nationalDigitsToE164, seedPhoneInputFromE164 } from '../../utils/phoneLoginUsername';
import type { CountryCode } from 'libphonenumber-js';

type ProfileForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  timezone: string;
};

const initialForm: ProfileForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone_number: '',
  timezone: 'Africa/Douala',
};

const initialAddressForm = {
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
};

function normalizeEmail(raw: string | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

function resolveEditablePhone(
  digits: string,
  iso: CountryCode
): { ok: true; e164?: string } | { ok: false } {
  if (!digits.replace(/\D/g, '')) return { ok: true, e164: undefined };
  const e164 = nationalDigitsToE164(iso, digits);
  if (!e164) return { ok: false };
  return { ok: true, e164 };
}

function formFromMe(me: MeUser | null): ProfileForm {
  if (!me) return { ...initialForm };
  return {
    first_name: me.first_name ?? '',
    last_name: me.last_name ?? '',
    email: me.email ?? '',
    phone_number: me.phone_number ?? '',
    timezone: (me.timezone || 'Africa/Douala').trim(),
  };
}

function formatAddress(addr: UserAddress): string {
  return [addr.address_line_1, addr.city, addr.state, addr.country].filter(Boolean).join(', ');
}

function formatMemberSince(iso: string | undefined, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Filled verification badge using StatusPill for reliable iOS rendering.
 * Verified → filled success; Unverified → filled warning.
 * Uses icon + color + text so status is never color-only.
 */
function ProfileVerificationBadge({
  verified,
  label,
  colors,
}: {
  verified: boolean;
  label: string;
  colors: Theme['colors'];
}) {
  return (
    <StatusPill
      label={label}
      backgroundColor={verified ? colors.success.main : colors.warning.light + '40'}
      textColor={verified ? '#fff' : colors.warning.dark}
      icon={verified ? 'check-circle' : 'alert-circle-outline'}
      compact
    />
  );
}

function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { colors, typography, borderRadius, shadows } = useTheme();
  const { auth, persona } = useStore();
  const { me, auth0User, loading: meLoading, error: meError, refetch: refetchMe } = useProfileMe(true);
  const { addresses, loading: addressesLoading, error: addressesError, refetch: refetchAddresses, deleteAddress } =
    useAddresses();

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>(initialForm);
  const [phoneCountryIso, setPhoneCountryIso] = useState<CountryCode>(() =>
    pickDefaultPhoneCountry()
  );
  const [phoneNationalDigits, setPhoneNationalDigits] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState(initialAddressForm);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [phoneVerifyDialogVisible, setPhoneVerifyDialogVisible] = useState(false);
  const { deleteAccount, loading: deleteLoading, error: deleteError, clearError: clearDeleteError } =
    useDeleteAccount();

  useEffect(() => {
    if (me && !editingProfile) {
      setProfileForm(formFromMe(me));
    }
  }, [me, editingProfile]);

  useEffect(() => {
    if (!editingProfile) return;
    const seeded = seedPhoneInputFromE164(
      me?.phone_number,
      pickDefaultPhoneCountry(me?.country)
    );
    setPhoneCountryIso(seeded.countryIso);
    setPhoneNationalDigits(seeded.nationalDigits);
  }, [editingProfile, me?.phone_number, me?.country]);

  const isEmailVerified = useMemo(
    () => me?.email_verified === true || auth0User?.email_verified === true,
    [me?.email_verified, auth0User?.email_verified]
  );
  const isPhoneVerified = me?.phone_number_verified === true;
  const hasEmailValue = Boolean(me?.email?.trim());
  const hasPhoneValue = Boolean(me?.phone_number?.trim());

  const displayName = useMemo(() => {
    const n = [me?.first_name, me?.last_name].filter(Boolean).join(' ').trim();
    if (n) return n;
    return auth.user?.email || auth.user?.phoneNumber || '';
  }, [me?.first_name, me?.last_name, auth.user]);

  const avatarUri = auth.displayProfilePhotoUri ?? me?.profile_picture_url ?? null;
  const hasRemotePhoto = Boolean(me?.profile_picture_url);

  const pickProfilePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('profile.photoPermissionDenied'));
        return;
      }
      setPhotoLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        ...IMAGE_LIBRARY_PICKER_OPTIONS,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        if (!isSupportedImageAsset(result.assets[0])) {
          Alert.alert(
            t('common.error'),
            t(
              'business.images.upload.unsupportedFormat',
              'Unsupported image format. Please use JPEG, PNG, or WebP.'
            )
          );
          return;
        }
        await auth.setLocalProfilePhoto(result.assets[0].uri);
      }
    } catch {
      Alert.alert(t('common.error'), t('profile.photoError'));
    } finally {
      setPhotoLoading(false);
    }
  }, [auth, t]);

  const persistProfile = useCallback(async () => {
    if (!me) return;
    const nextEmail = normalizeEmail(profileForm.email);
    const curEmail = normalizeEmail(me.email);
    const emailChanged = nextEmail !== curEmail;
    if (emailChanged && isEmailVerified) {
      Alert.alert(t('common.error'), t('profile.emailVerifiedLocked', 'Your email is verified and cannot be changed.'));
      return;
    }
    const phoneResult = resolveEditablePhone(phoneNationalDigits, phoneCountryIso);
    if (!phoneResult.ok) {
      Alert.alert(
        t('common.error'),
        t('client.placeOrder.payment.invalidPhone', 'Invalid phone number format.')
      );
      return;
    }
    setSaveLoading(true);
    try {
      if (emailChanged) {
        const emailRes = await agentApi.users.updateMyEmail({ email: profileForm.email.trim() });
        if (!emailRes.success) {
          throw new Error(emailRes.message || emailRes.error || t('profile.emailUpdateFailed'));
        }
      }
      const lang =
        me.preferred_language === 'en' || me.preferred_language === 'fr' ? me.preferred_language : 'fr';
      const res = await agentApi.users.updateMe({
        firstName: profileForm.first_name.trim(),
        lastName: profileForm.last_name.trim(),
        phoneNumber: phoneResult.e164,
        timezone: profileForm.timezone.trim() || 'Africa/Douala',
        preferredLanguage: lang,
      });
      if (!res.success) {
        throw new Error(res.error || t('profile.updateFailed', 'Could not update your profile.'));
      }
      setEditingProfile(false);
      await refetchMe();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('profile.updateFailed'));
    } finally {
      setSaveLoading(false);
    }
  }, [me, profileForm, isEmailVerified, phoneNationalDigits, phoneCountryIso, refetchMe, t]);

  const handleDeleteAddress = useCallback(
    (id: string) => {
      const eligibilityError = checkAddressDeletionEligibility(
        id,
        addresses,
        persona.activePersona
      );
      if (eligibilityError) {
        Alert.alert(
          t('common.error'),
          mapAddressErrorCodeToMessage(eligibilityError.code, t)
        );
        return;
      }
      Alert.alert(t('common.confirm'), t('profile.confirmDeleteAddress', 'Delete this address?'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () =>
            void deleteAddress(id).catch((e: any) => {
              const errorCode = extractErrorCode(e);
              const errorMessage = errorCode
                ? mapAddressErrorCodeToMessage(errorCode, t)
                : e instanceof Error
                  ? e.message
                  : 'Error';
              Alert.alert(t('common.error'), errorMessage);
            }),
        },
      ]);
    },
    [addresses, deleteAddress, persona.activePersona, t]
  );

  const openAddModal = useCallback(() => {
    setEditingId(null);
    setAddrForm(initialAddressForm);
    setAddModalVisible(true);
  }, []);

  const openEditModal = useCallback((addr: UserAddress) => {
    setEditingId(addr.id);
    setAddrForm({
      address_line_1: addr.address_line_1 ?? '',
      address_line_2: addr.address_line_2 ?? '',
      city: addr.city ?? '',
      state: addr.state ?? '',
      postal_code: addr.postal_code ?? '',
      country: addr.country ?? '',
      latitude: addr.latitude ? Number(addr.latitude) : undefined,
      longitude: addr.longitude ? Number(addr.longitude) : undefined,
    });
    setAddModalVisible(true);
  }, []);

  const submitAddress = useCallback(async () => {
    if (!addrForm.address_line_1.trim() || !addrForm.city.trim() || !addrForm.state.trim() || !addrForm.country.trim()) {
      Alert.alert(t('common.error'), t('profile.addressRequiredFields', 'Please fill address, city, region, and country.'));
      return;
    }
    setSubmitLoading(true);
    try {
      const payload = {
        address_line_1: addrForm.address_line_1.trim(),
        city: addrForm.city.trim(),
        state: addrForm.state.trim(),
        country: addrForm.country.trim(),
        postal_code: addrForm.postal_code.trim() || undefined,
        address_line_2: addrForm.address_line_2.trim() || undefined,
        latitude: addrForm.latitude,
        longitude: addrForm.longitude,
      };
      if (editingId) {
        await agentApi.addresses.update(editingId, payload);
      } else {
        await agentApi.addresses.create({
          ...payload,
          address_type: 'home',
          is_primary: addresses.length === 0,
        });
      }
      setAddModalVisible(false);
      setEditingId(null);
      refetchAddresses();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : 'Error');
    } finally {
      setSubmitLoading(false);
    }
  }, [addrForm, editingId, addresses.length, refetchAddresses, t]);

  const cardStyle = useMemo(
    () => ({
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.divider,
    }),
    [borderRadius.md, colors.surface, colors.divider]
  );

  const showAgentPhotoNote = Boolean(me?.agent) && !hasRemotePhoto && !auth.displayProfilePhotoUri;
  const agentCode =
    me?.referral_code?.trim() || me?.agent?.agent_code?.trim() || '';
  const hasAgent = Boolean(me?.agent?.id);
  const showCommercial =
    hasAgent && showsCommercialChrome(me?.agent?.focus);
  const showReferralCodeCard =
    !!agentCode && (showCommercial || Boolean(me?.business?.id));
  const showAgentFocus = hasAgent;
  const ratingsEntity =
    persona.activePersona === 'agent' && me?.agent?.id
      ? { type: 'agent', id: me.agent.id }
      : persona.activePersona === 'client' && me?.client?.id
        ? { type: 'client', id: me.client.id }
        : null;

  if (meLoading && !me) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: 12 }}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  return (
    <>
    <KeyboardAwareScrollView
      avoidingViewStyle={[styles.container, { backgroundColor: colors.pageBackground }]}
      contentContainerStyle={styles.content}
    >
      <Text variant="headlineSmall" style={{ color: colors.text.primary, marginBottom: 16, fontWeight: '500' }}>
        {t('profile.title', 'Profile Settings')}
      </Text>

      {meError ? (
        <Banner visible icon="alert-circle-outline" actions={[{ label: t('common.retry'), onPress: () => void refetchMe() }]}>
          {meError}
        </Banner>
      ) : null}

      {me && (!me.email?.trim() || !me.phone_number?.trim()) ? (
        <ProfileCompletenessCard me={me} onRefresh={() => void refetchMe()} />
      ) : null}

      {persona.activePersona === 'client' ? (
        <CustomerActivationChecklist
          me={me}
          addresses={addresses}
          onAddAddress={openAddModal}
          onVerifyPhone={() => {
            if (me?.phone_number?.trim()) {
              setPhoneVerifyDialogVisible(true);
            } else {
              setEditingProfile(true);
            }
          }}
        />
      ) : null}

      <ProfileRolesSection />

      <View style={[styles.card, cardStyle, shadows.sm]}>
        <View style={styles.avatarBlock}>
          <View style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={[styles.avatarImg, { borderRadius: 48 }]} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary.light + '44' }]}>
                {photoLoading ? (
                  <ActivityIndicator color={colors.primary.main} />
                ) : (
                  <Text variant="headlineMedium" style={{ color: colors.primary.main }}>
                    {auth.user ? agentInitial(auth.user) : '?'}
                  </Text>
                )}
              </View>
            )}
            <IconButton
              icon="camera"
              mode="contained-tonal"
              size={20}
              style={[styles.cameraFab, { backgroundColor: colors.surface, borderColor: colors.divider }]}
              onPress={() => void pickProfilePhoto()}
              disabled={photoLoading}
              accessibilityLabel={t('profile.changePhoto')}
            />
          </View>
          <Text variant="titleLarge" style={{ color: colors.text.primary, marginTop: 8, fontWeight: '600' }}>
            {displayName}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4, textAlign: 'center' }}>
            {t('profile.profilePictureHint', 'JPG, PNG or WebP. Max 5MB.')}
          </Text>
        </View>

        {showAgentPhotoNote ? (
          <Banner visible icon="information" style={{ marginTop: 8 }}>
            {t(
              'profile.agentProfilePictureNote',
              'Add a profile picture so clients can see who is delivering their order.'
            )}
          </Banner>
        ) : null}

        <Divider style={{ marginVertical: 16 }} />

        <View style={styles.sectionHeaderRow}>
          <Text variant="labelSmall" style={{ color: colors.text.secondary, letterSpacing: 0.6 }}>
            {t('profile.personalInformation', 'Personal Information')}
          </Text>
          <Button
            mode={editingProfile ? 'text' : 'outlined'}
            compact
            icon={editingProfile ? 'close' : 'pencil-outline'}
            onPress={() => {
              if (editingProfile) {
                setEditingProfile(false);
                if (me) setProfileForm(formFromMe(me));
              } else {
                setEditingProfile(true);
                if (me) setProfileForm(formFromMe(me));
              }
            }}
            contentStyle={{ height: 36 }}
          >
            {editingProfile ? t('common.cancel') : t('common.edit')}
          </Button>
        </View>

        {editingProfile ? (
          <View style={{ gap: 12 }}>
            <TextInput
              mode="outlined"
              label={t('profile.firstName', 'First Name')}
              value={profileForm.first_name}
              onChangeText={(v) => setProfileForm((p) => ({ ...p, first_name: v }))}
            />
            <TextInput
              mode="outlined"
              label={t('profile.lastName', 'Last Name')}
              value={profileForm.last_name}
              onChangeText={(v) => setProfileForm((p) => ({ ...p, last_name: v }))}
            />
            <TextInput
              mode="outlined"
              label={t('profile.email', 'Email')}
              value={profileForm.email}
              onChangeText={(v) => setProfileForm((p) => ({ ...p, email: v }))}
              keyboardType="email-address"
              autoCapitalize="none"
              disabled={isEmailVerified}
            />
            {isEmailVerified ? (
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {t('profile.verifiedValueLocked', 'This verified value cannot be edited.')}
              </Text>
            ) : (
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {t('profile.unverifiedEditableHint', 'This value is not verified yet and can be edited.')}
              </Text>
            )}
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {t('profile.phoneNumber', 'Phone Number')}
            </Text>
            <PhoneNumberInput
              countryIso={phoneCountryIso}
              nationalDigits={phoneNationalDigits}
              onCountryIsoChange={setPhoneCountryIso}
              onNationalDigitsChange={setPhoneNationalDigits}
              hasError={
                phoneNationalDigits.replace(/\D/g, '').length > 0 &&
                !nationalDigitsToE164(phoneCountryIso, phoneNationalDigits)
              }
              disabled={isPhoneVerified}
              disableCountryPicker={isPhoneVerified}
            />
            {isPhoneVerified ? (
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {t('profile.verifiedValueLocked', 'This verified value cannot be edited.')}
              </Text>
            ) : (
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {t(
                  'profile.phoneNumberHelper',
                  'Add your number so we can reach you about orders. Verify it when prompted.'
                )}
              </Text>
            )}
            <TextInput
              mode="outlined"
              label={t('profile.timezoneLabel', 'Time zone (IANA)')}
              value={profileForm.timezone}
              onChangeText={(v) => setProfileForm((p) => ({ ...p, timezone: v }))}
              autoCapitalize="none"
            />
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {t(
                'profile.timezoneHelper',
                'Used for delivery windows and reminders (e.g. Africa/Douala).'
              )}
            </Text>
            <Button mode="contained" onPress={() => void persistProfile()} loading={saveLoading} disabled={saveLoading}>
              {t('common.save')}
            </Button>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <View>
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {t('profile.email', 'Email')}
              </Text>
              <View style={styles.rowChips}>
                <Text variant="bodyLarge" style={{ color: colors.text.primary, flexShrink: 1 }}>
                  {me?.email || '—'}
                </Text>
                {hasEmailValue ? (
                  <ProfileVerificationBadge
                    verified={isEmailVerified}
                    label={
                      isEmailVerified
                        ? t('profile.verifiedLabel', 'Verified')
                        : t('profile.unverifiedLabel', 'Unverified')
                    }
                    colors={colors}
                  />
                ) : null}
              </View>
            </View>
            <View>
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {t('profile.phone', 'Phone')}
              </Text>
              <View style={styles.rowChips}>
                <Text variant="bodyLarge" style={{ color: colors.text.primary, flexShrink: 1 }}>
                  {me?.phone_number || '—'}
                </Text>
                {hasPhoneValue ? (
                  <ProfileVerificationBadge
                    verified={isPhoneVerified}
                    label={
                      isPhoneVerified
                        ? t('profile.verifiedLabel', 'Verified')
                        : t('profile.unverifiedLabel', 'Unverified')
                    }
                    colors={colors}
                  />
                ) : null}
              </View>
              {!isPhoneVerified && hasPhoneValue && (
                <Button
                  mode="text"
                  onPress={() => setPhoneVerifyDialogVisible(true)}
                  style={{ marginTop: 8, alignSelf: 'flex-start' }}
                >
                  {t('profile.verifyPhoneAction', 'Verify phone number')}
                </Button>
              )}
            </View>
            <View>
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {t('profile.memberSince', 'Member since')}
              </Text>
              <Text variant="bodyLarge" style={{ color: colors.text.primary }}>
                {formatMemberSince(me?.created_at, i18n.language)}
              </Text>
            </View>
            <View>
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {t('profile.timezoneLabel', 'Time zone (IANA)')}
              </Text>
              <Text variant="bodyLarge" style={{ color: colors.text.primary }}>
                {me?.timezone || 'Africa/Douala'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {showAgentFocus ? (
        <View style={[styles.card, cardStyle, shadows.sm, { marginTop: 16 }]}>
          <AgentFocusSettings onSaved={() => void refetchMe({ silent: true })} />
        </View>
      ) : null}

      {showReferralCodeCard ? (
        <View style={{ marginTop: 16 }}>
          <AgentReferralCodeCard
            agentCode={agentCode}
            helpText={`${t(
              'agent.referrals.shareHint',
              'Share this code with other agents and businesses so they can enter it when they sign up.'
            )} ${t(
              'agent.referrals.shareHintAgentBonus',
              "Agent-referral bonuses pay after the referred agent's first delivery."
            )}`}
          />
        </View>
      ) : null}

      {ratingsEntity ? (
        <EntityRatingsSection
          entityType={ratingsEntity.type}
          entityId={ratingsEntity.id}
          title={t('rating.myRatingsTitle', 'My ratings')}
          emptyText={t('rating.noRatingsYet', 'No ratings yet.')}
          style={{ marginTop: 16 }}
        />
      ) : null}

      <View style={[styles.card, cardStyle, shadows.sm, { marginTop: 16 }]}>
        <Text variant="titleMedium" style={{ color: colors.text.primary, marginBottom: 8, fontWeight: '600' }}>
          {t('profile.languageSection', 'Language')}
        </Text>
        <LanguageSwitcher variant="full" />
      </View>

      <View style={[styles.card, cardStyle, shadows.sm, { marginTop: 16 }]}>
        <View style={styles.linkCardHeader}>
          <View style={[styles.linkIconBox, { backgroundColor: colors.primaryTint }]}>
            <MaterialCommunityIcons name="file-document-outline" size={22} color={colors.primary.main} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="titleMedium" style={{ fontWeight: '600', color: colors.text.primary }}>
              {t('profile.manageDocuments', 'Manage Documents')}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {t(
                'profile.manageDocumentsDescription',
                'Upload and manage ID, license, and other verification files.'
              )}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text.secondary} />
        </View>
        <Button mode="text" onPress={() => (navigation as { navigate: (n: string) => void }).navigate('Documents')}>
          {t('profile.openDocuments', 'Open documents')}
        </Button>
      </View>

      <View style={[styles.card, cardStyle, shadows.sm, { marginTop: 16 }]}>
        <View style={styles.linkCardHeader}>
          <View style={[styles.linkIconBox, { backgroundColor: colors.primaryTint }]}>
            <MaterialCommunityIcons name="map-marker" size={22} color={colors.primary.main} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="titleMedium" style={{ fontWeight: '600', color: colors.text.primary }}>
              {t('profile.personalAddresses', 'Personal Addresses')}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {persona.activePersona === 'agent'
                ? t(
                    'profile.personalAddressesAgentHint',
                    'Optional — add a home base or use live GPS for nearby orders.'
                  )
                : t('profile.personalAddressesDescription')}
            </Text>
          </View>
        </View>
        <Divider style={{ marginVertical: 12 }} />
        {addressesLoading ? (
          <ActivityIndicator size="small" color={colors.primary.main} />
        ) : addressesError ? (
          <Text variant="bodyMedium" style={{ color: colors.error.main }}>
            {addressesError}
          </Text>
        ) : addresses.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {persona.activePersona === 'agent'
              ? t(
                  'agent.addressPrompt.noAddressesOptional',
                  'No saved address — nearby orders use your live location when available.'
                )
              : t('agent.addressPrompt.noAddresses')}
          </Text>
        ) : (
          addresses.map((addr) => (
            <View
              key={addr.id}
              style={[styles.addressRow, { borderColor: colors.divider, borderRadius: borderRadius.sm }]}
            >
              <Text variant="bodyMedium" style={{ color: colors.text.primary, flex: 1 }} numberOfLines={3}>
                {formatAddress(addr)}
              </Text>
              {addr.is_primary ? (
                <StatusPill
                  compact
                  label={t('profile.primaryAddress', 'Primary')}
                  backgroundColor={colors.primaryTint}
                  textColor={colors.primary.main}
                  icon="star-outline"
                  style={{ marginBottom: 8 }}
                />
              ) : null}
              <View style={styles.addressActions}>
                <Button mode="outlined" compact onPress={() => openEditModal(addr)}>
                  {t('common.edit')}
                </Button>
                {persona.activePersona === 'agent' || addresses.length > 1 ? (
                  <Button mode="outlined" textColor={colors.error.main} compact onPress={() => handleDeleteAddress(addr.id)}>
                    {t('common.delete')}
                  </Button>
                ) : null}
              </View>
            </View>
          ))
        )}
        <Button mode="contained-tonal" style={{ marginTop: 12 }} onPress={openAddModal}>
          {t('agent.addressPrompt.addAddress')}
        </Button>
      </View>

      {deleteError ? (
        <Banner visible icon="alert-circle" style={{ marginTop: 16 }}>
          {deleteError}
        </Banner>
      ) : null}

      <View style={[styles.card, { marginTop: 24, borderColor: colors.error.main, backgroundColor: colors.surface }]}>
        <Text variant="titleMedium" style={{ color: colors.error.main, marginBottom: 8 }}>
          {t('profile.deleteAccount.sectionTitle', 'Delete account')}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: 16 }}>
          {t(
            'profile.deleteAccount.sectionDescription',
            'Permanently remove your account and personal data from Rendasua. This cannot be undone.'
          )}
        </Text>
        <Button
          mode="outlined"
          textColor={colors.error.main}
          style={{ borderColor: colors.error.main }}
          onPress={() => {
            clearDeleteError();
            setDeleteDialogVisible(true);
          }}
        >
          {t('profile.deleteAccount.button', 'Delete account')}
        </Button>
      </View>

      <Button mode="outlined" textColor={colors.error.main} style={{ marginTop: 16, borderColor: colors.error.main }} onPress={() => auth.logout()}>
        {t('auth.logout')}
      </Button>
    </KeyboardAwareScrollView>

      <ConfirmActionDialog
        visible={deleteDialogVisible}
        title={t('profile.deleteAccount.confirmTitle', 'Delete your account?')}
        message={t(
          'profile.deleteAccount.confirmMessage',
          'Your profile, contact details, and uploaded documents will be removed. You will be signed out and will not be able to sign in again with this account. Order history may be kept in anonymized form where required by law.'
        )}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={t('profile.deleteAccount.confirmButton', 'Delete my account')}
        loading={deleteLoading}
        destructive
        onDismiss={() => !deleteLoading && setDeleteDialogVisible(false)}
        onConfirm={() => {
          void (async () => {
            const ok = await deleteAccount();
            if (!ok) return;
            setDeleteDialogVisible(false);
            await auth.logout();
          })();
        }}
      />

      <AppModal visible={addModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalBox, { backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
            <ScrollView {...keyboardAwareScrollProps}>
              <Text variant="titleLarge" style={{ color: colors.text.primary, marginBottom: 16 }}>
                {editingId ? t('agent.addressPrompt.editAddress') : t('agent.addressPrompt.addAddress')}
              </Text>
              <AddressCapture
                value={addrForm}
                onChange={setAddrForm}
                disabled={submitLoading}
                context="delivery"
              />
              <View style={styles.modalActions}>
                <Button mode="contained-tonal" onPress={() => setAddModalVisible(false)}>
                  {t('common.cancel')}
                </Button>
                <Button mode="contained" onPress={() => void submitAddress()} loading={submitLoading} disabled={submitLoading}>
                  {submitLoading ? t('common.loading') : t('common.save')}
                </Button>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </AppModal>

      <PhoneVerificationDialog
        visible={phoneVerifyDialogVisible}
        phoneNumber={me?.phone_number || ''}
        onDismiss={() => setPhoneVerifyDialogVisible(false)}
        onVerified={() => void refetchMe()}
      />
    </>
  );
}

export default observer(ProfileScreen);

const AVATAR = 96;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { padding: 16 },
  avatarBlock: { alignItems: 'center' },
  avatarWrap: { width: AVATAR, height: AVATAR, position: 'relative' },
  avatarImg: { width: AVATAR, height: AVATAR },
  avatarPlaceholder: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraFab: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    margin: 0,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
  linkCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressRow: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  addressActions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: { padding: 16, maxHeight: '88%' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, justifyContent: 'flex-end' },
});
