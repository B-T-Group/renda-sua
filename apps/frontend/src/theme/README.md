# Rendasua Theme System

This document describes the comprehensive theme system used in the Rendasua frontend application. The theme system is designed to provide consistent styling across all components while avoiding hardcoded values.

## Overview

The theme system consists of:

- **Base Theme**: MUI theme with custom colors, typography, and component overrides
- **Theme Utilities**: Helper functions and design tokens for consistent styling
- **Custom Hook**: Enhanced `useTheme` hook that provides easy access to theme values
- **Component Styles**: Pre-defined styles for common UI patterns

## Files Structure

```
src/theme/
├── theme.ts          # Main MUI theme configuration
├── themeUtils.ts     # Theme utilities and design tokens
└── README.md         # This documentation

src/hooks/
└── useTheme.ts       # Enhanced useTheme hook

src/components/examples/
└── (examples removed for production build)
```

## Usage

### Basic Usage

```tsx
import { useTheme } from '../hooks/useTheme';

const MyComponent = () => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        bgcolor: theme.colors.primary.main,
        p: theme.spacing.md,
        borderRadius: theme.radius.lg,
      }}
    >
      <Typography sx={{ color: theme.colors.primary.contrast }}>Hello World</Typography>
    </Box>
  );
};
```

### Using Pre-defined Styles

```tsx
import { useTheme } from '../hooks/useTheme';

const MyComponent = () => {
  const theme = useTheme();

  return (
    <Card sx={theme.styles.card}>
      <CardContent>
        <Typography variant="h6">Card Title</Typography>
        <Typography variant="body2">Card content</Typography>
      </CardContent>
    </Card>
  );
};
```

## Theme API

### Colors

```tsx
theme.colors.primary.main; // Primary color
theme.colors.primary.light; // Light variant
theme.colors.primary.dark; // Dark variant
theme.colors.primary.contrast; // Contrast text color
theme.colors.primary.withOpacity(0.5); // With opacity

// Available color palettes:
// - primary, secondary, success, warning, error, info
// - background, text
```

### Spacing

```tsx
theme.spacing.xs; // 8px
theme.spacing.sm; // 16px
theme.spacing.md; // 24px
theme.spacing.lg; // 32px
theme.spacing.xl; // 48px
theme.spacing.xxl; // 64px
```

### Border Radius

```tsx
theme.radius.xs; // 4px
theme.radius.sm; // 8px
theme.radius.md; // 12px
theme.radius.lg; // 16px
theme.radius.xl; // 20px
theme.radius.xxl; // 24px
theme.radius.round; // 50%
```

### Shadows

```tsx
theme.elevation.none; // No shadow
theme.elevation.xs; // Subtle shadow
theme.elevation.sm; // Small shadow
theme.elevation.md; // Medium shadow
theme.elevation.lg; // Large shadow
theme.elevation.xl; // Extra large shadow
theme.elevation.xxl; // Maximum shadow
```

### Typography

```tsx
// Responsive typography
theme.utils.typography.responsive.h1; // Responsive h1
theme.utils.typography.responsive.h2; // Responsive h2
theme.utils.typography.responsive.h3; // Responsive h3
theme.utils.typography.responsive.body; // Responsive body text
theme.utils.typography.responsive.caption; // Responsive caption
```

### Animations

```tsx
theme.animation.fast; // 0.15s ease-out
theme.animation.normal; // 0.3s ease-out
theme.animation.slow; // 0.5s ease-out
theme.animation.bounce; // 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)
```

## Pre-defined Component Styles

### Card Styles

```tsx
theme.styles.card;
// Provides: border radius, shadow, border, hover effects
```

### Button Styles

```tsx
theme.styles.button;
// Provides: border radius, text transform, font weight, transitions
```

### Input Styles

```tsx
theme.styles.input;
// Provides: border radius, focus states, hover effects
```

### Container Styles

```tsx
theme.styles.container;
// Provides: responsive padding
```

### Section Styles

```tsx
theme.styles.section;
// Provides: responsive vertical padding
```

### Hero Section Styles

```tsx
theme.styles.hero;
// Provides: gradient background, overlay effects, positioning
```

### Trust Signal Styles

```tsx
theme.styles.trustSignal;
// Provides: flex layout, alignment, typography
```

### Step Number Styles

```tsx
theme.styles.stepNumber(color);
// Provides: circular badge with number, positioning
```

### Benefit Card Styles

```tsx
theme.styles.benefitCard;
// Provides: white background, blue border, hover effects
```

### Icon Container Styles

```tsx
theme.styles.iconContainer(color);
// Provides: circular container with background color
```

## Utility Functions

### Color with Opacity

```tsx
theme.getColorWithOpacity('primary', 0.5);
// Returns: rgba(30, 64, 175, 0.5)
```

### Responsive Spacing

```tsx
theme.getResponsiveSpacing('md');
// Returns: theme.spacing(3) // 24px
```

### Shadow

```tsx
theme.getShadow('lg');
// Returns: '0px 10px 15px rgba(0, 0, 0, 0.1), 0px 4px 6px rgba(0, 0, 0, 0.05)'
```

### Border Radius

```tsx
theme.getBorderRadius('lg');
// Returns: 16
```

## Best Practices

### 1. Use Theme Values Instead of Hardcoded Styles

```tsx
// ❌ Bad - Hardcoded values
<Box sx={{
  padding: '24px',
  backgroundColor: '#1e40af',
  borderRadius: '16px'
}}>

// ✅ Good - Theme values
<Box sx={{
  p: theme.spacing.md,
  bgcolor: theme.colors.primary.main,
  borderRadius: theme.radius.lg
}}>
```

### 2. Use Pre-defined Styles When Available

```tsx
// ❌ Bad - Custom styling
<Card sx={{
  borderRadius: 20,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  border: '1px solid rgba(0, 0, 0, 0.04)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
    transform: 'translateY(-2px)',
  },
}}>

// ✅ Good - Pre-defined style
<Card sx={theme.styles.card}>
```

### 3. Use Responsive Typography

```tsx
// ❌ Bad - Fixed typography
<Typography sx={{ fontSize: '2rem', fontWeight: 700 }}>

// ✅ Good - Responsive typography
<Typography sx={theme.utils.typography.responsive.h2}>
```

### 4. Use Semantic Color Names

```tsx
// ❌ Bad - Direct color values
<Box sx={{ color: '#1e40af' }}>

// ✅ Good - Semantic color names
<Box sx={{ color: theme.colors.primary.main }}>
```

### 5. Use Consistent Spacing

```tsx
// ❌ Bad - Inconsistent spacing
<Box sx={{ p: 2, m: 3, gap: 1.5 }}>

// ✅ Good - Consistent spacing
<Box sx={{
  p: theme.spacing.sm,
  m: theme.spacing.md,
  gap: theme.spacing.xs
}}>
```

## Migration Guide

### From Hardcoded Styles to Theme System

1. **Replace hardcoded colors** with `theme.colors.*`
2. **Replace hardcoded spacing** with `theme.spacing.*`
3. **Replace hardcoded border radius** with `theme.radius.*`
4. **Replace hardcoded shadows** with `theme.elevation.*`
5. **Use pre-defined styles** when available
6. **Use responsive typography** for text elements

### Example Migration

```tsx
// Before
const OldComponent = () => (
  <Box
    sx={{
      backgroundColor: '#1e40af',
      padding: '24px',
      borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    }}
  >
    <Typography
      sx={{
        fontSize: '1.5rem',
        fontWeight: 600,
        color: '#ffffff',
      }}
    >
      Title
    </Typography>
  </Box>
);

// After
const NewComponent = () => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        bgcolor: theme.colors.primary.main,
        p: theme.spacing.md,
        borderRadius: theme.radius.lg,
        boxShadow: theme.elevation.md,
      }}
    >
      <Typography
        sx={{
          ...theme.utils.typography.responsive.h3,
          color: theme.colors.primary.contrast,
        }}
      >
        Title
      </Typography>
    </Box>
  );
};
```

## Examples

The theme system is used throughout the application components. Check existing components for usage patterns.

## Color Palette — Trust Coast Blue

All brand colours live in `src/theme/brandTokens.ts` and flow into the MUI palette. Read them from `theme.palette.*` (or `brandTokens` when you are outside a component) instead of inlining a hex.

| Role | Token | Hex | Used for |
| --- | --- | --- | --- |
| Primary | `palette.primary.main` | `#1E3A8A` | App chrome, links, secondary actions, client persona |
| Secondary | `palette.secondary.main` | `#0F766E` | Delivery and agent chrome |
| CTA | `palette.cta.main` | `#C2410C` | Buy / Pay / Checkout only, business persona accent |
| CTA soft | `palette.cta.soft` | `#FFEDD5` | Low-emphasis accent surfaces |
| Success | `palette.success.main` | `#15803D` | Completed deliveries and confirmations |
| Error | `palette.error.main` | `#B91C1C` | Failures and destructive actions |
| Warning | `palette.warning.main` | `#B45309` | Pending and needs-attention states |
| Info | `palette.info.main` | `#0E7490` | Tracking information |
| Background | `palette.background.default` | `#F8FAFC` | App background |
| Paper | `palette.background.paper` | `#FFFFFF` | Cards and sheets |
| Text | `palette.text.primary` | `#0F172A` | Body copy |
| Muted | `palette.text.secondary` | `#64748B` | Secondary copy (AA on the app background) |

### Colour rules

- **Orange is purchase intent only.** Use `color="cta"` on Buy, Buy now, Order now, Place order, Proceed to checkout, Pay now and payment-retry buttons. Everything else — including "Add to cart" when it sits beside a purchase button — stays primary blue.
- **Personas**: client → primary, agent → secondary, business → CTA/accent family (`constants/personaTheme.ts`).
- **MoMo yellow** belongs on payment badges only, never on app chrome.
- **White text on filled surfaces** only where contrast is ≥ 4.5:1. Every `*.main` token above clears that against `#FFFFFF`.
- **Blockers** render as soft alert cards with a left accent (the `MuiAlert` theme override does this), not solid colour-on-colour banners.

## Typography Scale

The typography system uses a responsive scale:

- **H1**: 2.25rem → 3.5rem (responsive)
- **H2**: 1.75rem → 2.5rem (responsive)
- **H3**: 1.5rem → 2rem (responsive)
- **Body**: 1rem → 1.1rem (responsive)
- **Caption**: 0.875rem → 0.95rem (responsive)

## Contributing

When adding new components or styles:

1. Check if a similar style already exists in `theme.styles.*`
2. Use theme utilities instead of hardcoded values
3. Follow the established naming conventions
4. Update this documentation if adding new utilities
5. Add examples to existing components if creating new patterns

## Troubleshooting

### Common Issues

1. **TypeScript errors**: Make sure to import the custom `useTheme` hook, not the MUI one
2. **Missing styles**: Check if the style exists in `theme.styles.*` or create a new one
3. **Inconsistent spacing**: Always use `theme.spacing.*` values
4. **Color issues**: Use semantic color names from `theme.colors.*`

### Getting Help

- Review existing components for theme usage examples
- Consult this documentation for available utilities
