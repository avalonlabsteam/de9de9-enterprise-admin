import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useIsAuthenticated } from '@/stores/authStore';

/**
 * Auth boundary for the admin routes. An unauthenticated visitor is sent to
 * /login with the page they wanted stored in location state, so the login
 * screen can drop them back where they were heading.
 */
export function RequireAuth() {
  const isAuthenticated = useIsAuthenticated();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
