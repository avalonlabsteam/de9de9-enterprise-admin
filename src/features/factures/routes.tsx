import type { RouteObject } from 'react-router-dom';

// Route-level code splitting: each page loads its own chunk on first visit.
export const facturesRoutes: RouteObject[] = [
  {
    path: 'factures',
    lazy: async () => ({ Component: (await import('./components/FacturesPage')).FacturesPage }),
  },
];
