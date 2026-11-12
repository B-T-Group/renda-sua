import { describe, expect, it, vi } from 'vitest';
import { leaveMyRentals } from './leaveMyRentals';

describe('leaveMyRentals', () => {
  it('pops so Rentals keeps its search state', () => {
    const goBack = vi.fn();
    const navigate = vi.fn();
    leaveMyRentals({ canGoBack: () => true, goBack, navigate });
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens Rentals when there is nothing to pop', () => {
    const goBack = vi.fn();
    const navigate = vi.fn();
    leaveMyRentals({ canGoBack: () => false, goBack, navigate });
    expect(goBack).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('ClientMainTabs', {
      screen: 'ClientBrowse',
      params: { segment: 'rentals' },
    });
  });
});
