import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ToastProvider } from '../components/common/Toast';
import { RosterCycleProvider } from '../context/RosterCycleContext';

export function App() {
  return (
    <ToastProvider>
      <RosterCycleProvider>
        <RouterProvider router={router} />
      </RosterCycleProvider>
    </ToastProvider>
  );
}

export default App;
