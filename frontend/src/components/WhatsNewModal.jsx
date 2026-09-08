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
        {/* Header */}
        <div className="whats-new-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="whats-new-icon-box">
              <Sparkles size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
            <X size={22} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="whats-new-body">
          <div>
            <h4 className="whats-new-release-title">
              {latestRelease.title}
            </h4>

            <div className="whats-new-items-grid">
              {latestRelease.highlights.map((item, idx) => (
                <div 
                  key={idx}
                  className={`whats-new-item-card ${item.type}`}
                >
                  <div className="whats-new-item-icon">
                    {item.type === 'feature' ? (
                      <Sparkles size={20} />
                    ) : item.type === 'fix' ? (
                      <Wrench size={20} />
                    ) : (
                      <CheckCircle2 size={20} />
                    )}
                  </div>
                  <div>
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
                <History size={18} />
                <span>{showHistory ? 'Dölj tidigare versioner' : 'Visa tidigare versionshistorik'}</span>
                {showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {showHistory && (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                          <li key={i} style={{ marginBottom: '4px' }}>
                            {h.description}
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

        {/* Footer */}
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
