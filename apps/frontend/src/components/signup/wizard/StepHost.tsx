import { Fade } from '@mui/material';
import React from 'react';
import type { WizardStepDefinition } from './stepRegistry';

export interface StepHostProps {
  step: WizardStepDefinition;
}

export const StepHost: React.FC<StepHostProps> = ({ step }) => {
  const { Component } = step;
  return (
    <Fade in key={step.id} timeout={220}>
      <div>
        <Component />
      </div>
    </Fade>
  );
};
