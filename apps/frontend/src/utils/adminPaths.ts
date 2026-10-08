/** Landing page for admin tools (the admin module hub). */
export const ADMIN_HOME_PATH = '/business/dashboard/admin';

/**
 * #338 decision 4: admin pages use the admin sign-in path (Auth0 Universal Login).
 * Matches `/admin`, `/admin/`, and every `/admin/*` path (not `/administrator`),
 * plus the admin hub under `/business/dashboard/admin`.
 */
export function isAdminPath(pathname: string): boolean {
  return (
    /^\/admin(\/|$)/.test(pathname) ||
    pathname.startsWith(ADMIN_HOME_PATH)
  );
}
