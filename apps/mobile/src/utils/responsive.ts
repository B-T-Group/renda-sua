import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Calcul de la taille d'écran en pouces
const getScreenDiagonal = (): number => {
  const diagonalPixels = Math.sqrt(SCREEN_WIDTH ** 2 + SCREEN_HEIGHT ** 2);
  const pixelRatio = PixelRatio.get();
  const screenDiagonalInches = diagonalPixels / (pixelRatio * 160); // 160 dpi = base Android
  return screenDiagonalInches;
};

// Seuils pour différents types d'écrans
export const SCREEN_BREAKPOINTS = {
  SMALL: 4.5,   // Petits téléphones (4.5 pouces et moins)
  MEDIUM: 5.5,  // Téléphones moyens (4.5-5.5 pouces)
  LARGE: 6.5,   // Grands téléphones (5.5-6.5 pouces)
  XLARGE: 7.0,  // Très grands téléphones (6.5+ pouces)
};

// Tailles d'écran en pixels (largeur)
export const SCREEN_WIDTH_BREAKPOINTS = {
  SMALL: 360,   // Petits écrans
  MEDIUM: 400,  // Écrans moyens
  LARGE: 480,   // Grands écrans
};

// Détection du type d'écran
export const getScreenType = () => {
  const diagonal = getScreenDiagonal();
  const width = SCREEN_WIDTH;
  
  if (diagonal <= SCREEN_BREAKPOINTS.SMALL || width < SCREEN_WIDTH_BREAKPOINTS.SMALL) {
    return 'small';
  } else if (diagonal <= SCREEN_BREAKPOINTS.MEDIUM || width < SCREEN_WIDTH_BREAKPOINTS.MEDIUM) {
    return 'medium';
  } else if (diagonal <= SCREEN_BREAKPOINTS.LARGE || width < SCREEN_WIDTH_BREAKPOINTS.LARGE) {
    return 'large';
  } else {
    return 'xlarge';
  }
};

// Hook pour utiliser dans les composants
export const useResponsive = () => {
  const screenType = getScreenType();
  const isSmallScreen = screenType === 'small';
  const isMediumScreen = screenType === 'medium';
  const isLargeScreen = screenType === 'large';
  
  // Multiplicateurs pour ajuster les tailles
  const scale = (baseSize: number): number => {
    switch (screenType) {
      case 'small':
        return baseSize * 0.85; // Réduction de 15% sur petits écrans
      case 'medium':
        return baseSize * 0.95; // Réduction de 5% sur écrans moyens
      case 'large':
      case 'xlarge':
      default:
        return baseSize;
    }
  };
  
  // Padding et margins ajustés
  const spacing = (baseSpacing: number): number => {
    switch (screenType) {
      case 'small':
        return baseSpacing * 0.75; // Réduction de 25% des espacements
      case 'medium':
        return baseSpacing * 0.9; // Réduction de 10%
      default:
        return baseSpacing;
    }
  };
  
  // Tailles de police ajustées
  const fontSize = (baseSize: number): number => {
    switch (screenType) {
      case 'small':
        return Math.max(baseSize * 0.9, 10); // Réduction max 10%, minimum 10px
      case 'medium':
        return baseSize * 0.95;
      default:
        return baseSize;
    }
  };
  
  return {
    screenType,
    isSmallScreen,
    isMediumScreen,
    isLargeScreen,
    scale,
    spacing,
    fontSize,
    screenWidth: SCREEN_WIDTH,
    screenHeight: SCREEN_HEIGHT,
    screenDiagonal: getScreenDiagonal(),
    pixelRatio: PixelRatio.get(),
  };
};

// Utilitaires de style responsive
export const createResponsiveStyle = (
  baseStyle: any,
  options?: {
    scaleMultiplier?: number;
    spacingMultiplier?: number;
    fontSizeMultiplier?: number;
  }
) => {
  const screenType = getScreenType();
  const scaleMultiplier = options?.scaleMultiplier || 1;
  const spacingMultiplier = options?.spacingMultiplier || 1;
  const fontSizeMultiplier = options?.fontSizeMultiplier || 1;
  
  const responsiveStyle: any = { ...baseStyle };
  
  // Ajuster les tailles
  if (baseStyle.width && typeof baseStyle.width === 'number') {
    responsiveStyle.width = baseStyle.width * scaleMultiplier;
  }
  if (baseStyle.height && typeof baseStyle.height === 'number') {
    responsiveStyle.height = baseStyle.height * scaleMultiplier;
  }
  
  // Ajuster les espacements
  ['padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
   'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'gap'].forEach(prop => {
    if (baseStyle[prop] && typeof baseStyle[prop] === 'number') {
      const multiplier = screenType === 'small' ? 0.75 : screenType === 'medium' ? 0.9 : 1;
      responsiveStyle[prop] = baseStyle[prop] * multiplier * spacingMultiplier;
    }
  });
  
  // Ajuster les tailles de police
  if (baseStyle.fontSize && typeof baseStyle.fontSize === 'number') {
    const multiplier = screenType === 'small' ? 0.9 : screenType === 'medium' ? 0.95 : 1;
    responsiveStyle.fontSize = Math.max(baseStyle.fontSize * multiplier * fontSizeMultiplier, 10);
  }
  
  return responsiveStyle;
};

export default useResponsive;


