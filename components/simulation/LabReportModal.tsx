'use client';

import React, { useState } from 'react';
import { Check, Copy, Download, FileText, Printer, X } from 'lucide-react';
import { generateLabReport, LabReportData } from '../../lib/engine/report-generator';
import { SimulationSnapshot } from '../../lib/types';
import { sound } from '../../lib/utils/sound';
import styles from './LabReportModal.module.css';

interface LabReportModalProps {
  snapshot: SimulationSnapshot;
  onClose: () => void;
}

export default function LabReportModal({ snapshot, onClose }: LabReportModalProps) {
  const [copied, setCopied] = useState(false);
  const report: LabReportData = generateLabReport(snapshot);

  const handleCopy = async () => {
    sound.playClick();
    try {
      await navigator.clipboard.writeText(report.markdownContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    sound.playClick();
    const blob = new Blob([report.markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${report.title}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    sound.playClick();
    window.print();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <FileText size={18} color="#38bdf8" />
            <span className={styles.modalTitle}>Academic Simulation & Risk Assessment Report</span>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.modalBtn}
              onClick={handleCopy}
              title="Copy markdown text to clipboard"
            >
              {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>

            <button
              type="button"
              className={styles.modalBtn}
              onClick={handleDownload}
              title="Download markdown report file"
            >
              <Download size={14} />
              Download .md
            </button>

            <button
              type="button"
              className={`${styles.modalBtn} ${styles.primaryBtn}`}
              onClick={handlePrint}
              title="Print formatted report or save as PDF"
            >
              <Printer size={14} />
              Print / PDF
            </button>

            <button
              type="button"
              className={styles.modalBtn}
              onClick={onClose}
              title="Close modal"
              style={{ padding: '6px 8px' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={styles.modalContent}>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem', color: '#94a3b8' }}>
            This reproducible coursework report compiles the current operating equilibrium, physical sensor readings table, active Mamdani rule firings, and defuzzification calculations.
          </p>

          <pre className={styles.reportPreview}>
            {report.markdownContent}
          </pre>
        </div>
      </div>
    </div>
  );
}
