export interface PersonaFeature {
  key: string;
  defaultLabel: string;
}

export interface PersonaContent {
  id: 'client' | 'business' | 'agent';
  nameKey: string;
  defaultName: string;
  taglineKey: string;
  defaultTagline: string;
  descriptionKey: string;
  defaultDescription: string;
  features: PersonaFeature[];
  primaryCtaKey: string;
  defaultPrimaryCta: string;
  primaryCtaPath?: string;
  secondaryCtaKey?: string;
  defaultSecondaryCta?: string;
  secondaryCtaPath?: string;
  accentColor: string;
}

export const personaContentData: PersonaContent[] = [
  {
    id: 'client',
    nameKey: 'home.personas.client.name',
    defaultName: 'Shopper',
    taglineKey: 'home.personas.client.tagline',
    defaultTagline: 'Own it or rent it. Locally.',
    descriptionKey: 'home.personas.client.description',
    defaultDescription:
      "Want to own something? We've got your back. Just want to rent it? We've still got your back. Browse local products and rentals, then track delivery in real time.",
    features: [
      { key: 'home.personas.client.features.browse', defaultLabel: 'Browse & order products — or book rentals' },
      { key: 'home.personas.client.features.tracking', defaultLabel: 'Real-time delivery tracking' },
      { key: 'home.personas.client.features.chat', defaultLabel: 'Chat with businesses & agents' },
      { key: 'home.personas.client.features.pin', defaultLabel: 'Secure delivery PIN verification' },
      { key: 'home.personas.client.features.addresses', defaultLabel: 'Multiple delivery addresses' },
      { key: 'home.personas.client.features.notifications', defaultLabel: 'Instant push notifications' },
    ],
    primaryCtaKey: 'home.personas.client.cta',
    defaultPrimaryCta: 'Download the App',
    secondaryCtaKey: 'home.personas.client.secondaryCta',
    defaultSecondaryCta: 'Browse Items',
    secondaryCtaPath: '/items',
    accentColor: '#1e40af',
  },
  {
    id: 'business',
    nameKey: 'home.personas.business.name',
    defaultName: 'Business',
    taglineKey: 'home.personas.business.tagline',
    defaultTagline: 'Your storefront, online in minutes.',
    descriptionKey: 'home.personas.business.description',
    defaultDescription:
      'Create your online storefront, list products and rentals, manage inventory, and start receiving orders from customers in your city.',
    features: [
      { key: 'home.personas.business.features.storefront', defaultLabel: 'Create your online storefront' },
      { key: 'home.personas.business.features.inventory', defaultLabel: 'Manage inventory across locations' },
      { key: 'home.personas.business.features.ai', defaultLabel: 'AI-assisted product descriptions' },
      { key: 'home.personas.business.features.orders', defaultLabel: 'Order, rental & delivery management' },
      { key: 'home.personas.business.features.messaging', defaultLabel: 'Message customers & agents' },
      { key: 'home.personas.business.features.growth', defaultLabel: 'Analytics & growth tools' },
    ],
    primaryCtaKey: 'home.personas.business.cta',
    defaultPrimaryCta: 'Create Business Account',
    primaryCtaPath: '/signup?intent=business_sell',
    secondaryCtaKey: 'home.personas.business.secondaryCta',
    defaultSecondaryCta: 'Learn more',
    secondaryCtaPath: '/for-business',
    accentColor: '#16a34a',
  },
  {
    id: 'agent',
    nameKey: 'home.personas.agent.name',
    defaultName: 'Delivery Agent',
    taglineKey: 'home.personas.agent.tagline',
    defaultTagline: 'Deliver on your schedule.',
    descriptionKey: 'home.personas.agent.description',
    defaultDescription:
      'Accept delivery requests, navigate efficiently, and earn money on your own terms with the Rendasua agent app.',
    features: [
      { key: 'home.personas.agent.features.requests', defaultLabel: 'Receive & manage delivery requests' },
      { key: 'home.personas.agent.features.navigation', defaultLabel: 'Efficient in-app navigation' },
      { key: 'home.personas.agent.features.chat', defaultLabel: 'Chat with businesses & customers' },
      { key: 'home.personas.agent.features.pin', defaultLabel: 'Secure delivery PIN verification' },
      { key: 'home.personas.agent.features.tracking', defaultLabel: 'Delivery tracking & history' },
      { key: 'home.personas.agent.features.flexible', defaultLabel: 'Flexible, set your own hours' },
    ],
    primaryCtaKey: 'home.personas.agent.cta',
    defaultPrimaryCta: 'Download the App',
    secondaryCtaKey: 'home.personas.agent.secondaryCta',
    defaultSecondaryCta: 'Learn more',
    secondaryCtaPath: '/become-a-delivery-agent',
    accentColor: '#0891b2',
  },
];
