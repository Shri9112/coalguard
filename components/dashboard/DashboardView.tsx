'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Brain, CheckSquare, ChevronRight, Database, Layers, Play } from 'lucide-react';
import { PROFILES } from '../../lib/data/profiles';
import { TEST_CASES } from '../../lib/data/test-cases';
import { EVIDENCE_CATALOG, PUBLISHED_COAL_CURVES } from '../../lib/data/evidence';
import { useSimulation } from '../../lib/state/SimulationContext';
import styles from './DashboardView.module.css';

export default function DashboardView() {
  const { snapshot, setProfile } = useSimulation();
  const activeProfile = PROFILES.find((profile) => profile.id === snapshot.config.profile) ?? PROFILES[0];
  const risk = snapshot.telemetry.risk;
  const evidenceCount = EVIDENCE_CATALOG.length + PUBLISHED_COAL_CURVES.length;

  return (
    <div className={styles.dashboard}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Project overview</span>
          <h2>CoalGuard</h2>
          <p>
            An explainable simulator that combines virtual sensor readings to assess early coal-fire risk.
          </p>
          <div className={styles.actions}>
            <Link href="/simulation" className={styles.primaryButton}>
              <Play size={16} /> Open simulation
            </Link>
            <Link href="/test-cases" className={styles.secondaryButton}>
              <CheckSquare size={16} /> View test cases
            </Link>
          </div>
        </div>

        <aside className={styles.riskCard} aria-label="Current simulated risk">
          <span className={styles.riskLabel}>Current simulation</span>
          <div className={styles.riskValue}>{risk.riskScore}<small>/100</small></div>
          <span className={`${styles.riskStage} ${styles[`risk${risk.stage}`]}`}>{risk.stage}</span>
          <p>{activeProfile.shortLabel} · {snapshot.running ? 'Running' : 'Paused'}</p>
        </aside>
      </section>

      <section className={styles.stats} aria-label="Project contents">
        <div className={styles.statCard}>
          <Layers size={19} />
          <strong>{PROFILES.length}</strong>
          <span>Operating profiles</span>
        </div>
        <div className={styles.statCard}>
          <CheckSquare size={19} />
          <strong>{TEST_CASES.length}</strong>
          <span>Configured test cases</span>
        </div>
        <div className={styles.statCard}>
          <Database size={19} />
          <strong>{evidenceCount}</strong>
          <span>Evidence records</span>
        </div>
      </section>

      <section className={styles.projectFacts} aria-labelledby="project-facts-heading">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>At a glance</span>
            <h3 id="project-facts-heading">What the project does</h3>
          </div>
        </div>
        <div className={styles.factGrid}>
          <article className={styles.factCard}>
            <span>Goal</span>
            <p>Combine uncertain sensor evidence to identify and explain developing coal-fire risk.</p>
          </article>
          <article className={styles.factCard}>
            <span>Method</span>
            <p>Mamdani Fuzzy Logic assesses risk; PSO tunes selected model parameters.</p>
          </article>
          <article className={styles.factCard}>
            <span>Scope</span>
            <p>Mine conveyor, factory transfer, stockpile, road and rail transit, and ship cargo hold.</p>
          </article>
        </div>
        <p className={styles.boundaryNote}>This demonstration uses simulated readings and does not control physical equipment.</p>
      </section>

      <section className={styles.profilesSection} aria-labelledby="profiles-heading">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Choose a context</span>
            <h3 id="profiles-heading">Operating environments</h3>
          </div>
          <Link href="/simulation" className={styles.textLink}>Open simulation <ChevronRight size={15} /></Link>
        </div>
        <div className={styles.profileGrid}>
          {PROFILES.map((profile) => {
            const selected = snapshot.config.profile === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                className={`${styles.profileCard} ${selected ? styles.profileSelected : ''}`}
                style={{ '--profile-accent': profile.accent } as CSSProperties}
                aria-pressed={selected}
                onClick={() => setProfile(profile.id)}
              >
                <span className={styles.profileTop}>
                  <span className={styles.profileDot} />
                  {selected ? 'Selected' : profile.shortLabel}
                </span>
                <strong>{profile.label}</strong>
                <span className={styles.profileDescription}>{profile.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <details className={styles.howItWorks}>
        <summary><Brain size={18} /> How a risk result is produced</summary>
        <div className={styles.steps}>
          <p><b>1. Readings</b><span>Virtual sensors provide temperature, gas, and equipment signals.</span></p>
          <p><b>2. Fuzzy rules</b><span>Mamdani rules combine signals that can be uncertain or incomplete.</span></p>
          <p><b>3. Result</b><span>The app shows a risk stage, likely cause, confidence, and suggested response.</span></p>
          <p><b>4. Calibration</b><span>PSO tuning is available in Test Cases for repeatable comparisons.</span></p>
        </div>
      </details>
    </div>
  );
}
