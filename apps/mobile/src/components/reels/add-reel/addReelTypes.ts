export type AddReelMode = 'ai' | 'upload';

export type AddReelWizardStep = 'mode' | 'tips' | 'product' | 'compose';

export type PickerProduct = {
  subjectType: 'item' | 'rental';
  subjectId: string;
  name: string;
  imageUrl: string | null;
};

export const ADD_REEL_STEP_ORDER: AddReelWizardStep[] = [
  'mode',
  'tips',
  'product',
  'compose',
];

export const ADD_REEL_STEP_COUNT = ADD_REEL_STEP_ORDER.length;
