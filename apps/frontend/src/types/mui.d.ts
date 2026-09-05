import type {
  borderRadius,
  shadows,
  spacing,
  transitions,
} from '../theme/themeUtils';

/**
 * Brand extensions to the MUI theme: the purchase-intent `cta` palette colour
 * and the `custom` design-token bag that `theme.ts` ships.
 */
declare module '@mui/material/styles' {
  interface Palette {
    cta: PaletteColor & { soft: string };
  }

  interface PaletteOptions {
    cta?: SimplePaletteColorOptions & { soft?: string };
  }

  interface Theme {
    custom: {
      spacing: typeof spacing;
      borderRadius: typeof borderRadius;
      shadows: typeof shadows;
      transitions: typeof transitions;
      zIndex: Record<string, number>;
      breakpoints: Record<string, number>;
    };
  }

  interface ThemeOptions {
    custom?: Theme['custom'];
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    cta: true;
  }
}

declare module '@mui/material/IconButton' {
  interface IconButtonPropsColorOverrides {
    cta: true;
  }
}

declare module '@mui/material/Fab' {
  interface FabPropsColorOverrides {
    cta: true;
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    cta: true;
  }
}

declare module '@mui/material/SvgIcon' {
  interface SvgIconPropsColorOverrides {
    cta: true;
  }
}
