import type {
  BroadcastActionType,
  BroadcastTemplateKey,
} from './dto/admin-broadcast.dto';

export interface BilingualBroadcastCopy {
  titleEn: string;
  bodyEn: string;
  titleFr: string;
  bodyFr: string;
}

const APP_UPGRADE: BilingualBroadcastCopy = {
  titleEn: 'Update Rendasua',
  bodyEn:
    'A new version of Rendasua is available. Update the app to get the latest features, fixes, and improvements.',
  titleFr: 'Mettez à jour Rendasua',
  bodyFr:
    'Une nouvelle version de Rendasua est disponible. Mettez à jour l’application pour profiter des dernières fonctionnalités, corrections et améliorations.',
};

const ACCOUNT_SETUP: BilingualBroadcastCopy = {
  titleEn: 'Finish payment setup',
  bodyEn:
    'Your catalog looks ready. Complete your payment account setup so you can start receiving orders on Rendasua.',
  titleFr: 'Terminez la configuration des paiements',
  bodyFr:
    'Votre catalogue semble prêt. Terminez la configuration de votre compte de paiement pour commencer à recevoir des commandes sur Rendasua.',
};

export function cannedBroadcastCopy(
  templateKey: BroadcastTemplateKey
): BilingualBroadcastCopy | null {
  if (templateKey === 'app_upgrade') return APP_UPGRADE;
  if (templateKey === 'business_account_setup') return ACCOUNT_SETUP;
  return null;
}

export function actionTypeForTemplate(
  templateKey: BroadcastTemplateKey
): BroadcastActionType {
  if (templateKey === 'app_upgrade') return 'app_upgrade';
  if (templateKey === 'business_account_setup') return 'business_account_setup';
  return 'generic';
}

export function messageTypeForAction(action: BroadcastActionType): string {
  if (action === 'app_upgrade') return 'ADMIN_APP_UPGRADE';
  if (action === 'business_account_setup') return 'ADMIN_ACCOUNT_SETUP';
  return 'ADMIN_BROADCAST';
}
