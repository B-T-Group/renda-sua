# Internationalization (i18n) Setup

This directory contains the internationalization configuration for the frontend application, supporting English and French languages.

## Structure

```
src/i18n/
├── index.ts              # i18n configuration
├── locales/
│   ├── en.json          # English translations
│   └── fr.json          # French translations
└── README.md            # This file
```

## Features

- **Automatic Language Detection**: Detects user's preferred language from browser settings
- **Language Persistence**: Remembers user's language choice in localStorage
- **Fallback Support**: Falls back to English if a translation is missing
- **Dynamic Language Switching**: Users can switch languages via the language switcher in the header

## Usage

### In React Components

```tsx
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.welcomeBack')}</p>
    </div>
  );
};
```

### With Interpolation

```tsx
// For dynamic values
const message = t('messages.orderPickupSuccess', { orderNumber: '12345' });
// Result: "Successfully picked up order #12345!" (EN) or "Commande #12345 récupérée avec succès !" (FR)
```

### Language Switching

```tsx
import { useTranslation } from 'react-i18next';

const { i18n } = useTranslation();

// Switch to French
i18n.changeLanguage('fr');

// Switch to English
i18n.changeLanguage('en');
```

## Translation Keys

The translation files are organized into logical sections:

- `common`: Common UI elements (buttons, labels, etc.)
- `dashboard`: Dashboard-specific text
- `orderStatus`: Order status labels
- `orderActions`: Order action buttons and messages
- `forms`: Form field labels
- `business`: Business-related terms
- `notifications`: Success/error notification messages
- `messages`: User-facing messages
- `orderCard`: Order card component text

## Adding New Translations

1. **Add the English translation** in `locales/en.json`
2. **Add the French translation** in `locales/fr.json`
3. **Use the translation key** in your component with `t('key.path')`

### Example

```json
// en.json
{
  "newSection": {
    "welcome": "Welcome to our app"
  }
}

// fr.json
{
  "newSection": {
    "welcome": "Bienvenue dans notre application"
  }
}
```

```tsx
// In component
const { t } = useTranslation();
return <h1>{t('newSection.welcome')}</h1>;
```

## Language Detection

The app automatically detects the user's preferred language in this order:

1. **localStorage**: Previously selected language
2. **navigator**: Browser language settings
3. **htmlTag**: HTML lang attribute
4. **fallback**: English (default)

## Development

- **Debug Mode**: In development, i18n debug mode is enabled to help identify missing translations
- **Missing Keys**: Missing translation keys will show the key name in the UI
- **Hot Reload**: Translation changes are reflected immediately during development

## Best Practices

1. **Use descriptive keys**: `dashboard.activeOrders` instead of `activeOrders`
2. **Group related translations**: Keep related translations in the same section
3. **Use interpolation for dynamic content**: `t('message', { variable: value })`
4. **Keep translations consistent**: Use the same terminology across the app
5. **Test both languages**: Always test your changes in both English and French

## Available Languages

- **English (en)**: Default language
- **French (fr)**: Primary alternative language

## Language Switcher

The language switcher is available in the header and allows users to:

- See the current language
- Switch between English and French
- Have their choice remembered for future visits
