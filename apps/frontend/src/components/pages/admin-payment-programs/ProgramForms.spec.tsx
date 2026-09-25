import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { AdvanceForm, AssignmentForm, CreditForm, ScheduleForm } from './ProgramForms';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string, options?: Record<string, string>) => {
      const template = fallback || key;
      return template.replace(/\{\{(\w+)\}\}/g, (_match, name) => options?.[name] ?? '');
    },
  }),
}));

jest.mock('../../../hooks/useApiClient', () => {
  const client = { post: jest.fn(), get: jest.fn() };
  return { useApiClient: () => client };
});

describe('payment program forms', () => {
  it('states the schedule without asking for an agent', () => {
    render(<ScheduleForm onDone={jest.fn()} />);
    expect(screen.getByText(/every week/)).toBeTruthy();
    expect(screen.queryByText('Open facility')).toBeNull();
    expect(screen.queryByPlaceholderText('Name, email, or referral code')).toBeNull();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '' } });
    expect(screen.getByText(/Enter an amount/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Create schedule' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('includes objectives in the schedule summary', () => {
    render(<ScheduleForm onDone={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Agent recruitments'), { target: { value: '5' } });
    expect(screen.getByText('Objectives')).toBeTruthy();
    expect(screen.getByText('5 agent recruitments')).toBeTruthy();
  });

  it('states the cash-advance limit without opening a facility', () => {
    render(<AdvanceForm onDone={jest.fn()} />);
    expect(screen.getByText(/Deposits repay that debt first/)).toBeTruthy();
    expect(screen.queryByText('Open facility')).toBeNull();
  });

  it('states that store credit cannot be withdrawn', () => {
    render(<CreditForm partners={[]} onDone={jest.fn()} />);
    expect(screen.getByText(/cannot be withdrawn/)).toBeTruthy();
    expect(screen.getByText(/This client/)).toBeTruthy();
  });

  it('names the agent only after a template is chosen', () => {
    render(
      <AssignmentForm
        schedules={[{
          id: 'sch-1',
          name: 'Daily stipend',
          is_active: true,
          frequency: 'daily',
          currency: 'XAF',
          default_amount: 10000,
        }]}
        programs={[]}
        onDone={jest.fn()}
      />
    );
    expect(screen.getByText(/Choose a template/)).toBeTruthy();
    expect(screen.queryByText('Create schedule')).toBeNull();
  });
});
