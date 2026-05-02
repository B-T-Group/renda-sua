# Internationalization (i18n) Setup

This directory contains the internationalization configuration for the frontend application, supporting English and French languages.

## Structure

```
src/i18n/
├── index.ts              # i18n configuration (HTTP backend loads JSON at runtime)
└── README.md             # This file

public/locales/
├── en.json               # English translations (served at /locales/en.json)
└── fr.json               # French translations (served at /locales/fr.json)
```

Translations are **not** bundled into the main JS chunk; only the active language file is fetched after `i18nInitPromise` resolves in `main.tsx`.

## Features

- **Automatic Language Detection**: Detects user's preferred language from browser settings
- **Language Persistence**: Remembers user's language choice in localStorage
- **Fallback Support**: Falls back to French (`fr`) if a translation is missing
- **Dynamic Language Switching**: Users can switch languages via the language switcher in the header

## Usage

### In React Components

```tsx
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('dashboard.title', 'Dashboard')}</h1>
    </div>
  );
};
```

### With Interpolation

```tsx
const message = t('messages.orderPickupSuccess', {
  defaultValue: 'Order {{orderNumber}} ready',
  orderNumber: '12345',
});
```

### Language Switching

```tsx
import { useTranslation } from 'react-i18next';

const { i18n } = useTranslation();
await i18n.changeLanguage('fr');
```

## Adding New Translations

1. **Add the English translation** in `apps/frontend/public/locales/en.json`
2. **Add the French translation** in `apps/frontend/public/locales/fr.json`
3. **Use the translation key** in your component with `t('key.path', 'Default text')`

Keep the same key structure in both JSON files.
