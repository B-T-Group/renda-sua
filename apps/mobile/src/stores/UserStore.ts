import { makeAutoObservable, runInAction } from 'mobx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStore } from './RootStore';

/**
 * Store utilisateur
 * Gère les données de profil et préférences utilisateur
 * Utilise uniquement les données Auth0
 */

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  
  // Informations personnelles
  dateOfBirth?: string;
  nationality?: string;
  maritalStatus?: string;
  
  // Adresse
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  
  // Emploi
  employment?: {
    company?: string;
    position?: string;
    salary?: number;
    startDate?: string;
  };
  
  // Préférences
  preferences?: {
    language: string;
    currency: string;
    notifications: boolean;
    darkMode: boolean;
    userType: 'client'; // Application dédiée aux clients uniquement
  };
}

export class UserStore {
  private readonly STORAGE_KEY = '@BTGroupe:user';
  private rootStore: RootStore;

  // État observable
  profile: UserProfile | null = null;
  isLoading = false;
  error: string | null = null;

  constructor(rootStore: RootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }

  /**
   * Charger le profil utilisateur depuis Auth0
   */
  async loadProfile(userId: string) {
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      // Utiliser les données Auth0 uniquement
      const auth0User = this.rootStore.auth.user;
      
      if (auth0User) {
        const userProfile: UserProfile = {
          id: userId,
          email: auth0User.email || '',
          firstName: auth0User.firstName,
          lastName: auth0User.lastName,
          phone: auth0User.phoneNumber,
          avatar: auth0User.picture,
          preferences: {
            language: 'fr',
            currency: 'XAF',
            notifications: true,
            darkMode: false,
            userType: 'client', // Application dédiée aux clients uniquement
          },
        };

        runInAction(() => {
          this.profile = userProfile;
          this.isLoading = false;
        });

        // Persister le profil
        await this.persistProfile();
        
        // console.log('✅ Profil utilisateur chargé depuis Auth0:', {
        //   id: userProfile.id,
        //   email: userProfile.email,
        //   name: userProfile.firstName + ' ' + userProfile.lastName
        // });
      } else {
        runInAction(() => {
          this.error = 'Aucun utilisateur Auth0 trouvé';
          this.isLoading = false;
        });
        console.error('❌ Aucun utilisateur Auth0 trouvé');
      }

    } catch (error) {
      console.error('❌ Erreur lors du chargement du profil:', error);
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Erreur lors du chargement du profil';
        this.isLoading = false;
      });
    }
  }

  /**
   * Mettre à jour le profil
   */
  async updateProfile(updates: Partial<UserProfile>) {
    if (!this.profile) return false;

    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      // Simulation de mise à jour locale
      const updatedProfile = { ...this.profile, ...updates };

      runInAction(() => {
        this.profile = updatedProfile;
        this.isLoading = false;
      });

      // Persister les changements
      await this.persistProfile();

      return true;
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Erreur lors de la mise à jour';
        this.isLoading = false;
      });
      return false;
    }
  }

  /**
   * Mettre à jour les préférences
   */
  async updatePreferences(preferences: Partial<UserProfile['preferences']>) {
    if (!this.profile) return false;

    const currentPreferences = this.profile.preferences || {
      language: 'fr',
      currency: 'XAF',
      notifications: true,
      darkMode: false,
      userType: 'client' as const
    };
    const newPreferences = { ...currentPreferences, ...preferences };

    return this.updateProfile({ preferences: newPreferences });
  }

  /**
   * Changer la langue
   */
  async changeLanguage(language: string) {
    try {
      // Import direct d'i18n
      const i18n = require('../services/i18n').default;
      
      if (!i18n) {
        return false;
      }
      
      // Changer la langue directement
      await i18n.changeLanguage(language);
      
      // Sauvegarder la préférence si possible
      if (this.profile?.preferences) {
        try {
          await this.updatePreferences({ language });
        } catch (prefError) {
          // Erreur silencieuse pour la sauvegarde des préférences
        }
      }
      
      return true;
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Basculer le mode sombre
   */
  async toggleDarkMode() {
    if (!this.profile?.preferences) return false;
    
    const newDarkMode = !this.profile.preferences.darkMode;
    const success = await this.updatePreferences({ darkMode: newDarkMode });
    
    if (success) {
      // Mettre à jour le store de thème
      (this.rootStore as { theme?: { setDarkMode: (v: boolean) => void } }).theme?.setDarkMode(newDarkMode);
    }
    
    return success;
  }

  /**
   * Persister le profil
   */
  private async persistProfile() {
    try {
      if (this.profile) {
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.profile));
      }
    } catch (error) {
      console.error('❌ Erreur lors de la persistance du profil:', error);
    }
  }

  /**
   * Nettoyer le profil persisté
   */
  private async clearPersistedProfile() {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage du profil:', error);
    }
  }

  /**
   * Hydrater depuis le stockage
   */
  async hydrate() {
    try {
      const profileJson = await AsyncStorage.getItem(this.STORAGE_KEY);
      
      if (profileJson) {
        const profile = JSON.parse(profileJson) as UserProfile;
        
        runInAction(() => {
          this.profile = profile;
        });

        // Si un utilisateur est connecté, synchroniser le profil
        if (this.rootStore.auth.isAuthenticated && this.rootStore.auth.user) {
          await this.loadProfile(this.rootStore.auth.user.id);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'hydratation du profil:', error);
      await this.clearPersistedProfile();
    }
  }

  /**
   * Réinitialiser le store
   */
  async reset() {
    this.profile = null;
    this.isLoading = false;
    this.error = null;
    await this.clearPersistedProfile();
  }

  // Getters utiles
  get displayName(): string {
    if (!this.profile) return '';
    return (
      `${this.profile.firstName || ''} ${this.profile.lastName || ''}`.trim() ||
      this.profile.email ||
      this.profile.phone ||
      ''
    );
  }

  get initials(): string {
    if (!this.profile) return '';
    const firstName = this.profile.firstName?.[0] || '';
    const lastName = this.profile.lastName?.[0] || '';
    const fromName = (firstName + lastName).toUpperCase();
    if (fromName) return fromName;
    if (this.profile.email?.[0]) return this.profile.email[0].toUpperCase();
    const digits = this.profile.phone?.replace(/\D/g, '') ?? '';
    if (digits[0]) return digits[0];
    return '?';
  }

  get currentLanguage(): string {
    return this.profile?.preferences?.language || 'fr';
  }

  get currentCurrency(): string {
    return this.profile?.preferences?.currency || 'XAF';
  }

  get isDarkMode(): boolean {
    return this.profile?.preferences?.darkMode || false;
  }

  get userType(): 'client' {
    return 'client'; // Application dédiée aux clients uniquement
  }

  get hasSelectedProfile(): boolean {
    return true; // Toujours true car application client uniquement
  }
}