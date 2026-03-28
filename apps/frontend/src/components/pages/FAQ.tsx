import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Container,
  Divider,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface FaqItem {
  key: string;
  q: string;
  a: string;
}

const FAQ: React.FC = () => {
  const { t } = useTranslation();

  const clientFaqs: FaqItem[] = [
    {
      key: 'howToOrder',
      q: t('faq.client.howToOrder.q', 'How do I place an order?'),
      a: t('faq.client.howToOrder.a', 'Browse items, add them to your cart, and go to checkout. Choose your delivery address and confirm. A payment request will be sent to your mobile phone to complete the order.'),
    },
    {
      key: 'paymentMethods',
      q: t('faq.client.paymentMethods.q', 'What payment methods are accepted?'),
      a: t('faq.client.paymentMethods.a', 'We accept mobile money: Airtel Money, MTN Mobile Money, and Moov Money. At checkout, a payment request is sent to your phone—approve it to confirm your order.'),
    },
    {
      key: 'trackOrder',
      q: t('faq.client.trackOrder.q', 'How do I track my order?'),
      a: t(
        'faq.client.trackOrder.a',
        'You can track your order from your dashboard or the order details page. You will see status updates from confirmation through to delivery. When your order is out for delivery, you can see your driver’s live location on a map (with a clear “View agent location on map” action), along with pickup and delivery addresses.'
      ),
    },
    {
      key: 'deliveryTime',
      q: t('faq.client.deliveryTime.q', 'How long does delivery take?'),
      a: t('faq.client.deliveryTime.a', 'Delivery times depend on your location and the seller. Standard delivery is typically within 24–48 hours. Fast delivery options may be available at checkout for quicker delivery.'),
    },
    {
      key: 'cancelOrder',
      q: t('faq.client.cancelOrder.q', 'Can I cancel my order?'),
      a: t('faq.client.cancelOrder.a', 'Orders can be cancelled within a short time after placement if they have not yet been confirmed by the business. After that, contact support or the business for cancellation requests.'),
    },
    {
      key: 'deliveryCompletion',
      q: t('faq.client.deliveryCompletion.q', 'How is my delivery completed?'),
      a: t('faq.client.deliveryCompletion.a', 'You can add delivery instructions (e.g. building name, landmark, floor) when placing your order or in your address, so the agent can find you easily. The agent can also call you if needed. When the agent arrives, they will ask you for a PIN. You receive this PIN in your order details or via the app—share it with the agent so they can complete the delivery. Once they enter the PIN, the delivery is marked complete and payments are released to the business and the agent.'),
    },
  ];

  const agentFaqs: FaqItem[] = [
    {
      key: 'hold',
      q: t('faq.agent.hold.q', 'How much is held from my earnings?'),
      a: t('faq.agent.hold.a', 'A percentage of your earnings is held as a guarantee: unverified agents 100%, verified agents 80%, internal agents 0%. Verify your account and add a profile picture to reduce your hold amount.'),
    },
    {
      key: 'verifiedLessHold',
      q: t('faq.agent.verifiedLessHold.q', 'Why do verified agents have less hold?'),
      a: t('faq.agent.verifiedLessHold.a', 'Verified agents have a lower hold (80%) because they have completed identity verification. Unverified agents have 100% held; internal (Rendasua) agents 0%. The hold is released when the order is delivered successfully.'),
    },
    {
      key: 'claimOrder',
      q: t('faq.agent.claimOrder.q', 'How do I claim an order for delivery?'),
      a: t('faq.agent.claimOrder.a', 'Open the available orders list and choose an order to claim. To secure the order, you will receive a payment request on your phone for the hold amount—approve it to claim. Once the order is delivered, the hold is released and you receive your delivery fee.'),
    },
    {
      key: 'whenReleased',
      q: t('faq.agent.whenReleased.q', 'When is my hold amount released?'),
      a: t('faq.agent.whenReleased.a', 'Your hold amount is released when the order is marked as delivered. The delivery fee is then credited to your account. If a delivery fails, resolution (e.g. agent fault, client fault) determines how funds are handled.'),
    },
    {
      key: 'completeDelivery',
      q: t('faq.agent.completeDelivery.q', 'How do I complete a delivery?'),
      a: t('faq.agent.completeDelivery.a', 'Use the delivery address and any instructions the client added (e.g. building, landmark) to find them. You can also call the client if you need directions. When you reach the client, ask them for their delivery PIN—they get it from their order details or the app. Enter the PIN in the app to mark the delivery as complete. Once you confirm with the PIN, the order is closed and payments are transferred to the business and to you (your hold is released and your delivery fee is credited).'),
    },
  ];

  const businessFaqs: FaqItem[] = [
    {
      key: 'verification',
      q: t('faq.business.verification.q', 'How long does business verification take?'),
      a: t('faq.business.verification.a', 'Business verification typically takes 2–3 business days after all required documents are submitted. You can check your verification status in your business dashboard.'),
    },
    {
      key: 'settlementRelease',
      q: t('faq.business.settlementRelease.q', 'When are my settlements released?'),
      a: t('faq.business.settlementRelease.a', 'Settlements are released within 24–48 hours after order completion, depending on payment processing. You can view payouts and account balance in your business accounts section.'),
    },
    {
      key: 'failedDeliveries',
      q: t('faq.business.failedDeliveries.q', 'How are failed deliveries managed?'),
      a: t('faq.business.failedDeliveries.a', 'When a delivery fails, the agent marks it with a failure reason. In your dashboard, go to Failed Deliveries to resolve it. Options: Agent Fault (client refunded; agent hold released to the agent); Item Fault (client and agent refunded, optional inventory restore); Client Fault (both refunded, client charged a failed delivery fee split 50/50 between agent and business).'),
    },
    {
      key: 'addProducts',
      q: t('faq.business.addProducts.q', 'How do I add products to sell?'),
      a: t('faq.business.addProducts.a', 'From your business dashboard, go to Items. You can create new items with name, price, category, images, and tags, then add them to your locations with stock and selling price. You can also bulk-upload via CSV.'),
    },
  ];

  const sections = [
    { titleKey: 'faq.sections.client', titleDefault: 'For Clients', items: clientFaqs },
    { titleKey: 'faq.sections.deliveryAgent', titleDefault: 'For Delivery Agents', items: agentFaqs },
    { titleKey: 'faq.sections.business', titleDefault: 'For Businesses', items: businessFaqs },
  ];

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('faq.title', 'Frequently Asked Questions')}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          {t('faq.subtitle', 'Find answers to common questions')}
        </Typography>
      </Box>

      {sections.map((section, sectionIndex) => (
        <Box key={section.titleKey} sx={{ mb: 4 }}>
          <Typography
            variant="h6"
            component="h2"
            fontWeight={700}
            sx={{ mb: 2 }}
          >
            {t(section.titleKey, section.titleDefault)}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {section.items.map((item) => (
            <Accordion key={`${section.titleKey}-${item.key}`} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {item.q}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body1" color="text.secondary">
                  {item.a}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ))}
    </Container>
  );
};

export default FAQ;
