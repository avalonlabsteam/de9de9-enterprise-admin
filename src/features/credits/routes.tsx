import type { RouteObject } from 'react-router-dom';

// Route-level code splitting: each page loads its own chunk on first visit.
export const creditsRoutes: RouteObject[] = [
  {
    path: 'credits',
    lazy: async () => ({ Component: (await import('./components/CreditsPage')).CreditsPage }),
  },
];
