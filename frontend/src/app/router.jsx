import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { EmployeesPage } from '../features/employees/pages/EmployeesPage';
import { PodsPage } from '../features/pods/pages/PodsPage';
import { BrandsPage } from '../features/brands/pages/BrandsPage';
import { ProcessesPage } from '../features/processes/pages/ProcessesPage';
import { AssignmentsPage } from '../features/assignments/pages/AssignmentsPage';
import { WorkingRulesPage } from '../features/working-rules/pages/WorkingRulesPage';
import { AvailabilityPage } from '../features/availability/pages/AvailabilityPage';
import { MonthlyRosterPage } from '../features/roster/pages/MonthlyRosterPage';
import { ConflictsPage } from '../features/conflicts/pages/ConflictsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'employees',
        element: <EmployeesPage />,
      },
      {
        path: 'pods',
        element: <PodsPage />,
      },
      {
        path: 'brands',
        element: <BrandsPage />,
      },
      {
        path: 'processes',
        element: <ProcessesPage />,
      },
      {
        path: 'assignments',
        element: <AssignmentsPage />,
      },
      {
        path: 'working-rules',
        element: <WorkingRulesPage />,
      },
      {
        path: 'availability',
        element: <AvailabilityPage />,
      },
      {
        path: 'roster',
        element: <MonthlyRosterPage />,
      },
      {
        path: 'conflicts',
        element: <ConflictsPage />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
