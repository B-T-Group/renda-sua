# Assets Rendasua Agent

Ajoute ici les visuels de l’app (mode clair uniquement).

Logo déplacé depuis le frontend : **rendasua.svg** (fichier source).

| Fichier | Usage |
|--------|--------|
| `rendasua.svg` | Source design ; chargé sur **Expo web** (`Logo` component) |
| `rendasua.png` | **iOS / Android** — React Native `Image` ne charge pas les SVG ; même visuel que le SVG |

Quand le logo change, mettre à jour le SVG puis ré-exporter `rendasua.png` (1024×1024 pour l’icône app si besoin).

> **Note :** ce SVG contient une image PNG en base64, pas des tracés vectoriels. `react-native-svg` ne peut pas le recoloriser comme un vrai SVG. Pour un logo 100 % vectoriel, exporter des paths depuis Figma/Illustrator.

## Fichiers attendus pour Expo

| Fichier | Usage | Recommandation |
|--------|--------|-----------------|
| `icon.png` | Icône app | 1024×1024 px |
| `splash-icon.png` | Logo au centre du splash | Fond transparent, ~400×400 px |
| `adaptive-icon.png` | Android adaptive icon | 1024×1024 px, zone safe 66 % centre |
| `android-icon-background.png` | Fond icône Android | Couleur unie ou dégradé (#fbfbfd / #1e40af) |
| `favicon.png` | Web | 48×48 px |

## Couleurs du thème (pour cohérence)

- Fond clair : `#fbfbfd`
- Primaire (bleu) : `#1e40af`
- Secondaire (vert) : `#16a34a`

Tu peux réutiliser le logo du projet web (renda-sua) :  
`renda-sua/apps/frontend/src/assets/rendasua.svg`  
→ Exporter en PNG pour l’app mobile (icône + splash).

Sans ces fichiers, Expo utilisera des images par défaut au premier lancement.
