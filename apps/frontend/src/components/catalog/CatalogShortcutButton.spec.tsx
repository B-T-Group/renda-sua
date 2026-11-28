import { ThemeProvider, createTheme } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import { Assignment } from '@mui/icons-material';
import { CatalogShortcutButton } from './CatalogShortcutButton';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('CatalogShortcutButton', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('navigates to the given path', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <CatalogShortcutButton
          label="My orders"
          to="/orders"
          icon={<Assignment />}
          testId="catalog-my-orders"
        />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByTestId('catalog-my-orders'));
    expect(mockNavigate).toHaveBeenCalledWith('/orders');
  });
});
