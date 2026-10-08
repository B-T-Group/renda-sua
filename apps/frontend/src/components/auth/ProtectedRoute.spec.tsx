import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';
import { MemoryRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ADMIN_HOME_PATH, isAdminPath } from '../../utils/adminPaths';
import ProtectedRoute from './ProtectedRoute';

const mockLoginWithRedirect = jest.fn();
let mockSession = {
  isAuthenticated: false,
  isSessionReady: true,
  isLoading: false,
  user: null as null | { email?: string; email_verified?: boolean },
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, fallback?: string) => fallback ?? _k }),
}));
jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ loginWithRedirect: mockLoginWithRedirect }),
}));
jest.mock('../../contexts/SessionAuthContext', () => ({
  useSessionAuth: () => mockSession,
}));
jest.mock('../common/LoadingPage', () => () => <div>loading</div>);
jest.mock('../pages/EmailVerificationPage', () => () => <div>verify email</div>);

function CurrentPath() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

/**
 * Same shape as the admin group in app.tsx: ProtectedRoute wraps the admin layout,
 * `/admin` and `/admin/*` redirect to the hub, and the public catch-all is outside.
 */
function renderAdminRoutes(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <ProtectedRoute>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route path={ADMIN_HOME_PATH} element={<div>admin hub</div>} />
          <Route path="/admin/orders" element={<div>admin orders</div>} />
          <Route path="/admin" element={<Navigate to={ADMIN_HOME_PATH} replace />} />
          <Route path="/admin/*" element={<Navigate to={ADMIN_HOME_PATH} replace />} />
        </Route>
        <Route path="*" element={<div>public home</div>} />
      </Routes>
      <CurrentPath />
    </MemoryRouter>
  );
}

describe('isAdminPath', () => {
  it.each(['/admin', '/admin/', '/admin/orders', '/admin/unknown/deep', ADMIN_HOME_PATH])(
    'treats %s as an admin path',
    (p) => expect(isAdminPath(p)).toBe(true)
  );
  it.each(['/', '/administrator', '/items/admin', '/dashboard'])(
    'does not treat %s as an admin path',
    (p) => expect(isAdminPath(p)).toBe(false)
  );
});

describe('ProtectedRoute admin sign-in', () => {
  beforeEach(() => {
    mockLoginWithRedirect.mockReset();
    mockSession = { isAuthenticated: false, isSessionReady: true, isLoading: false, user: null };
  });

  it.each(['/admin', '/admin/', '/admin/orders', '/admin/does-not-exist'])(
    'signed out on %s shows admin sign-in and returns to that path',
    (path) => {
      renderAdminRoutes(path);
      expect(screen.queryByText('public home')).toBeNull();
      expect(screen.getByText('Sign in required')).toBeTruthy();
      // Not redirected away before sign-in, so returnTo is the original URL.
      expect(screen.getByTestId('path').textContent).toBe(path);
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(mockLoginWithRedirect).toHaveBeenCalledWith({
        appState: { returnTo: path },
      });
    }
  );

  it('keeps the query string in returnTo', () => {
    renderAdminRoutes('/admin/orders?status=late');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(mockLoginWithRedirect).toHaveBeenCalledWith({
      appState: { returnTo: '/admin/orders?status=late' },
    });
  });

  it.each(['/admin', '/admin/', '/admin/does-not-exist'])(
    'signed in on %s lands on the admin hub',
    (path) => {
      mockSession = { ...mockSession, isAuthenticated: true, user: { email: 'a@b.c', email_verified: true } };
      renderAdminRoutes(path);
      expect(screen.getByText('admin hub')).toBeTruthy();
      expect(screen.getByTestId('path').textContent).toBe(ADMIN_HOME_PATH);
    }
  );

  it('signed in on a real admin page renders it', () => {
    mockSession = { ...mockSession, isAuthenticated: true, user: { email: 'a@b.c', email_verified: true } };
    renderAdminRoutes('/admin/orders');
    expect(screen.getByText('admin orders')).toBeTruthy();
  });
});

describe('app.tsx admin routes', () => {
  // app.spec cannot render <App/> in jsdom (lottie canvas), so guard the route table itself.
  it('declares /admin and /admin/* inside the ProtectedRoute admin layout group', () => {
    const src = readFileSync(join(__dirname, '../../app/app.tsx'), 'utf8');
    const start = src.indexOf('<LazyPages.AdminToolsLayout />');
    expect(start).toBeGreaterThan(-1);
    expect(src.lastIndexOf('<ProtectedRoute>', start)).toBeGreaterThan(-1);
    const groupEnd = src.indexOf('path="/accounts"', start);
    const group = src.slice(start, groupEnd);
    expect(group).toContain('path="/admin"\n');
    expect(group).toContain('path="/admin/*"');
    expect(group).toContain('<Navigate to={ADMIN_HOME_PATH} replace />');
  });
});
