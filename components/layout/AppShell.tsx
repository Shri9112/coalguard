'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Brain,
  CheckSquare,
  ChevronRight,
  Clock,
  Database,
  Flame,
  Network,
  Play,
  Workflow,
} from 'lucide-react';
import { useSimulation } from '../../lib/state/SimulationContext';
import { getProfile } from '../../lib/data/profiles';
import styles from './AppShell.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: Activity },
  { href: '/architecture', label: 'Architecture', icon: Workflow },
  { href: '/simulation', label: 'Simulation', icon: Play },
  { href: '/sensor-network', label: 'Sensors', icon: Network },
  { href: '/explain-risk', label: 'Explain Risk', icon: Brain },
  { href: '/test-cases', label: 'Test Cases', icon: CheckSquare },
  { href: '/evidence', label: 'Evidence', icon: Database },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { snapshot } = useSimulation();

  const profile = getProfile(snapshot.config.profile);
  const stage = snapshot.telemetry.risk.stage;
  const stageClass =
    stage === 'Critical'
      ? styles.stageCritical
      : stage === 'Warning'
      ? styles.stageWarning
      : stage === 'Watch'
      ? styles.stageWatch
      : styles.stageNormal;

  const isNavActive = (item: NavItem) =>
    item.href === '/'
      ? pathname === '/'
      : item.href === '/test-cases'
      ? pathname.startsWith('/test-cases') || pathname.startsWith('/verification')
      : pathname.startsWith(item.href);
  const currentNav = NAV_ITEMS.find(isNavActive);

  return (
    <div className={styles.shell}>
      {/* Left Navigation Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <Flame size={20} />
          </div>
          <div>
            <div className={styles.brandTitle}>COALGUARD</div>
            <div className={styles.brandSubtitle}>Soft Computing Lab</div>
          </div>
        </div>

        <div className={styles.navSection}>
          <nav className={styles.nav} aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${active ? styles.navActive : ''}`}
                >
                  <span className={styles.navIcon}>
                    <Icon size={17} />
                  </span>
                  <span className={styles.navCopy}>{item.label}</span>
                  {active && <ChevronRight size={14} className={styles.navChevron} />}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className={styles.sidebarSpacer} />

        {/* Active Context Card */}
        <div className={styles.activeProfileBox}>
          <div className={styles.profileBoxTop}>
            <span className={styles.statusDot} style={{ background: profile.accent }} />
            <span>Active Context</span>
          </div>
          <div className={styles.profileName}>{profile.shortLabel}</div>
          <div className={styles.profileDetail}>{profile.facilityTitle}</div>
          {snapshot.config.profile === 'transit' && snapshot.config.submode !== 'none' && (
            <div className={styles.submodeBadge}>
              Submode: {snapshot.config.submode === 'truck' ? 'Road Tipper Truck' : 'Rail Hopper Wagon'}
            </div>
          )}
        </div>

      </aside>

      {/* Main Workspace Column */}
      <div className={styles.mainColumn}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <h1 className={styles.pageTitle}>{currentNav?.label ?? 'CoalGuard'}</h1>
          </div>

          <div className={styles.topbarRight}>
            <span className={styles.simClockPill}>
              <Clock size={13} />
              <span>Tick #{snapshot.tick} ({snapshot.telemetry.minutes}m)</span>
            </span>

            <span className={`${styles.statusPill} ${stageClass}`}>
              <span className={styles.statusDotPulse} />
              <span>{snapshot.running ? `Running: ${stage} (${snapshot.telemetry.risk.riskScore}/100)` : `Paused: ${stage}`}</span>
            </span>

          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
