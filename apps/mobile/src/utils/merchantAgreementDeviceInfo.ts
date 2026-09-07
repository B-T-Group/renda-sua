import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { getAppVersion } from './appVersion';

export type MerchantAgreementDeviceInfo = {
  platform: string;
  osName?: string;
  osVersion?: string;
  modelName?: string;
  appVersion?: string;
  brand?: string;
};

export function buildMerchantAgreementDeviceInfo(): MerchantAgreementDeviceInfo {
  return {
    platform: Platform.OS,
    osName: Device.osName ?? undefined,
    osVersion: Device.osVersion ?? undefined,
    modelName: Device.modelName ?? undefined,
    brand: Device.brand ?? undefined,
    appVersion: getAppVersion(),
  };
}
