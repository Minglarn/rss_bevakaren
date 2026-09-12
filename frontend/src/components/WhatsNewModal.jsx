import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, Wrench, X, ChevronDown, ChevronUp, History } from 'lucide-react';
import packageJson from '../../package.json';
import { CHANGELOG_DATA } from '../changelog';
import './WhatsNewModal.css';

const STORAGE_KEY = 'rss_bevakaren_last_seen_version';

const WhatsNewModal = ({ forceOpen = false, onClose = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const currentVersion = packageJson.version;
  const latestRelease = CHANGELOG_DATA[0] || null;
  const olderReleases = CHANGELOG_DATA.slice(1);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (lastSeen !== currentVersion) {
      setIsOpen(true);
    }

    const handleOpenEvent = () => {
      setIsOpen(true);
    };

    window.addEventListener('openWhatsNew', handleOpenEvent);
    return () => {
      window.removeEventListener('openWhatsNew', handleOpenEvent);
    };
  }, [currentVersion, forceOpen]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, currentVersion);
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen || !latestRelease) return null;

  return (
    <div className="whats-new-overlay" onClick={handleDismiss}>
      <div className="whats-new-modal" onClick={(e) => e.stopPropagation()}>
        {/* Mobil Drag Handle */}
        <div className="whats-new-drag-handle-container">
          <div className="whats-new-drag-handle" />
        </div>

        {/* Header */}
        <div className="whats-new-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: 1 }}>
            <div className="whats-new-icon-box">
              <Sparkles size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 className="whats-new-title">
                  Nyheter i RSS-Bevakaren
                </h3>
                <span className="whats-new-badge">
                  v{currentVersion}
                </span>
              </div>
              <p className="whats-new-date">
                Uppdaterad {latestRelease.date}
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="whats-new-close-btn"
            title="Stäng"
            aria-label="Stäng dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="whats-new-body">
          <div className="whats-new-release-section">
            <h4 className="whats-new-release-title">
              {latestRelease.title}
            </h4>

            <div className="whats-new-items-grid">
              {latestRelease.highlights.map((item, idx) => (
                <div 
                  key={idx}
                  className={`whats-new-item-card ${item.type || 'feature'}`}
                >
                  <div className="whats-new-item-icon">
                    {item.type === 'feature' ? (
                      <Sparkles size={18} />
                    ) : item.type === 'fix' ? (
                      <Wrench size={18} />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                  </div>
                  <div className="whats-new-item-content">
                    <div className="whats-new-item-title">
                      {item.title}
                    </div>
                    <div className="whats-new-item-desc">
                      {item.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Older releases toggle */}
          {olderReleases.length > 0 && (
            <div className="whats-new-history-section">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="whats-new-history-toggle"
              >
                <History size={16} />
                <span>{showHistory ? 'Dölj tidigare versioner' : 'Visa tidigare versionshistorik'}</span>
                {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showHistory && (
                <div className="whats-new-history-list-wrapper">
                  {olderReleases.map((rel) => (
                    <div key={rel.version} className="whats-new-history-card">
                      <div className="whats-new-history-header">
                        <span className="whats-new-history-version">
                          v{rel.version}
                        </span>
                        <span className="whats-new-history-date">
                          {rel.date}
                        </span>
                      </div>
                      <div className="whats-new-history-release-title">
                        {rel.title}
                      </div>
                      <ul className="whats-new-history-list">
                        {rel.highlights.map((h, i) => (
                          <li key={i}>
                            <strong>{h.title}:</strong> {h.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="whats-new-footer">
          <span className="whats-new-footer-hint">
            Klicka på versionsnumret i menyn för att öppna ändringsloggen igen
          </span>

          <button
            onClick={handleDismiss}
            className="whats-new-primary-btn"
          >
            Uppfattat
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewModal;
