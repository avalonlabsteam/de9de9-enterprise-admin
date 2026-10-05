import type { RouteObject } from 'react-router-dom';

// Route-level code splitting: each page loads its own chunk on first visit.
export const annoncesRoutes: RouteObject[] = [
  {
    path: 'annonces',
    lazy: async () => ({ Component: (await import('./components/AnnoncesQueuePage')).AnnoncesQueuePage }),
  },
  {
    path: 'annonces/:annonceId',
    lazy: async () => ({ Component: (await import('./components/AnnonceDetailPage')).AnnonceDetailPage }),
  },
];
