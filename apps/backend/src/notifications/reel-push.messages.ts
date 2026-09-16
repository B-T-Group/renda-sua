export type ReelPushLocale = 'en' | 'fr';

function locale(lang?: string | null): ReelPushLocale {
  return (lang || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function buildReelModerationApprovedPush(params: {
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = locale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Votre reel est en ligne' : 'Your reel is live',
    body: fr
      ? 'Votre vidéo a été approuvée et est visible dans le fil Reels.'
      : 'Your video was approved and is now visible in the Reels feed.',
  };
}

export function buildReelPendingReviewPush(params: {
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = locale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Reel prêt pour revue' : 'Reel ready for review',
    body: fr
      ? 'Votre vidéo est prête et attend une validation avant d’être publiée.'
      : 'Your video is ready and waiting for approval before it goes live.',
  };
}

export function buildReelGenerationFailedPush(params: {
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = locale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Échec de génération du reel' : 'Reel generation failed',
    body: fr
      ? 'Nous n’avons pas pu terminer votre reel. Ouvrez Mes reels pour réessayer ou le supprimer.'
      : 'We could not finish your reel. Open My reels to retry or delete it.',
  };
}

export function buildReelModerationRejectedPush(params: {
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = locale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Reel non approuvé' : 'Reel not approved',
    body: fr
      ? 'Votre vidéo ne respecte pas nos règles. Ouvrez l’app pour les détails.'
      : 'Your video did not meet our guidelines. Open the app for details.',
  };
}

export function buildReelEngagementPush(params: {
  viewCount: number;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = locale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Votre reel performe' : 'Your reel is getting views',
    body: fr
      ? `${params.viewCount} vues sur votre dernière vidéo.`
      : `${params.viewCount} views on your latest reel.`,
  };
}

export function buildFollowedStoreReelPush(params: {
  businessName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = locale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Nouveau reel' : 'New reel',
    body: fr
      ? `${params.businessName} a publié une nouvelle vidéo.`
      : `${params.businessName} posted a new video.`,
  };
}

export function buildReelCommentReplyPush(params: {
  businessName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = locale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Réponse à votre commentaire' : 'Reply to your comment',
    body: fr
      ? `${params.businessName} a répondu sur un reel.`
      : `${params.businessName} replied on a reel.`,
  };
}
