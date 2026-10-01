import type { RouteObject } from 'react-router-dom';

// Route-level code splitting: each page loads its own chunk on first visit.
export const accesRoutes: RouteObject[] = [
  {
    path: 'acces',
    lazy: async () => ({ Component: (await import('./components/AccesPage')).AccesPage }),
  },
];
