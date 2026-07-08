import type { RouteObject } from 'react-router-dom';

// Route-level code splitting: each page loads its own chunk on first visit.
export const prestatairesRoutes: RouteObject[] = [
  {
    path: 'prestataires',
    lazy: async () => ({ Component: (await import('./components/SearchPage')).SearchPage }),
  },
];
