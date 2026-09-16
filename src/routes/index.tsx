import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { authRoutes } from '@/features/auth/routes';
import { commandesRoutes } from '@/features/commandes/routes';
import { prestatairesRoutes } from '@/features/prestataires/routes';
import { soustraitanceRoutes } from '@/features/soustraitance/routes';
import { handicapRoutes } from '@/features/handicap/routes';
import { facturesRoutes } from '@/features/factures/routes';
import { creditsRoutes } from '@/features/credits/routes';
import { analyticsRoutes } from '@/features/analytics/routes';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // ---- public ----
      ...authRoutes,

      // ---- authenticated ----
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to="/commandes" replace /> },
              ...commandesRoutes,
              ...prestatairesRoutes,
              ...soustraitanceRoutes,
              ...handicapRoutes,
              ...facturesRoutes,
              ...creditsRoutes,
              ...analyticsRoutes,
              { path: '*', element: <Navigate to="/commandes" replace /> },
            ],
          },
        ],
      },
    ],
  },
]);
