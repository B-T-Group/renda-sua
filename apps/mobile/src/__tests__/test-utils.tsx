import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { PaperProvider } from 'react-native-paper';
import i18n from '@/i18n';
import { paperTheme } from '@/theme/paperTheme';

type AllProvidersProps = {
  children: React.ReactNode;
};

function AllProviders({ children }: AllProvidersProps) {
  return (
    <PaperProvider theme={paperTheme}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </PaperProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}
