import type {
  EngagementMessage,
  MerchantEngagementPushId,
} from './merchant-engagement.types';

type Locale = 'en' | 'fr';

function loc(lang: string | null | undefined): Locale {
  return lang?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

const COPY: Record<
  MerchantEngagementPushId,
  Record<Locale, { title: string; body: string; type: string }>
> = {
  push_catalog_stalled: {
    en: {
      title: 'Add products to your store',
      body: 'Reach your first 10 products so more shoppers can discover you.',
      type: 'business_add_item',
    },
    fr: {
      title: 'Ajoutez des produits',
      body: 'Atteignez vos 10 premiers produits pour être plus visible.',
      type: 'business_add_item',
    },
  },
  push_catalog_stalled_post10: {
    en: {
      title: 'Give buyers more variety',
      body: 'Shoppers are browsing — add more products to convert views into orders.',
      type: 'business_add_item',
    },
    fr: {
      title: 'Plus de variété pour vos clients',
      body: 'Des clients consultent votre boutique — ajoutez des produits.',
      type: 'business_add_item',
    },
  },
  push_views_10: {
    en: {
      title: 'Nice — 10 store views!',
      body: 'Shoppers are discovering you. Open the app for your next step.',
      type: 'business_dashboard',
    },
    fr: {
      title: 'Bravo — 10 vues !',
      body: 'Des clients découvrent votre boutique. Ouvrez l’app pour la suite.',
      type: 'business_dashboard',
    },
  },
  push_catalog_10_congrats: {
    en: {
      title: '10 products — great start!',
      body: 'Share your storefront so more buyers can find you.',
      type: 'business_share_store',
    },
    fr: {
      title: '10 produits — beau début !',
      body: 'Partagez votre boutique pour attirer plus de clients.',
      type: 'business_share_store',
    },
  },
  push_first_order_congrats: {
    en: {
      title: 'Your first order!',
      body: 'You are officially selling. Keep your catalog fresh for the next ones.',
      type: 'business_orders',
    },
    fr: {
      title: 'Votre première commande !',
      body: 'Vous vendez officiellement. Gardez le catalogue à jour.',
      type: 'business_orders',
    },
  },
  push_ai_cleanup: {
    en: {
      title: 'Clean up product photos',
      body: 'You still have photos that look better with AI cleanup.',
      type: 'business_ai_cleanup',
    },
    fr: {
      title: 'Améliorez vos photos',
      body: 'Certaines photos peuvent être améliorées avec l’IA.',
      type: 'business_ai_cleanup',
    },
  },
  push_buy_tokens: {
    en: {
      title: 'Get more AI tokens',
      body: 'You are out of tokens and still have photos that need cleanup.',
      type: 'business_ai_tokens',
    },
    fr: {
      title: 'Obtenez plus de jetons IA',
      body: 'Vous n’avez plus de jetons et des photos à améliorer.',
      type: 'business_ai_tokens',
    },
  },
  push_hours_logo: {
    en: {
      title: 'Finish your store profile',
      body: 'Add a logo or customize business hours so buyers trust your shop.',
      type: 'business_location_hours',
    },
    fr: {
      title: 'Complétez votre profil',
      body: 'Ajoutez un logo ou vos horaires pour rassurer les clients.',
      type: 'business_location_hours',
    },
  },
  push_rejected_item: {
    en: {
      title: 'Fix a rejected product',
      body: 'Update rejected listings and resubmit so they can go live.',
      type: 'business_items_rejected',
    },
    fr: {
      title: 'Corrigez un produit refusé',
      body: 'Mettez à jour les annonces refusées et renvoyez-les.',
      type: 'business_items_rejected',
    },
  },
  push_restock_top_viewed: {
    en: {
      title: 'Restock a popular item',
      body: 'Buyers are viewing an item that is out of stock.',
      type: 'business_item_edit',
    },
    fr: {
      title: 'Réapprovisionnez un article populaire',
      body: 'Un article consulté est en rupture de stock.',
      type: 'business_item_edit',
    },
  },
  push_share_store: {
    en: {
      title: 'Share your storefront',
      body: 'Share your shop link so customers outside the app can browse.',
      type: 'business_share_store',
    },
    fr: {
      title: 'Partagez votre boutique',
      body: 'Partagez le lien pour attirer des clients hors de l’app.',
      type: 'business_share_store',
    },
  },
  push_payment_setup_nudge: {
    en: {
      title: 'Shoppers are viewing your store',
      body: 'You’re getting attention — finish payment setup so customers can buy.',
      type: 'business_payment_setup',
    },
    fr: {
      title: 'Des clients consultent votre boutique',
      body: 'Vous attirez l’attention — terminez la config. des paiements pour vendre.',
      type: 'business_payment_setup',
    },
  },
  email_weekly_digest: {
    en: {
      title: 'Your weekly store update',
      body: 'See your store readiness and the best next step this week.',
      type: 'business_dashboard',
    },
    fr: {
      title: 'Votre bilan boutique de la semaine',
      body: 'Consultez votre progression et la prochaine étape.',
      type: 'business_dashboard',
    },
  },
};

export function buildEngagementPushMessage(
  pushId: MerchantEngagementPushId,
  preferredLanguage: string | null | undefined
): EngagementMessage {
  const entry = COPY[pushId][loc(preferredLanguage)];
  return {
    title: entry.title,
    body: entry.body,
    data: { type: entry.type, persona: 'business', pushId },
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildWeeklyDigestHtml(params: {
  businessName: string;
  readinessPercent: number;
  approvedCount: number;
  catalogTarget: number;
  totalProductViews: number;
  nextStep: string;
  preferredLanguage: string | null | undefined;
}): { subject: string; html: string } {
  const fr = loc(params.preferredLanguage) === 'fr';
  const name = escapeHtml(params.businessName);
  const next = escapeHtml(params.nextStep);
  const subject = fr
    ? `Bilan boutique — ${params.businessName.replace(/[\r\n<>]/g, '')}`
    : `Store update — ${params.businessName.replace(/[\r\n<>]/g, '')}`;
  const html = fr
    ? `<p>Bonjour,</p><p>Votre boutique <strong>${name}</strong> est à <strong>${params.readinessPercent}%</strong> prête.</p><p>Produits approuvés : ${params.approvedCount}/${params.catalogTarget}. Vues : ${params.totalProductViews}.</p><p><strong>Prochaine étape :</strong> ${next}</p><p>— Rendasua</p>`
    : `<p>Hello,</p><p>Your store <strong>${name}</strong> is <strong>${params.readinessPercent}%</strong> ready.</p><p>Approved products: ${params.approvedCount}/${params.catalogTarget}. Views: ${params.totalProductViews}.</p><p><strong>Next step:</strong> ${next}</p><p>— Rendasua</p>`;
  return { subject, html };
}
