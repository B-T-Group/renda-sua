import type { ComponentProps } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const RULES: Array<[RegExp, IconName]> = [
  [/camera|photo|caméra|appareil/i, 'camera'],
  [/tool|outil|wrench/i, 'wrench'],
  [/sound|audio|speaker|sono|son\b/i, 'volume-high'],
  [/event|fête|party|mariage/i, 'party-popper'],
  [/power|générat|generat|électr|electric/i, 'lightning-bolt'],
  [/drone/i, 'quadcopter'],
  [/video|film|ciné/i, 'movie-open'],
];

export function rentalCategoryIcon(name: string): IconName {
  return RULES.find(([pattern]) => pattern.test(name))?.[1] ?? 'tag-outline';
}
