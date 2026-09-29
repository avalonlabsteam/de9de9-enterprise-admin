import type { RouteObject } from 'react-router-dom';

// Route-level code splitting: each page loads its own chunk on first visit.
export const kycRoutes: RouteObject[] = [
  {
    path: 'kyc',
    lazy: async () => ({ Component: (await import('./components/KycQueuePage')).KycQueuePage }),
  },
  {
    path: 'kyc/:companyId',
    lazy: async () => ({ Component: (await import('./components/KycReviewPage')).KycReviewPage }),
  },
];
