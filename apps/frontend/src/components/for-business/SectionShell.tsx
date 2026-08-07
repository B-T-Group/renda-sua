import { Box, Container, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';

interface SectionShellProps {
  id?: string;
  title: string;
  subtitle?: string;
  maxWidth?: 'sm' | 'md' | 'lg';
  bgcolor?: string;
  children: React.ReactNode;
  align?: 'center' | 'left';
}

const SectionShell: React.FC<SectionShellProps> = ({
  id,
  title,
  subtitle,
  maxWidth = 'lg',
  bgcolor,
  children,
  align = 'center',
}) => {
  const shouldReduce = useReducedMotion();

  return (
    <Box
      component="section"
      id={id}
      sx={{ py: { xs: 7, md: 12 }, bgcolor: bgcolor ?? 'background.default' }}
    >
      <Container maxWidth={maxWidth}>
        <Box sx={{ textAlign: align, mb: { xs: 4, md: 6 }, maxWidth: align === 'center' ? 640 : undefined, mx: align === 'center' ? 'auto' : undefined }}>
          <motion.div
            initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <Typography
              component="h2"
              sx={{
                fontSize: { xs: '1.75rem', md: '2.5rem' },
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
                mb: subtitle ? 1.5 : 0,
              }}
            >
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.65 }}>
                {subtitle}
              </Typography>
            ) : null}
          </motion.div>
        </Box>
        {children}
      </Container>
    </Box>
  );
};

export default SectionShell;
