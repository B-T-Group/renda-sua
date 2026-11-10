import type { ComponentProps } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const RULES: Array<[RegExp, IconName]> = [
  [/écouteur|ecouteur|casque|headphone/i, 'headphones'],
  [/téléphone|telephone|\bphone\b|iphone|mobile/i, 'cellphone'],
  [/camera|photo|caméra|appareil/i, 'camera'],
  [/equipment|équipement|equipement/i, 'toolbox'],
  [/tool|outil|wrench/i, 'wrench'],
  [/sound|audio|speaker|sono|\bson\b/i, 'volume-high'],
  [/event|fête|party|mariage/i, 'party-popper'],
  [/power|générat|generat|électr|electric/i, 'lightning-bolt'],
  [/drone/i, 'quadcopter'],
  [/video|film|ciné/i, 'movie-open'],
  [/^other$|^autre$/i, 'shape-outline'],
];

/** How many category tiles sit beside More before the rest go behind it. */
export const RENTAL_CATEGORY_ROW = 5;

export function rentalCategoryIcon(name: string): IconName {
  return RULES.find(([pattern]) => pattern.test(name))?.[1] ?? 'tag-outline';
}

export function splitTopCategories<T>(
  categories: T[],
  visible = RENTAL_CATEGORY_ROW
): { shown: T[]; extra: T[] } {
  return { shown: categories.slice(0, visible), extra: categories.slice(visible) };
}
