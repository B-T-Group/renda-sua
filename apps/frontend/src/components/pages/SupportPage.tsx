import { useAuth0 } from '@auth0/auth0-react';
import {
  Chat,
  ContactSupport,
  Email,
  Emergency,
  Feedback,
  Help,
  LiveHelp,
  LocalShipping,
  MenuBook,
  Phone,
  QuestionAnswer,
  Security,
  ShoppingCart,
  Support as SupportIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import SEOHead from '../seo/SEOHead';

const SupportPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  const { userType } = useUserProfileContext();
  const [expandedPanel, setExpandedPanel] = useState<string | false>(false);
  const [feedbackForm, setFeedbackForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    category: 'general',
  });

  const handlePanelChange =
    (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedPanel(isExpanded ? panel : false);
    };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle feedback submission
    console.log('Feedback submitted:', feedbackForm);
    // Reset form
    setFeedbackForm({
      name: '',
      email: '',
      subject: '',
      message: '',
      category: 'general',
    });
  };

  // Contact methods
  const contactMethods = [
    {
      icon: <Phone color="primary" />,
      title: t('support.contact.phone.title', 'Phone Support'),
      description: t(
        'support.contact.phone.description',
        'Talk to our support team'
      ),
      details: '+1 (555) 123-4567',
      hours: t('support.contact.phone.hours', 'Mon-Fri: 8AM-8PM EST'),
      action: () => window.open('tel:+15551234567'),
    },
    {
      icon: <Email color="primary" />,
      title: t('support.contact.email.title', 'Email Support'),
      description: t('support.contact.email.description', 'Get help via email'),
      details: 'support@rendasua.com',
      hours: t('support.contact.email.hours', '24/7 Response within 2 hours'),
      action: () => window.open('mailto:support@rendasua.com'),
    },
    {
      icon: <Chat color="success" />,
      title: t('support.contact.whatsapp.title', 'WhatsApp Support'),
      description: t(
        'support.contact.whatsapp.description',
        'Chat with us on WhatsApp'
      ),
      details: '+1 (555) 123-4567',
      hours: t('support.contact.whatsapp.hours', 'Mon-Fri: 8AM-10PM EST'),
      action: () => window.open('https://wa.me/15551234567'),
    },
    {
      icon: <LiveHelp color="info" />,
      title: t('support.contact.livechat.title', 'Live Chat'),
      description: t(
        'support.contact.livechat.description',
        'Instant help via live chat'
      ),
      details: t('support.contact.livechat.details', 'Available on website'),
      hours: t(
        'support.contact.livechat.hours',
        '24/7 Automated + Live agents'
      ),
      action: () => {
        // Open live chat widget
        console.log('Opening live chat...');
      },
    },
  ];

  // FAQ items organized by category
  const faqCategories = [
    {
      title: t('support.faq.ordering.title', 'Ordering & Payments'),
      icon: <ShoppingCart />,
      items: [
        {
          question: t(
            'support.faq.ordering.howToOrder',
            'How do I place an order?'
          ),
          answer: t(
            'support.faq.ordering.howToOrderAnswer',
            "To place an order, browse our items, select what you want, add to cart, and proceed to checkout. You'll need to create an account and add payment method."
          ),
        },
        {
          question: t(
            'support.faq.ordering.paymentMethods',
            'What payment methods do you accept?'
          ),
          answer: t(
            'support.faq.ordering.paymentMethodsAnswer',
            'We accept Airtel Money, MTN Mobile Money, and will soon support credit cards. All payments are secure and encrypted.'
          ),
        },
        {
          question: t(
            'support.faq.ordering.cancelOrder',
            'Can I cancel my order?'
          ),
          answer: t(
            'support.faq.ordering.cancelOrderAnswer',
            "Orders can be cancelled within 30 minutes of placement if they haven't been confirmed by the business. Contact support for assistance."
          ),
        },
      ],
    },
    {
      title: t('support.faq.delivery.title', 'Delivery & Tracking'),
      icon: <LocalShipping />,
      items: [
        {
          question: t(
            'support.faq.delivery.trackOrder',
            'How do I track my order?'
          ),
          answer: t(
            'support.faq.delivery.trackOrderAnswer',
            'You can track your order in real-time through your dashboard or by clicking the tracking link sent to your email.'
          ),
        },
        {
          question: t(
            'support.faq.delivery.deliveryTime',
            'How long does delivery take?'
          ),
          answer: t(
            'support.faq.delivery.deliveryTimeAnswer',
            'Delivery times vary by location and item. Most orders are delivered within 2-4 hours for same-day delivery, or 24-48 hours for standard delivery.'
          ),
        },
        {
          question: t(
            'support.faq.delivery.deliveryFees',
            'How are delivery fees calculated?'
          ),
          answer: t(
            'support.faq.delivery.deliveryFeesAnswer',
            "Delivery fees are calculated based on distance, item weight, and delivery urgency. You'll see the exact fee before confirming your order."
          ),
        },
      ],
    },
    {
      title: t('support.faq.account.title', 'Account & Profile'),
      icon: <ContactSupport />,
      items: [
        {
          question: t(
            'support.faq.account.createAccount',
            'How do I create an account?'
          ),
          answer: t(
            'support.faq.account.createAccountAnswer',
            'Click "Sign Up" and choose your account type (Client, Agent, or Business). Follow the verification process to activate your account.'
          ),
        },
        {
          question: t(
            'support.faq.account.forgotPassword',
            'I forgot my password'
          ),
          answer: t(
            'support.faq.account.forgotPasswordAnswer',
            'Click "Forgot Password" on the login page and follow the instructions sent to your email to reset your password.'
          ),
        },
        {
          question: t(
            'support.faq.account.updateProfile',
            'How do I update my profile?'
          ),
          answer: t(
            'support.faq.account.updateProfileAnswer',
            'Go to your profile page and click "Edit" to update your information. Some changes may require verification.'
          ),
        },
      ],
    },
  ];

  // Self-help resources
  const selfHelpResources = [
    {
      icon: <MenuBook color="primary" />,
      title: t('support.selfhelp.userguide.title', 'User Guide'),
      description: t(
        'support.selfhelp.userguide.description',
        'Complete guide to using Rendasua'
      ),
      action: () => navigate('/user-guide'),
    },
    {
      icon: <Help color="info" />,
      title: t('support.selfhelp.tutorials.title', 'Video Tutorials'),
      description: t(
        'support.selfhelp.tutorials.description',
        'Step-by-step video tutorials'
      ),
      action: () => window.open('https://youtube.com/rendasua'),
    },
    {
      icon: <QuestionAnswer color="success" />,
      title: t('support.selfhelp.community.title', 'Community Forum'),
      description: t(
        'support.selfhelp.community.description',
        'Ask questions and get help from the community'
      ),
      action: () => window.open('https://community.rendasua.com'),
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <SEOHead
        title={t('support.seo.title', 'Support & Help Center - Rendasua')}
        description={t(
          'support.seo.description',
          'Get help with orders, deliveries, payments, and account issues. Contact our support team 24/7.'
        )}
        keywords={t(
          'support.seo.keywords',
          'support, help, customer service, contact, FAQ, delivery help'
        )}
      />

      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <SupportIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h3" component="h1" gutterBottom>
          {t('support.title', 'Support & Help Center')}
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          {t(
            'support.subtitle',
            "We're here to help you every step of the way"
          )}
        </Typography>
      </Box>

      {/* Quick Actions for Authenticated Users */}
      {isAuthenticated && (
        <Alert
          severity="info"
          sx={{ mb: 4 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate('/dashboard')}
            >
              {t('support.quickactions.dashboard', 'Go to Dashboard')}
            </Button>
          }
        >
          {t(
            'support.quickactions.message',
            'Need help with a specific order? Check your dashboard for order status and tracking.'
          )}
        </Alert>
      )}

      <Grid container spacing={4}>
        {/* Contact Support Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 4, mb: 4 }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <ContactSupport color="primary" />
              {t('support.contact.title', 'Contact Support')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {t(
                'support.contact.description',
                'Choose the best way to reach us based on your needs'
              )}
            </Typography>

            <Grid container spacing={3}>
              {contactMethods.map((method, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <Card
                    sx={{
                      height: '100%',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                      },
                    }}
                    onClick={method.action}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 3 }}>
                      <Box sx={{ mb: 2 }}>{method.icon}</Box>
                      <Typography variant="h6" gutterBottom>
                        {method.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {method.description}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        sx={{ mb: 1 }}
                      >
                        {method.details}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {method.hours}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Emergency Support */}
        <Grid item xs={12}>
          <Alert
            severity="error"
            icon={<Emergency />}
            sx={{ mb: 4 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => window.open('tel:+15551234567')}
              >
                {t('support.emergency.call', 'Call Now')}
              </Button>
            }
          >
            <Typography variant="h6" gutterBottom>
              {t('support.emergency.title', 'Emergency Support')}
            </Typography>
            {t(
              'support.emergency.message',
              'For urgent delivery issues, safety concerns, or emergencies, call our 24/7 emergency line: +1 (555) 123-4567'
            )}
          </Alert>
        </Grid>

        {/* FAQ Section */}
        <Grid item xs={12} md={8}>
          <Typography
            variant="h4"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <QuestionAnswer color="primary" />
            {t('support.faq.title', 'Frequently Asked Questions')}
          </Typography>

          {faqCategories.map((category, categoryIndex) => (
            <Box key={categoryIndex} sx={{ mb: 3 }}>
              <Typography
                variant="h5"
                gutterBottom
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 2,
                  color: 'primary.main',
                }}
              >
                {category.icon}
                {category.title}
              </Typography>

              {category.items.map((faq, faqIndex) => (
                <Accordion
                  key={`${categoryIndex}-${faqIndex}`}
                  expanded={
                    expandedPanel === `panel${categoryIndex}-${faqIndex}`
                  }
                  onChange={handlePanelChange(
                    `panel${categoryIndex}-${faqIndex}`
                  )}
                  sx={{ mb: 1 }}
                >
                  <AccordionSummary>
                    <Typography variant="subtitle1" fontWeight={500}>
                      {faq.question}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" color="text.secondary">
                      {faq.answer}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          ))}
        </Grid>

        {/* Self-Help Resources */}
        <Grid item xs={12} md={4}>
          <Typography
            variant="h5"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Help color="primary" />
            {t('support.selfhelp.title', 'Self-Help Resources')}
          </Typography>

          <Stack spacing={2} sx={{ mb: 4 }}>
            {selfHelpResources.map((resource, index) => (
              <Card
                key={index}
                sx={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 2,
                  },
                }}
                onClick={resource.action}
              >
                <CardContent
                  sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
                >
                  {resource.icon}
                  <Box>
                    <Typography variant="subtitle1" fontWeight={500}>
                      {resource.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {resource.description}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>

          {/* Safety & Security */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Security color="primary" />
              {t('support.safety.title', 'Safety & Security')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t(
                'support.safety.description',
                'Your safety is our priority. Learn about our safety measures and report any concerns.'
              )}
            </Typography>
            <Stack spacing={1}>
              <Link
                href="/safety-guidelines"
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                {t('support.safety.guidelines', 'Safety Guidelines')}
              </Link>
              <Link
                href="/privacy-policy"
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                {t('support.safety.privacy', 'Privacy Policy')}
              </Link>
              <Link
                href="/terms-of-service"
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                {t('support.safety.terms', 'Terms of Service')}
              </Link>
            </Stack>
          </Paper>

          {/* Order-Specific Help */}
          {isAuthenticated && userType === 'client' && (
            <Paper sx={{ p: 3 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <LocalShipping color="primary" />
                {t('support.orderhelp.title', 'Order Help')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t(
                  'support.orderhelp.description',
                  'Need help with a specific order?'
                )}
              </Typography>
              <Stack spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  onClick={() => navigate('/orders')}
                >
                  {t('support.orderhelp.vieworders', 'View My Orders')}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  onClick={() => navigate('/dashboard')}
                >
                  {t('support.orderhelp.trackorder', 'Track Current Orders')}
                </Button>
              </Stack>
            </Paper>
          )}
        </Grid>

        {/* Feedback Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 4 }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Feedback color="primary" />
              {t('support.feedback.title', 'Send Feedback')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {t(
                'support.feedback.description',
                'Help us improve Rendasua by sharing your thoughts and suggestions'
              )}
            </Typography>

            <Box component="form" onSubmit={handleFeedbackSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('support.feedback.name', 'Name')}
                    value={feedbackForm.name}
                    onChange={(e) =>
                      setFeedbackForm({ ...feedbackForm, name: e.target.value })
                    }
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('support.feedback.email', 'Email')}
                    type="email"
                    value={feedbackForm.email}
                    onChange={(e) =>
                      setFeedbackForm({
                        ...feedbackForm,
                        email: e.target.value,
                      })
                    }
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={t('support.feedback.subject', 'Subject')}
                    value={feedbackForm.subject}
                    onChange={(e) =>
                      setFeedbackForm({
                        ...feedbackForm,
                        subject: e.target.value,
                      })
                    }
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={t('support.feedback.message', 'Message')}
                    multiline
                    rows={4}
                    value={feedbackForm.message}
                    onChange={(e) =>
                      setFeedbackForm({
                        ...feedbackForm,
                        message: e.target.value,
                      })
                    }
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    startIcon={<Feedback />}
                  >
                    {t('support.feedback.submit', 'Send Feedback')}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default SupportPage;
