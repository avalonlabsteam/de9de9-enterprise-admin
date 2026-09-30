import type { RouteObject } from 'react-router-dom';

// Route-level code splitting: each page loads its own chunk on first visit.
export const contractuelsRoutes: RouteObject[] = [
  {
    path: 'contractuels/:demandeId',
    lazy: async () => ({
      Component: (await import('./components/ContractuelDemandePage')).ContractuelDemandePage,
    }),
  },
];
