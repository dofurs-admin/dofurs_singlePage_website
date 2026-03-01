'use client';

import { ToastProvider } from './ToastProvider';
import InactivitySessionManager from './InactivitySessionManager';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <InactivitySessionManager />
      {children}
    </ToastProvider>
  );
}
