import { FORMATS, LIMITS } from '../constants/AppConstants';

/**
 * Valide et normalise un code de devise
 */
const normalizeCurrency = (currency: string | null | undefined): string => {
  if (!currency || typeof currency !== 'string') {
    return 'XAF'; // Devise par défaut
  }
  
  // Nettoyer le code de devise (enlever espaces, convertir en majuscules)
  const cleaned = currency.trim().toUpperCase();
  
  // Vérifier que c'est un code ISO 4217 valide (3 lettres)
  if (!/^[A-Z]{3}$/.test(cleaned)) {
    return 'XAF'; // Code invalide, utiliser la devise par défaut
  }
  
  return cleaned;
};

/**
 * Formate un montant en devise
 */

export const formatCurrency = (
    amount: number | string | null | undefined,
    currency: string | null | undefined = 'XAF',
    locale: string = 'fr-FR'
): string => {

  const parseAmount = (value: any): number => {
    if (value === null || value === undefined) return 0;

    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }

    if (typeof value === 'string') {
      // Supprimer TOUT sauf chiffres et point
      const cleaned = value.replace(/[^\d.-]/g, '');
      const parsed = Number(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }

    return 0;
  };

  const safeAmount = parseAmount(amount);

  const normalizedCurrency = normalizeCurrency(currency);
  const config = (FORMATS.CURRENCY as any)[normalizedCurrency];
  const decimals = config?.decimals ?? 0; // FCFA = 0 décimale

  try {
    if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: normalizedCurrency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(safeAmount);
    }
  } catch (error) {}

  const symbol = config?.symbol || normalizedCurrency;

  const formattedAmount = safeAmount
      .toFixed(decimals)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  return config?.position === 'before'
      ? `${symbol} ${formattedAmount}`
      : `${formattedAmount} ${symbol}`;
};

/*
export const formatCurrency = (
  amount: number,
  currency: string | null | undefined = 'XAF',
  locale: string = 'fr-FR'
): string => {
  // Normaliser et valider le code de devise
  const normalizedCurrency = normalizeCurrency(currency);
  const config = (FORMATS.CURRENCY as any)[normalizedCurrency];
  const decimals = config?.decimals ?? 2;

  // Fallback pour Android - Intl.NumberFormat peut ne pas être disponible
  try {
    if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: normalizedCurrency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount);
    }
  } catch (error) {
    // Si Intl.NumberFormat échoue, utiliser le fallback manuel
  }

  // Fallback manuel pour Android ou codes de devise non supportés
  const symbol = config?.symbol || normalizedCurrency;
  const formattedAmount = amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  if (config?.position === 'before') {
    return `${symbol} ${formattedAmount}`;
  } else {
    return `${formattedAmount} ${symbol}`;
  }
};
*/

/**
 * Formate une date
 */
export const formatDate = (
  date: Date | string,
  format: 'date' | 'time' | 'datetime' | 'relative' = 'date',
  locale: string = 'fr-FR'
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'relative') {
    return formatRelativeTime(dateObj);
  }
  
  const options: Intl.DateTimeFormatOptions = {
    localeMatcher: 'best fit',
  };
  
  switch (format) {
    case 'date':
      options.day = '2-digit';
      options.month = '2-digit';
      options.year = 'numeric';
      break;
    case 'time':
      options.hour = '2-digit';
      options.minute = '2-digit';
      break;
    case 'datetime':
      options.day = '2-digit';
      options.month = '2-digit';
      options.year = 'numeric';
      options.hour = '2-digit';
      options.minute = '2-digit';
      break;
  }
  
  return new Intl.DateTimeFormat(locale, options).format(dateObj);
};

// Ajouts utilitaires Lot 1
export const daysSince = (iso: string): number => {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
};

export const daysUntil = (iso: string): number => {
  const target = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((target - now) / (1000 * 60 * 60 * 24));
};

export const sumDividends = (dividends: { amount: number }[] = []): number => {
  return dividends.reduce((sum, d) => sum + (d.amount || 0), 0);
};

export const getInvestmentStatus = (params: { withdrawn?: boolean; investing?: boolean }): 'Actif' | 'Retiré' | 'En attente' => {
  if (params.withdrawn) return 'Retiré';
  if (params.investing) return 'Actif';
  return 'En attente';
};

/**
 * Formate un temps relatif
 */
export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'À l\'instant';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `Il y a ${diffInMinutes} min`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `Il y a ${diffInHours}h`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `Il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `Il y a ${diffInWeeks} semaine${diffInWeeks > 1 ? 's' : ''}`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `Il y a ${diffInMonths} mois`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `Il y a ${diffInYears} an${diffInYears > 1 ? 's' : ''}`;
};

/**
 * Formate la taille d'un fichier
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Formate un numéro de téléphone
 */
export const formatPhoneNumber = (
  phone: string,
  countryCode: string = FORMATS.PHONE.CAMEROON
): string => {
  // Supprimer tous les caractères non numériques
  const cleaned = phone.replace(/\D/g, '');
  
  // Si le numéro commence par le code pays, le formater
  if (cleaned.startsWith(countryCode.replace('+', ''))) {
    const number = cleaned.substring(countryCode.replace('+', '').length);
    return `${countryCode} ${number.replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3')}`;
  }
  
  // Sinon, ajouter le code pays et formater
  return `${countryCode} ${cleaned.replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3')}`;
};

/**
 * Formate un nom propre (première lettre en majuscule)
 */
export const formatName = (name: string): string => {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Formate un email (masquer partiellement)
 */
export const formatEmail = (email: string, mask: boolean = false): string => {
  if (!mask) return email;
  
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) return email;
  
  const maskedLocal = localPart.charAt(0) + '*'.repeat(localPart.length - 2) + localPart.charAt(localPart.length - 1);
  return `${maskedLocal}@${domain}`;
};

/**
 * Formate un numéro de compte
 */
export const formatAccountNumber = (accountNumber: string): string => {
  // Supprimer tous les caractères non numériques
  const cleaned = accountNumber.replace(/\D/g, '');
  
  // Formater en groupes de 4 chiffres
  return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
};

/**
 * Formate un pourcentage
 */
export const formatPercentage = (
  value: number,
  decimals: number = 2,
  showSign: boolean = true
): string => {
  const formatted = value.toFixed(decimals);
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${formatted}%`;
};

/**
 * Formate un nombre avec séparateurs de milliers
 */
export const formatNumber = (
  number: number,
  locale: string = 'fr-FR',
  decimals: number = 0
): string => {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number);
};

/**
 * Formate une durée en secondes
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
};

/**
 * Formate un code postal
 */
export const formatPostalCode = (postalCode: string): string => {
  // Supprimer tous les caractères non numériques
  const cleaned = postalCode.replace(/\D/g, '');
  
  // Formater selon le pays (ici pour la France)
  if (cleaned.length === 5) {
    return cleaned;
  }
  
  return postalCode;
};

/**
 * Formate une adresse
 */
export const formatAddress = (address: {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}): string => {
  const parts = [
    address.street,
    address.city,
    address.state,
    address.zipCode,
    address.country,
  ].filter(Boolean);
  
  return parts.join(', ');
};

/**
 * Formate un nom de fichier
 */
export const formatFileName = (fileName: string, maxLength: number = 30): string => {
  if (fileName.length <= maxLength) return fileName;
  
  const extension = fileName.split('.').pop();
  const name = fileName.substring(0, fileName.lastIndexOf('.'));
  
  if (!extension) return name.substring(0, maxLength - 3) + '...';
  
  const maxNameLength = maxLength - extension.length - 4; // 4 pour "..."
  return name.substring(0, maxNameLength) + '...' + extension;
};

/**
 * Formate un statut
 */
export const formatStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    active: 'Actif',
    pending: 'En attente',
    completed: 'Terminé',
    cancelled: 'Annulé',
    suspended: 'Suspendu',
    draft: 'Brouillon',
    published: 'Publié',
    archived: 'Archivé',
  };
  
  return statusMap[status.toLowerCase()] || status;
};

/**
 * Formate un type de document
 */
export const formatDocumentType = (type: string): string => {
  const typeMap: Record<string, string> = {
    contract: 'Contrat',
    certificate: 'Certificat',
    report: 'Rapport',
    invoice: 'Facture',
    receipt: 'Reçu',
    id_card: 'Carte d\'identité',
    passport: 'Passeport',
    utility_bill: 'Facture d\'électricité',
    bank_statement: 'Relevé bancaire',
  };
  
  return typeMap[type.toLowerCase()] || type;
};

