/**
 * Thème BT Groupe Mobile
 * Basé sur les couleurs et styles du projet web
 */

export const Colors = {
  // COULEURS PRINCIPALES - Blanc, Noir, Gris
  primary: '#000000',           // Noir comme couleur principale
  secondary: '#FFFFFF',         // Blanc comme couleur secondaire
  tertiary: '#6B7280',          // Gris moyen comme couleur tertiaire
  
  // COULEUR D'ACCENT - Or BT Groupe (conservée mais pas principale)
  accent: 'rgb(197, 157, 95)',  // Or BT Groupe - couleur d'accent
  accentLight: 'rgba(197, 157, 95, 0.1)',
  accentDark: 'rgba(197, 157, 95, 0.8)',
  accentHover: 'rgba(197, 157, 95, 0.9)',

  // PALETTE MONOCHROME - Blanc, Noir, Gris
  white: '#FFFFFF',
  black: '#000000',
  
  // Grises - Palette complète pour les nuances
  gray: {
    50: '#FAFAFA',    // Très clair
    100: '#F5F5F5',   // Clair
    200: '#E5E5E5',   // Gris très clair
    300: '#D4D4D4',   // Gris clair
    400: '#A3A3A3',   // Gris moyen-clair
    500: '#737373',   // Gris moyen
    600: '#525252',   // Gris moyen-foncé
    700: '#404040',   // Gris foncé
    800: '#262626',   // Très foncé
    900: '#171717',   // Presque noir
    950: '#0A0A0A',   // Noir profond
  },

  // COULEURS FONCTIONNELLES - Conservées pour les états
  success: '#10B981',    // Vert moderne
  warning: '#F59E0B',     // Orange moderne
  error: '#EF4444',      // Rouge moderne
  info: '#3B82F6',       // Bleu moderne

  // COULEURS DE TEXTE - Basées sur la hiérarchie noir/blanc
  text: {
    primary: '#000000',           // Noir principal
    secondary: '#6B7280',         // Gris moyen
    tertiary: '#9CA3AF',          // Gris clair
    disabled: '#D1D5DB',          // Gris très clair
    inverse: '#FFFFFF',           // Blanc sur fond sombre
    accent: 'rgb(197, 157, 95)', // Or pour les accents
  },

  // ARRIÈRE-PLANS - Hiérarchie blanc/gris
  background: {
    primary: '#FFFFFF',           // Blanc principal
    secondary: '#FAFAFA',         // Blanc cassé
    tertiary: '#F5F5F5',          // Gris très clair
    surface: '#FFFFFF',           // Surface blanche
    elevated: '#FFFFFF',         // Élévation blanche
    overlay: 'rgba(0, 0, 0, 0.5)', // Overlay sombre
  },

  // BORDURES - Basées sur les gris
  border: {
    light: '#E5E5E5',    // Bordure claire
    medium: '#D4D4D4',   // Bordure moyenne
    dark: '#A3A3A3',     // Bordure foncée
    accent: 'rgb(197, 157, 95)', // Bordure accent or
  },

  // OMBRES - Basées sur le noir
  shadow: {
    light: 'rgba(0, 0, 0, 0.05)',
    medium: 'rgba(0, 0, 0, 0.1)',
    dark: 'rgba(0, 0, 0, 0.15)',
    accent: 'rgba(197, 157, 95, 0.2)', // Ombre accent or
  },
};

export const Typography = {
  // Tailles de police
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
  },

  // Poids de police (valeurs numériques pour éviter l'erreur 'regular')
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Hauteurs de ligne
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 1000,
};

export const Shadows = {
  none: 'none',
  sm: {
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const Theme = {
  colors: Colors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows,
};

export type ThemeType = typeof Theme;