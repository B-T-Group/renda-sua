# Mobile app (Renda Sua)

Phase 1 tip-only import into the monorepo.

**Git history** remains in [GROUPE-B-T/mobile-rendasua](https://github.com/GROUPE-B-T/mobile-rendasua). This tree is a tip copy only (no subtree/filter-repo).

`MANUAL_ENV` is set to `null` in `app.config.ts` and `src/config/envSwitch.ts` (production default).

# Rendasua Agent – Application mobile

App mobile (Expo) pour les **agents** (livreurs). **Mode clair uniquement** – pas de thème sombre.

## Thème

- **Couleurs** : alignées sur le frontend `renda-sua` (primaire `#1e40af`, secondaire `#16a34a`, fond `#fbfbfd`).
- **Typo** : `src/theme/typography.js`.
- **Espacements** : `src/theme/spacing.js`.
- **Usage** : `import { useTheme } from './src/contexts/ThemeContext'` puis `theme.colors`, `theme.typography`, etc.

L’interface système est en **light** (`userInterfaceStyle: "light"` dans `app.json`).

## Assets (logo, splash)

Les chemins sont dans `app.json` ; les fichiers à ajouter sont décrits dans **`assets/README.md`**. Tu peux t’inspirer du logo du frontend : `renda-sua/apps/frontend/src/assets/rendasua.svg` (à exporter en PNG pour l’app).

## Lancer l’app

```bash
npm install
npx expo start
```

Puis scanner le QR code avec Expo Go ou lancer un simulateur.
