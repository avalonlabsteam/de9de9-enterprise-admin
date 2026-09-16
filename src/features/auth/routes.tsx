import type { RouteObject } from 'react-router-dom';

// Route-level code splitting: the login screen loads its own chunk.
export const authRoutes: RouteObject[] = [
  {
    path: 'login',
    lazy: async () => ({ Component: (await import('./components/LoginPage')).LoginPage }),
  },
];
