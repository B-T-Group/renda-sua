import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { Button } from 'react-native-paper';
import { renderWithProviders } from '@/__tests__/test-utils';

describe('Paper Button (render)', () => {
  it('renders label and handles press', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Button mode="contained" onPress={onPress}>
        Continue
      </Button>,
    );
    expect(screen.getByText('Continue')).toBeTruthy();
    fireEvent.press(screen.getByText('Continue'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
