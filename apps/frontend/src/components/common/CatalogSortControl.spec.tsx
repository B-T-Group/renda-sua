import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { CatalogSortControl } from './CatalogSortControl';

// Initialize i18n for tests
i18n.init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'catalog.sortBy': 'Sort by',
        'catalog.sort': 'Sort: {{mode}}',
        'catalog.sortModes.recommended': 'Recommended',
        'catalog.sortModes.relevance': 'Best match',
        'catalog.sortModes.popular': 'Popular',
        'catalog.sortModes.rating': 'Top rated',
        'catalog.sortModes.newest': 'Newest',
      },
    },
  },
});

const renderWithI18n = (component: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
};

describe('CatalogSortControl', () => {
  const defaultProps = {
    currentSort: 'relevance' as const,
    defaultSort: 'relevance' as const,
    isSearchMode: true,
    controlState: 'enabled' as const,
    onSortChange: jest.fn(),
  };

  it('renders nothing when control state is hidden', () => {
    const { container } = renderWithI18n(
      <CatalogSortControl {...defaultProps} controlState="hidden" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders sort button when control state is enabled', () => {
    renderWithI18n(<CatalogSortControl {...defaultProps} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows chip when current sort differs from default', () => {
    renderWithI18n(<CatalogSortControl {...defaultProps} currentSort="popular" />);
    expect(screen.getByText('Popular')).toBeInTheDocument();
  });

  it('does not show chip when current sort equals default', () => {
    renderWithI18n(<CatalogSortControl {...defaultProps} />);
    expect(screen.queryByText('Best match')).not.toBeInTheDocument();
  });

  it('opens menu when button is clicked', () => {
    renderWithI18n(<CatalogSortControl {...defaultProps} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText('Sort by')).toBeInTheDocument();
  });

  it('shows search options when in search mode', () => {
    renderWithI18n(<CatalogSortControl {...defaultProps} isSearchMode={true} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText('Best match')).toBeInTheDocument();
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
  });

  it('shows browse options when not in search mode', () => {
    renderWithI18n(
      <CatalogSortControl
        {...defaultProps}
        isSearchMode={false}
        currentSort="recommended"
        defaultSort="recommended"
      />
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.queryByText('Best match')).not.toBeInTheDocument();
  });

  it('calls onSortChange when a sort option is selected', () => {
    const onSortChange = jest.fn();
    renderWithI18n(<CatalogSortControl {...defaultProps} onSortChange={onSortChange} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    const popularOption = screen.getByText('Popular');
    fireEvent.click(popularOption);
    expect(onSortChange).toHaveBeenCalledWith('popular');
  });

  it('disables button when control state is disabled', () => {
    renderWithI18n(<CatalogSortControl {...defaultProps} controlState="disabled" />);
    const button = screen.getByRole('button');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
