import type { RouteObject } from 'react-router-dom';

// Route-level code splitting: each page loads its own chunk on first visit.
export const comptabiliteRoutes: RouteObject[] = [
  {
    path: 'comptabilite',
    lazy: async () => ({ Component: (await import('./components/ComptabilitePage')).ComptabilitePage }),
  },
];
