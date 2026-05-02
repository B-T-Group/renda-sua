import type { Meta, StoryObj } from '@storybook/react';

import LoadingPage from './LoadingPage';

const meta: Meta<typeof LoadingPage> = {
  title: 'Common/LoadingPage',
  component: LoadingPage,
};

export default meta;

type Story = StoryObj<typeof LoadingPage>;

export const Default: Story = {
  args: {
    message: 'Loading',
    subtitle: 'Please wait',
    showProgress: true,
  },
};
