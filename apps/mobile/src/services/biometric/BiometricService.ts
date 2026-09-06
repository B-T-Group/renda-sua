import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricAuthResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'lockout' | 'failed' | 'enrollment_changed' };

const ENROLLMENT_KEY = '@RendasuaAgent:biometricEnrollmentFingerprint';

export class BiometricService {
  /** Native platforms with hardware biometrics or device passcode. */
  async isSupported(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    return hasHardware;
  }

  async isEnrolled(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    return LocalAuthentication.isEnrolledAsync();
  }

  async getBiometricLabel(): Promise<string> {
    if (Platform.OS === 'web') return 'Biometrics';
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face unlock';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    }
    return 'Biometrics';
  }

  async authenticate(promptMessage: string): Promise<BiometricAuthResult> {
    if (Platform.OS === 'web') {
      return { ok: false, reason: 'unavailable' };
    }

    const supported = await this.isSupported();
    const enrolled = await this.isEnrolled();
    if (!supported || !enrolled) {
      return { ok: false, reason: 'unavailable' };
    }

    const enrollmentChanged = await this.hasEnrollmentChanged();
    if (enrollmentChanged) {
      return { ok: false, reason: 'enrollment_changed' };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (result.success) {
      await this.persistEnrollmentFingerprint();
      return { ok: true };
    }

    if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel') {
      return { ok: false, reason: 'cancelled' };
    }
    if (result.error === 'lockout' || result.error === 'lockout_permanent') {
      return { ok: false, reason: 'lockout' };
    }
    return { ok: false, reason: 'failed' };
  }

  private async readEnrollmentFingerprint(): Promise<string | null> {
    try {
      const { default: StorageService } = await import('../storage/StorageService');
      return StorageService.getString(ENROLLMENT_KEY);
    } catch {
      return null;
    }
  }

  private async persistEnrollmentFingerprint(): Promise<void> {
    if (Platform.OS === 'web') return;
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const fingerprint = `${level}:${types.join(',')}`;
    const { default: StorageService } = await import('../storage/StorageService');
    await StorageService.setString(ENROLLMENT_KEY, fingerprint);
  }

  async hasEnrollmentChanged(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    const stored = await this.readEnrollmentFingerprint();
    if (!stored) return false;
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const current = `${level}:${types.join(',')}`;
    return stored !== current;
  }

  async clearEnrollmentFingerprint(): Promise<void> {
    const { default: StorageService } = await import('../storage/StorageService');
    await StorageService.remove(ENROLLMENT_KEY);
  }
}

export default new BiometricService();
