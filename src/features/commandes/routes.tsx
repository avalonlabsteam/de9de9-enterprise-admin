import type { RouteObject } from 'react-router-dom';

// Route-level code splitting: each page loads its own chunk on first visit.
export const commandesRoutes: RouteObject[] = [
  {
    path: 'commandes',
    lazy: async () => ({ Component: (await import('./components/WorklistPage')).WorklistPage }),
  },
  {
    path: 'commandes/:id',
    lazy: async () => ({ Component: (await import('./components/console/ConsolePage')).ConsolePage }),
  },
];
