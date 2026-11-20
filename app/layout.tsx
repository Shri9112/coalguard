import type { Metadata } from 'next';
import './globals.css';
import { SimulationProvider } from '../lib/state/SimulationContext';
import AppShell from '../components/layout/AppShell';

export const metadata: Metadata = {
  title: 'CoalGuard - Explainable Coal Fire Risk Simulator',
  description:
    'Academic Soft Computing decision-support simulator combining multi-sensor evidence using Mamdani Fuzzy Inference and Particle Swarm Optimization.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SimulationProvider>
          <AppShell>{children}</AppShell>
        </SimulationProvider>
      </body>
    </html>
  );
}
