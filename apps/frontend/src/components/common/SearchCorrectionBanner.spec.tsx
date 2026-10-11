import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { SearchCorrectionBanner } from './EmptySearchRecovery';

i18n.init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'search.showingResultsFor': 'Showing results for **{{corrected}}**',
        'search.searchInsteadFor': 'Search instead for "{{original}}"',
      },
    },
  },
});

describe('SearchCorrectionBanner (R1)', () => {
  it('renders the corrected query as text (no HTML injection) and offers the original', () => {
    const onSearchOriginal = jest.fn();
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <SearchCorrectionBanner
          corrected="<img src=x>"
          original="samsnug"
          onSearchOriginal={onSearchOriginal}
        />
      </I18nextProvider>
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Showing results for <img src=x>');
    fireEvent.click(screen.getByText('Search instead for "samsnug"'));
    expect(onSearchOriginal).toHaveBeenCalledTimes(1);
  });
});
