export interface HomeFaqItem {
  questionKey: string;
  defaultQuestion: string;
  answerKey: string;
  defaultAnswer: string;
}

export const homeFaqItems: HomeFaqItem[] = [
  {
    questionKey: 'home.faq.whatIsRendasua.question',
    defaultQuestion: 'What is Rendasua?',
    answerKey: 'home.faq.whatIsRendasua.answer',
    defaultAnswer:
      "Rendasua is a local marketplace for buying and renting. Want to own something? We've got your back. Just want to rent it? We've still got your back — with delivery agents who bring it to your door.",
  },
  {
    questionKey: 'home.faq.howDoIOrder.question',
    defaultQuestion: 'How do I place an order?',
    answerKey: 'home.faq.howDoIOrder.answer',
    defaultAnswer:
      'Download the Rendasua app, browse products or rentals from local businesses near you, add items to your cart or book a rental, and checkout. A delivery agent will pick up and bring your order to you.',
  },
  {
    questionKey: 'home.faq.canITrack.question',
    defaultQuestion: 'Can I track my delivery in real time?',
    answerKey: 'home.faq.canITrack.answer',
    defaultAnswer:
      'Yes! The Rendasua app provides live tracking so you can see exactly where your delivery agent is and get an estimated arrival time.',
  },
  {
    questionKey: 'home.faq.howSellBusiness.question',
    defaultQuestion: 'How do I start selling as a business?',
    answerKey: 'home.faq.howSellBusiness.answer',
    defaultAnswer:
      'Create a free business account on rendasua.com, set up your storefront, add your products, and start receiving orders from customers in your community.',
  },
  {
    questionKey: 'home.faq.howBecomeAgent.question',
    defaultQuestion: 'How do I become a delivery agent?',
    answerKey: 'home.faq.howBecomeAgent.answer',
    defaultAnswer:
      'Download the Rendasua app, sign up as a delivery agent, complete the onboarding steps, and start accepting delivery requests on your schedule.',
  },
  {
    questionKey: 'home.faq.pinDelivery.question',
    defaultQuestion: 'What is the delivery PIN?',
    answerKey: 'home.faq.pinDelivery.answer',
    defaultAnswer:
      'A delivery PIN is a secure 4-digit code shared with you when your order is out for delivery. The agent must scan your PIN to confirm a successful handover, protecting you from fraudulent deliveries.',
  },
  {
    questionKey: 'home.faq.isItFree.question',
    defaultQuestion: 'Is the Rendasua app free?',
    answerKey: 'home.faq.isItFree.answer',
    defaultAnswer:
      'The Rendasua app is free to download and use for shoppers. Businesses pay a small commission on orders processed through the platform.',
  },
  {
    questionKey: 'home.faq.availableWhere.question',
    defaultQuestion: 'Where is Rendasua available?',
    answerKey: 'home.faq.availableWhere.answer',
    defaultAnswer:
      'Rendasua is available in Gabon and Cameroon and expanding rapidly. Check the app for the latest available cities and regions.',
  },
];
