import ArchitectureCanvas from '../../components/architecture/ArchitectureCanvas';

export const metadata = {
  title: 'SCADA Topology | CoalGuard',
  description:
    'Industrial SCADA & Telemetry Topology Canvas. Interactive fieldbus signal routing, Mamdani FIS integration, and line fault simulation.',
};

export default function ArchitecturePage() {
  return <ArchitectureCanvas />;
}
