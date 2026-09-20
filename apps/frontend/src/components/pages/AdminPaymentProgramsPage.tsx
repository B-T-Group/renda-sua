import { Box, Stack } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
import { ProgramHub } from './admin-payment-programs/ProgramHub';
import { ProgramNav } from './admin-payment-programs/ProgramNav';
import {
  AdvanceSection,
  AssignmentSection,
  CampaignSection,
  CreditSection,
  PartnerSection,
  ScheduleSection,
} from './admin-payment-programs/ProgramSections';

const SECTIONS = [
  'schedules',
  'advances',
  'credits',
  'assignments',
  'partners',
  'campaigns',
] as const;

export default function AdminPaymentProgramsPage() {
  const section = useSection();
  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <ProgramNav section={section} />
      <Box sx={{ width: '100%', minWidth: 0 }}>
        {section === 'hub' && <ProgramHub />}
        {section === 'schedules' && <ScheduleSection />}
        {section === 'advances' && <AdvanceSection />}
        {section === 'credits' && <CreditSection />}
        {section === 'assignments' && <AssignmentSection />}
        {section === 'partners' && <PartnerSection />}
        {section === 'campaigns' && <CampaignSection />}
      </Box>
    </Stack>
  );
}

function useSection(): (typeof SECTIONS)[number] | 'hub' {
  const params = useParams();
  const value = params.section;
  return SECTIONS.includes(value as (typeof SECTIONS)[number])
    ? (value as (typeof SECTIONS)[number])
    : 'hub';
}
