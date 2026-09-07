import type { EnvName } from '../config/envSwitch';
import type { PersonaSlug } from './persona';

export type SavedAccountEnv = EnvName;
export type SavedAccountPersona = PersonaSlug;

export interface SavedAccount {
  id: string;
  environment: SavedAccountEnv;
  userId: string;
  displayName: string;
  email: string;
  phone?: string;
  avatar?: string;
  persona?: SavedAccountPersona;
  lastUsedAt: number;
  biometricEnabled: boolean;
  secureStoreKey: string;
  label?: string;
  lastLoginAt?: number;
  createdAt: number;
}

export interface SavedAccountIndex {
  version: 1;
  accounts: SavedAccount[];
}

export type SavedAccountsScreenMode = 'continue' | 'switch';
