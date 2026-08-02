function normalizeLanguage(lang?: string | null): 'en' | 'fr' {
  return lang?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function formatDueTime(iso?: string | null, locale: 'en' | 'fr' = 'en'): string {
  if (!iso) return locale === 'fr' ? 'bientôt' : 'soon';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return locale === 'fr' ? 'bientôt' : 'soon';
  return d.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function buildPickupReminderPushMessage(params: {
  orderNumber: string;
  businessName?: string | null;
  pickupDueAt?: string | null;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const due = formatDueTime(params.pickupDueAt, locale);
  const biz = params.businessName?.trim() || (locale === 'fr' ? 'le magasin' : 'the store');
  if (locale === 'fr') {
    return {
      title: 'Rappel de collecte',
      body: `Commande ${params.orderNumber} à récupérer avant ${due}. Rendez-vous chez ${biz}.`,
    };
  }
  return {
    title: 'Pickup reminder',
    body: `Order ${params.orderNumber} should be collected by ${due}. Head to ${biz} now.`,
  };
}

export function buildPickupAtRiskAgentPushMessage(params: {
  orderNumber: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  if (locale === 'fr') {
    return {
      title: 'Collecte en retard',
      body: `Votre collecte pour ${params.orderNumber} est en retard. Touchez « En retard » pour ajouter du temps, ou libérez la commande.`,
    };
  }
  return {
    title: 'Pickup running late',
    body: `Your pickup for ${params.orderNumber} is running late. Tap Running late to add time, or release the order.`,
  };
}

export function buildPickupAtRiskBusinessPushMessage(params: {
  orderNumber: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  if (locale === 'fr') {
    return {
      title: 'Livreur en retard',
      body: `Le livreur assigné à la commande ${params.orderNumber} est en retard. Nous trouvons une solution.`,
    };
  }
  return {
    title: 'Agent running late',
    body: `Your assigned agent is running late for order ${params.orderNumber}. We're on it.`,
  };
}

export function buildPickupOverdueAgentPushMessage(params: {
  orderNumber: string;
  reassignmentInMinutes: number;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const n = Math.max(1, params.reassignmentInMinutes);
  if (locale === 'fr') {
    return {
      title: 'Collecte en retard',
      body: `Commande ${params.orderNumber} en retard. Elle pourra être réassignée dans ${n} min.`,
    };
  }
  return {
    title: 'Pickup overdue',
    body: `Order ${params.orderNumber} is overdue for pickup. It may be reassigned in ${n} minutes.`,
  };
}

export function buildPickupOverdueCustomerPushMessage(params: {
  orderNumber: string;
  estimatedDeliveryTime?: string | null;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const eta = formatDueTime(params.estimatedDeliveryTime, locale);
  if (locale === 'fr') {
    return {
      title: 'Livraison un peu plus longue',
      body: `Votre commande ${params.orderNumber} prend un peu plus de temps. Nouvelle estimation : ${eta}.`,
    };
  }
  return {
    title: 'Delivery taking a bit longer',
    body: `Your order ${params.orderNumber} is taking slightly longer than expected. New estimated delivery: ${eta}.`,
  };
}

export function buildPickupReassignedAgentPushMessage(params: {
  orderNumber: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  if (locale === 'fr') {
    return {
      title: 'Commande réassignée',
      body: `La commande ${params.orderNumber} a été réassignée. Votre caution a été libérée.`,
    };
  }
  return {
    title: 'Order reassigned',
    body: `Order ${params.orderNumber} was reassigned. Your hold has been released.`,
  };
}

export function buildPickupReassignedBusinessPushMessage(params: {
  orderNumber: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  if (locale === 'fr') {
    return {
      title: 'Recherche d’un nouveau livreur',
      body: `Nous cherchons un nouveau livreur pour la commande ${params.orderNumber}.`,
    };
  }
  return {
    title: 'Finding a new agent',
    body: `We're finding a new agent for order ${params.orderNumber}.`,
  };
}

export function buildPickupReassignedCustomerPushMessage(params: {
  orderNumber: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  if (locale === 'fr') {
    return {
      title: 'Nouveau livreur',
      body: `Nous avons assigné un nouveau livreur à votre commande ${params.orderNumber}.`,
    };
  }
  return {
    title: 'New delivery agent',
    body: `We've assigned a new delivery agent to your order ${params.orderNumber}.`,
  };
}

export function buildPickupEscalationPushMessage(params: {
  orderNumber: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  if (locale === 'fr') {
    return {
      title: 'Aide requise',
      body: `La commande ${params.orderNumber} nécessite une intervention. Touchez pour voir vos options.`,
    };
  }
  return {
    title: 'Help needed',
    body: `Order ${params.orderNumber} needs attention. Tap to see your options.`,
  };
}
