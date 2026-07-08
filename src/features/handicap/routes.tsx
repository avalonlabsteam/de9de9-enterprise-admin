import type { RouteObject } from 'react-router-dom';

// Route-level code splitting: each page loads its own chunk on first visit.
export const handicapRoutes: RouteObject[] = [
  {
    path: 'handicap',
    lazy: async () => ({ Component: (await import('./components/HandicapPage')).HandicapPage }),
  },
];
