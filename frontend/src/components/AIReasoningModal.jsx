import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X, Clock, Tag, Flame, ShieldAlert, Sparkles, Layers, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { decodeHtmlEntities } from '../utils/textUtils';

const AIReasoningModal = ({ item, isOpen, onClose, onReanalyze, isAnalyzing = false }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const title = decodeHtmlEntities(item.title || 'Utan rubrik');
  const source = item.source_title || 'Okänd källa';
  const score = item.prio_score || 0;
  const priority = (item.priority || 'low').toLowerCase();
  const urgency = item.urgency_score ?? 5;
  const substance = item.substance_score ?? 5;
  const duration = item.ai_duration_s;
  const reason = item.prio_reason || 'Ingen motivering tillgänglig.';
  const isClickbait = Boolean(item.is_clickbait);
  const clickbaitReason = item.clickbait_reason || '';
  const category = item.category || 'Övrigt';
  const clusterSize = item.cluster_size || 1;
  const tags = Array.isArray(item.tags) ? item.tags : [];

  const getPriorityBadge = () => {
    if (priority === 'high' || score >= 75) {
      return { label: 'Hög prioritet (PRIO)', color: '#f97316', bg: 'rgba(249, 115, 22, 0.14)' };
    }
    if (priority === 'medium' || score >= 45) {
      return { label: 'Normal prioritet', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.14)' };
    }
    return { label: 'Låg prioritet', color: 'var(--text-muted)', bg: 'rgba(255, 255, 255, 0.06)' };
  };

  const badge = getPriorityBadge();

  return (
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '620px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Info size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  AI-analys & Resonemang
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {source}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Stäng"
            >
              <X size={20} />
            </button>
          </div>

          {/* Innehåll */}
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Artikelrubrik */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Granskad artikel
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.4 }}>
                {title}
              </div>
            </div>

            {/* Totalpoäng och statuskort */}
            <div style={{
              backgroundColor: 'var(--bg-app)',
              border: `1px solid ${badge.color}40`,
              borderRadius: '12px',
              padding: '1.15rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Total prioritetspoäng
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                  <span style={{ fontSize: '2.2rem', fontWeight: 800, color: badge.color, lineHeight: 1 }}>
                    {score}
                  </span>
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    / 100 poäng
                  </span>
                </div>
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '6px 14px',
                borderRadius: '999px',
                backgroundColor: badge.bg,
                color: badge.color,
                fontWeight: 700,
                fontSize: '0.85rem'
              }}>
                <Flame size={15} />
                <span>{badge.label}</span>
              </div>
            </div>

            {/* Poängmatrisens tre pelare */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                Sammansatt poängmatris (Grundpoäng)
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {/* Kategori */}
                <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.9rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Kategori (30 %)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {category}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Styrs av dina inställningar
                  </div>
                </div>

                {/* Akuthet */}
                <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.9rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Akuthet (40 %)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: urgency >= 8 ? '#f97316' : 'var(--text-main)' }}>
                      {urgency}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 10</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {urgency >= 8 ? 'Mycket brådskande händelse' : (urgency >= 5 ? 'Väsentligt nyhetsvärde' : 'Vardaglig händelse')}
                  </div>
                </div>

                {/* Substans */}
                <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.9rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Faktasubstans (30 %)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: substance >= 7 ? '#10b981' : 'var(--text-main)' }}>
                      {substance}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 10</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {substance >= 7 ? 'Genomarbetat faktainnehåll' : (substance >= 4 ? 'Måttligt informationsdjup' : 'Kortfattad notis')}
                  </div>
                </div>
              </div>
            </div>

            {/* AI-modellens motivering */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>
                Modellens motivering & Beräkning
              </div>
              <div style={{
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '0.9rem 1rem',
                fontSize: '0.88rem',
                color: 'var(--text-main)',
                lineHeight: 1.5
              }}>
                {reason}
              </div>
            </div>

            {/* Diagnostik & Prestanda */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.55rem' }}>
                Diagnostik & Metadata
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
                {/* Analystid */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.85rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <Clock size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Analystid i LLM</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {duration ? `${duration} sekunder` : 'Bakgrundsbearbetad'}
                    </div>
                  </div>
                </div>

                {/* ClickBait-status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.85rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  {isClickbait ? (
                    <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                  ) : (
                    <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ClickBait-analys</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isClickbait ? '#ef4444' : 'var(--text-main)' }}>
                      {isClickbait ? (clickbaitReason || 'ClickBait upptäckt (-25p)') : 'Ingen ClickBait'}
                    </div>
                  </div>
                </div>

                {/* Kluster */}
                {clusterSize > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.85rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <Layers size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Flerkällsbekräftelse</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {clusterSize} oberoende källor
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Taggar */}
            {tags.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Tag size={13} />
                  <span>Identifierade ämnestaggar</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {tags.map((t, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        color: 'var(--text-main)'
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)'
          }}>
            {onReanalyze && (
              <button
                onClick={() => onReanalyze(item.id)}
                disabled={isAnalyzing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '8px 16px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  borderRadius: '8px',
                  cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                <RefreshCw size={15} className={isAnalyzing ? 'spin' : ''} />
                <span>{isAnalyzing ? 'Analyserar om...' : 'Kör om AI-analys'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                padding: '8px 20px',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                marginLeft: 'auto'
              }}
            >
              Stäng
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AIReasoningModal;
