import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, Wrench, X, ChevronDown, ChevronUp, History } from 'lucide-react';
import packageJson from '../../package.json';
import { CHANGELOG_DATA } from '../changelog';

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
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={handleDismiss}
    >
      <div 
        style={{
          backgroundColor: 'var(--card-bg, #1a1f2c)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
          color: 'var(--text-main, #f8fafc)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.08), transparent)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
                  Nyheter i RSS-Bevakaren
                </h3>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '2px 7px',
                  borderRadius: '12px'
                }}>
                  v{currentVersion}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                Släppt {latestRelease.date}
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Stäng"
            aria-label="Stäng dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{
          padding: '1.5rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          <div>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main, #f8fafc)' }}>
              {latestRelease.title}
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {latestRelease.highlights.map((item, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem 0.9rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.05))',
                    borderRadius: '10px'
                  }}
                >
                  <div style={{ 
                    marginTop: '2px', 
                    color: item.type === 'feature' ? '#3b82f6' : '#10b981',
                    flexShrink: 0 
                  }}>
                    {item.type === 'feature' ? (
                      <Sparkles size={16} />
                    ) : item.type === 'fix' ? (
                      <Wrench size={16} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '2px' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.45 }}>
                      {item.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Older releases toggle */}
          {olderReleases.length > 0 && (
            <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.06))' }}>
              <button
                onClick={() => setShowHistory(!showHistory)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  padding: 0
                }}
              >
                <History size={15} />
                <span>{showHistory ? 'Dölj tidigare versioner' : 'Visa tidigare versionshistorik'}</span>
                {showHistory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {showHistory && (
                <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {olderReleases.map((rel) => (
                    <div 
                      key={rel.version} 
                      style={{
                        padding: '0.75rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary, #3b82f6)' }}>
                          v{rel.version}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                          {rel.date}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, marginBottom: '0.35rem' }}>
                        {rel.title}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>
                        {rel.highlights.map((h, i) => (
                          <li key={i} style={{ marginBottom: '2px' }}>
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
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0, 0, 0, 0.15)'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
            Klicka på versionsnumret i menyn för att se detta igen
          </span>

          <button
            onClick={handleDismiss}
            style={{
              padding: '0.55rem 1.25rem',
              backgroundColor: 'var(--primary, #2563eb)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}
          >
            Uppfattat
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewModal;
