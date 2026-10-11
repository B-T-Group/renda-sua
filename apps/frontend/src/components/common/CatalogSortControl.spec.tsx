import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogSortControl } from './CatalogSortControl';

describe('CatalogSortControl', () => {
  const defaultProps = {
    currentSort: 'relevance' as const,
    defaultSort: 'relevance' as const,
    isSearchMode: true,
    controlState: 'enabled' as const,
    onSortChange: jest.fn(),
  };

  it('renders nothing when control state is hidden', () => {
    const { container } = render(
      <CatalogSortControl {...defaultProps} controlState="hidden" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders sort button when control state is enabled', () => {
    render(<CatalogSortControl {...defaultProps} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows chip when current sort differs from default', () => {
    render(<CatalogSortControl {...defaultProps} currentSort="popular" />);
    expect(screen.getByText('Popular')).toBeInTheDocument();
  });

  it('does not show chip when current sort equals default', () => {
    render(<CatalogSortControl {...defaultProps} />);
    expect(screen.queryByText('Best match')).not.toBeInTheDocument();
  });

  it('opens menu when button is clicked', () => {
    render(<CatalogSortControl {...defaultProps} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText('Sort by')).toBeInTheDocument();
  });

  it('shows search options when in search mode', () => {
    render(<CatalogSortControl {...defaultProps} isSearchMode={true} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText('Best match')).toBeInTheDocument();
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
  });

  it('shows browse options when not in search mode', () => {
    render(
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
    render(<CatalogSortControl {...defaultProps} onSortChange={onSortChange} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    const popularOption = screen.getByText('Popular');
    fireEvent.click(popularOption);
    expect(onSortChange).toHaveBeenCalledWith('popular');
  });

  it('disables button when control state is disabled', () => {
    render(<CatalogSortControl {...defaultProps} controlState="disabled" />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
