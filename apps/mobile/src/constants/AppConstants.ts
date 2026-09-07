// Configuration de l'application
export const APP_CONFIG = {
  NAME: 'BT Groupe Mobile',
  VERSION: '1.0.3',
  BUILD_NUMBER: '1',
  ENVIRONMENT: __DEV__ ? 'development' : 'production',
};

// Configuration des couleurs
export const COLORS = {
  PRIMARY: 'rgb(197, 157, 95)',
  PRIMARY_LIGHT: 'rgba(197, 157, 95, 0.1)',
  PRIMARY_DARK: 'rgb(167, 127, 65)',
  
  // Couleurs de statut
  SUCCESS: '#4CAF50',
  WARNING: '#FF9800',
  ERROR: '#F44336',
  INFO: '#2196F3',
  
  // Couleurs de fond
  BACKGROUND: '#f8f9fa',
  SURFACE: '#ffffff',
  CARD: '#ffffff',
  
  // Couleurs de texte
  TEXT_PRIMARY: '#333333',
  TEXT_SECONDARY: '#666666',
  TEXT_DISABLED: '#999999',
  
  // Couleurs de bordure
  BORDER: '#e0e0e0',
  BORDER_LIGHT: '#f0f0f0',
  
  // Couleurs de notification
  NOTIFICATION_SUCCESS: '#4CAF50',
  NOTIFICATION_WARNING: '#FF9800',
  NOTIFICATION_ERROR: '#F44336',
  NOTIFICATION_INFO: '#2196F3',
};

// Configuration des espacements
export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 48,
};

// Configuration des rayons de bordure
export const BORDER_RADIUS = {
  SM: 4,
  MD: 8,
  LG: 12,
  XL: 16,
  ROUND: 50,
};

// Configuration des ombres
export const SHADOWS = {
  SM: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  MD: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  LG: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};

// Configuration des tailles de police
export const FONT_SIZES = {
  XS: 10,
  SM: 12,
  MD: 14,
  LG: 16,
  XL: 18,
  XXL: 24,
  TITLE: 28,
  HEADER: 32,
};

// Configuration des poids de police
export const FONT_WEIGHTS = {
  LIGHT: '300' as const,
  REGULAR: '400' as const,
  MEDIUM: '500' as const,
  SEMIBOLD: '600' as const,
  BOLD: '700' as const,
  EXTRABOLD: '800' as const,
};

// Configuration des icônes
export const ICONS = {
  SIZES: {
    SM: 16,
    MD: 20,
    LG: 24,
    XL: 28,
    XXL: 32,
  },
};

// Configuration des animations
export const ANIMATIONS = {
  DURATION: {
    FAST: 200,
    NORMAL: 300,
    SLOW: 500,
  },
  EASING: {
    EASE_IN: 'ease-in',
    EASE_OUT: 'ease-out',
    EASE_IN_OUT: 'ease-in-out',
  },
};

// Configuration des limites
export const LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_DOCUMENT_SIZE: 20 * 1024 * 1024, // 20MB
  MAX_PHONE_LENGTH: 15,
  MAX_NAME_LENGTH: 50,
  MAX_EMAIL_LENGTH: 100,
  MAX_ADDRESS_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 500,
};

// Configuration des formats
export const FORMATS = {
  DATE: 'dd/MM/yyyy',
  TIME: 'HH:mm',
  DATETIME: 'dd/MM/yyyy HH:mm',
  CURRENCY: {
    XAF: {
      symbol: 'XAF',
      position: 'after',
      decimals: 0,
    },
    USD: {
      symbol: '$',
      position: 'before',
      decimals: 2,
    },
    EUR: {
      symbol: '€',
      position: 'after',
      decimals: 2,
    },
  },
  PHONE: {
    CAMEROON: '+237',
  },
};

// Configuration des messages d'erreur
export const ERROR_MESSAGES = {
  NETWORK: {
    CONNECTION_ERROR: 'Erreur de connexion. Vérifiez votre connexion internet.',
    TIMEOUT: 'La requête a expiré. Veuillez réessayer.',
    SERVER_ERROR: 'Erreur du serveur. Veuillez réessayer plus tard.',
    UNAUTHORIZED: 'Vous n\'êtes pas autorisé à effectuer cette action.',
    FORBIDDEN: 'Accès interdit.',
    NOT_FOUND: 'Ressource non trouvée.',
  },
  VALIDATION: {
    REQUIRED: 'Ce champ est obligatoire.',
    EMAIL: 'Veuillez entrer une adresse email valide.',
    PHONE: 'Veuillez entrer un numéro de téléphone valide.',
    MIN_LENGTH: (field: string, min: number) => `${field} doit contenir au moins ${min} caractères.`,
    MAX_LENGTH: (field: string, max: number) => `${field} ne peut pas dépasser ${max} caractères.`,
    FILE_SIZE: (maxSize: string) => `La taille du fichier ne peut pas dépasser ${maxSize}.`,
    FILE_TYPE: 'Type de fichier non supporté.',
  },
  AUTH: {
    LOGIN_FAILED: 'Email ou mot de passe incorrect.',
    REGISTRATION_FAILED: 'Erreur lors de l\'inscription. Veuillez réessayer.',
    TOKEN_EXPIRED: 'Votre session a expiré. Veuillez vous reconnecter.',
    ACCOUNT_LOCKED: 'Votre compte a été verrouillé. Contactez le support.',
  },
  PAYMENT: {
    FAILED: 'Le paiement a échoué. Veuillez réessayer.',
    INSUFFICIENT_FUNDS: 'Fonds insuffisants.',
    CARD_DECLINED: 'Carte refusée. Veuillez vérifier vos informations.',
    EXPIRED_CARD: 'Carte expirée. Veuillez utiliser une autre carte.',
  },
};

// Configuration des messages de succès
export const SUCCESS_MESSAGES = {
  PROFILE_UPDATED: 'Profil mis à jour avec succès.',
  PASSWORD_CHANGED: 'Mot de passe modifié avec succès.',
  PAYMENT_SUCCESS: 'Paiement effectué avec succès.',
  DOCUMENT_UPLOADED: 'Document téléchargé avec succès.',
  APPLICATION_SUBMITTED: 'Demande soumise avec succès.',
  NOTIFICATION_SENT: 'Notification envoyée avec succès.',
};

// Configuration des types de notification
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

// Configuration des types d'activité
export const ACTIVITY_TYPES = {
  INVESTMENT: 'investment',
  PAYMENT: 'payment',
  DOCUMENT: 'document',
  NOTIFICATION: 'notification',
} as const;

// Configuration des statuts
export const STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  SUSPENDED: 'suspended',
} as const;

// Configuration des rôles
export const ROLES = {
  CLIENT: 'client',
  AGENT: 'agent',
  ADMIN: 'admin',
  FIELD_ENGINEER: 'field_engineer',
} as const;

// Configuration des permissions
export const PERMISSIONS = {
  VIEW_PROFILE: 'view_profile',
  EDIT_PROFILE: 'edit_profile',
  VIEW_INVESTMENTS: 'view_investments',
  MANAGE_INVESTMENTS: 'manage_investments',
  VIEW_DOCUMENTS: 'view_documents',
  UPLOAD_DOCUMENTS: 'upload_documents',
  VIEW_PAYMENTS: 'view_payments',
  MAKE_PAYMENTS: 'make_payments',
  VIEW_REPORTS: 'view_reports',
  MANAGE_USERS: 'manage_users',
} as const;

