import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X, Clock, Tag, Flame, Sparkles, Layers, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, Rss, Cpu } from 'lucide-react';
import { decodeHtmlEntities, resolveFeedIcon } from '../utils/textUtils';
import './AIReasoningModal.css';

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

  const formatDateTime = (dateVal) => {
    if (!dateVal) return null;
    const d = typeof dateVal === 'number' ? new Date(dateVal * 1000) : new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pubDateFormatted = formatDateTime(item.published_ts || item.published);
  const recDateFormatted = formatDateTime(item.received_ts);

  const parseReason = (rawReason) => {
    if (!rawReason || !rawReason.trim()) {
      return { type: 'empty', text: 'Ingen beräkningsinformation tillgänglig.' };
    }

    const matrixMatch = rawReason.match(/^Poängmatris\s+(\d+p)\s*\((.*)\)$/i);
    if (matrixMatch) {
      const rawContent = matrixMatch[2];
      const parts = [];
      let cur = '';
      let depth = 0;
      for (let i = 0; i < rawContent.length; i++) {
        const c = rawContent[i];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        if (c === ',' && depth === 0) {
          if (cur.trim()) parts.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      if (cur.trim()) parts.push(cur.trim());

      const baseComponents = [];
      const adjustments = [];

      parts.forEach((p) => {
        const pLower = p.toLowerCase();
        if (
          p.startsWith('+') ||
          p.startsWith('-') ||
          pLower.includes('clickbait') ||
          pLower.includes('avdrag') ||
          pLower.includes('bonus') ||
          pLower.includes('flerkällsbekräftelse') ||
          pLower.includes('intresseprofil') ||
          pLower.includes('ogillat')
        ) {
          let adjType = 'positive';
          if (p.startsWith('-') || pLower.includes('avdrag') || pLower.includes('ogillat')) {
            adjType = 'negative';
          }
          adjustments.push({ text: p, type: adjType });
        } else {
          baseComponents.push(p);
        }
      });

      return {
        type: 'matrix',
        scoreText: matrixMatch[1],
        baseSummary: baseComponents.join(' • '),
        adjustments
      };
    }

    if (rawReason.startsWith('Träff på bevakningsord:')) {
      return {
        type: 'keyword',
        text: rawReason.replace('Träff på bevakningsord:', '').trim()
      };
    }

    if (rawReason.startsWith('Prioriterad av användaren:')) {
      return {
        type: 'user_prio',
        text: rawReason.replace('Prioriterad av användaren:', '').trim()
      };
    }

    return {
      type: 'text',
      text: rawReason
    };
  };

  const parsedReason = parseReason(reason);

  const getPriorityInfo = () => {
    if (priority === 'high' || score >= 75) {
      return {
        className: 'is-prio',
        label: 'Hög prioritet (PRIO)',
        color: '#f97316',
        badgeBg: 'rgba(249, 115, 22, 0.16)'
      };
    }
    if (priority === 'medium' || score >= 45) {
      return {
        className: 'is-normal',
        label: 'Normal prioritet',
        color: '#3b82f6',
        badgeBg: 'rgba(59, 130, 246, 0.16)'
      };
    }
    return {
      className: 'is-low',
      label: 'Låg prioritet',
      color: 'var(--text-muted)',
      badgeBg: 'rgba(148, 163, 184, 0.14)'
    };
  };

  const prioInfo = getPriorityInfo();

  return (
    <AnimatePresence>
      <div className="ai-modal-overlay" onClick={onClose}>
        <motion.div
          className="ai-modal-container"
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobil drag-handle */}
          <div className="ai-modal-drag-handle-container">
            <div className="ai-modal-drag-handle" />
          </div>

          {/* Header */}
          <div className="ai-modal-header">
            <div className="ai-modal-header-left">
              <div className="ai-modal-icon-box">
                <Info size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 className="ai-modal-title">Artikeldetaljer & AI-analys</h3>
                <div className="ai-modal-subtitle">
                  {item.feed_icon ? (
                    <img
                      src={resolveFeedIcon(item.feed_icon)}
                      alt=""
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '3px',
                        objectFit: 'contain',
                        flexShrink: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        padding: '1px'
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Rss size={13} style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {source}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="ai-modal-close-btn"
              title="Stäng fönster (Esc)"
              aria-label="Stäng"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="ai-modal-body">
            {/* Granskad artikelrubrik */}
            <div className="ai-modal-article-section">
              <div className="ai-modal-section-label">
                Granskad artikel
              </div>
              <div className="ai-modal-article-title">
                {title}
              </div>
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.78rem',
                    color: 'var(--primary, #3b82f6)',
                    textDecoration: 'none',
                    marginTop: '0.2rem',
                    width: 'fit-content'
                  }}
                >
                  <span>Öppna originalartikel</span>
                  <ExternalLink size={12} />
                </a>
              )}

              {(pubDateFormatted || recDateFormatted) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {pubDateFormatted && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={12} style={{ color: 'var(--primary, #3b82f6)' }} />
                      <span>Publicerad: <strong style={{ color: 'var(--text-main)' }}>{pubDateFormatted}</strong></span>
                    </div>
                  )}
                  {recDateFormatted && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={12} style={{ color: '#10b981' }} />
                      <span>Hämtad: <strong style={{ color: 'var(--text-main)' }}>{recDateFormatted}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Total prioritetspoäng (Hero-kort) */}
            <div className={`ai-modal-score-card ${prioInfo.className}`}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                  Total prioritetspoäng
                </div>
                <div className="ai-modal-score-number-group">
                  <span className="ai-modal-score-big" style={{ color: prioInfo.color }}>
                    {score}
                  </span>
                  <span className="ai-modal-score-max">
                    / 100 poäng
                  </span>
                </div>
              </div>

              <div
                className="ai-modal-prio-badge"
                style={{
                  backgroundColor: prioInfo.badgeBg,
                  color: prioInfo.color
                }}
              >
                <Flame size={15} />
                <span>{prioInfo.label}</span>
              </div>
            </div>

            {/* Sammansatt poängmatris & beräkning */}
            <div className="ai-modal-matrix-section">
              <div className="ai-modal-section-label" style={{ marginBottom: '0.4rem' }}>
                <Sparkles size={13} style={{ color: 'var(--primary, #6366f1)' }} />
                <span>Sammansatt poängmatris & beräkning</span>
              </div>

              <div className="ai-modal-matrix-card">
                {/* 3 Pelare */}
                <div className="ai-modal-pillars-grid">
                  {/* Pelare 1: Kategori */}
                  <div className="ai-modal-pillar-card">
                    <div className="ai-modal-pillar-name">Kategori (30 %)</div>
                    <div className="ai-modal-pillar-val">{category}</div>
                    <div className="ai-modal-pillar-bar-bg">
                      <div
                        className="ai-modal-pillar-bar-fill"
                        style={{
                          width: '100%',
                          backgroundColor: 'var(--primary, #3b82f6)'
                        }}
                      />
                    </div>
                    <div className="ai-modal-pillar-desc">
                      Styrs av dina inställningar
                    </div>
                  </div>

                  {/* Pelare 2: Akuthet */}
                  <div className="ai-modal-pillar-card">
                    <div className="ai-modal-pillar-name">Akuthet (40 %)</div>
                    <div className="ai-modal-pillar-val">
                      <span style={{ color: urgency >= 8 ? '#f97316' : undefined }}>
                        {urgency}
                      </span>
                      <span className="ai-modal-pillar-subval">
                        / 10
                      </span>
                    </div>
                    <div className="ai-modal-pillar-bar-bg">
                      <div
                        className="ai-modal-pillar-bar-fill"
                        style={{
                          width: `${Math.min(100, urgency * 10)}%`,
                          backgroundColor: urgency >= 8 ? '#f97316' : (urgency >= 5 ? '#3b82f6' : '#94a3b8')
                        }}
                      />
                    </div>
                    <div className="ai-modal-pillar-desc">
                      {urgency >= 8 ? 'Mycket brådskande' : (urgency >= 5 ? 'Väsentligt nyhetsvärde' : 'Vardaglig händelse')}
                    </div>
                  </div>

                  {/* Pelare 3: Faktasubstans */}
                  <div className="ai-modal-pillar-card">
                    <div className="ai-modal-pillar-name">Faktasubstans (30 %)</div>
                    <div className="ai-modal-pillar-val">
                      <span style={{ color: substance >= 7 ? '#10b981' : undefined }}>
                        {substance}
                      </span>
                      <span className="ai-modal-pillar-subval">
                        / 10
                      </span>
                    </div>
                    <div className="ai-modal-pillar-bar-bg">
                      <div
                        className="ai-modal-pillar-bar-fill"
                        style={{
                          width: `${Math.min(100, substance * 10)}%`,
                          backgroundColor: substance >= 7 ? '#10b981' : (substance >= 4 ? '#3b82f6' : '#94a3b8')
                        }}
                      />
                    </div>
                    <div className="ai-modal-pillar-desc">
                      {substance >= 7 ? 'Genomarbetat innehåll' : (substance >= 4 ? 'Måttligt faktainnehåll' : 'Kortfattad notis')}
                    </div>
                  </div>
                </div>

                {/* Integrerad motivering och justeringar */}
                <div className="ai-modal-matrix-footer">
                  {parsedReason.type === 'matrix' ? (
                    <div className="ai-modal-calc-wrap">
                      <div className="ai-modal-calc-row">
                        <span className="ai-modal-calc-label">Grundberäkning:</span>
                        <span className="ai-modal-calc-base-text">{parsedReason.baseSummary}</span>
                      </div>

                      {parsedReason.adjustments.length > 0 ? (
                        <div className="ai-modal-calc-row">
                          <span className="ai-modal-calc-label">Justeringar:</span>
                          <div className="ai-modal-calc-badges">
                            {parsedReason.adjustments.map((adj, idx) => (
                              <span
                                key={idx}
                                className={`ai-modal-calc-badge ${adj.type === 'positive' ? 'is-pos' : 'is-neg'}`}
                              >
                                {adj.text}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="ai-modal-calc-none">
                          Inga aktiva profiljusteringar eller avdrag.
                        </div>
                      )}
                    </div>
                  ) : parsedReason.type === 'keyword' ? (
                    <div className="ai-modal-calc-row">
                      <span className="ai-modal-calc-label">Prioritering:</span>
                      <span className="ai-modal-calc-badge is-keyword">
                        Bevakningsord: {parsedReason.text} (100p direktträff)
                      </span>
                    </div>
                  ) : parsedReason.type === 'user_prio' ? (
                    <div className="ai-modal-calc-row">
                      <span className="ai-modal-calc-label">Prioritering:</span>
                      <span className="ai-modal-calc-badge is-pos">
                        Manuellt prioriterad: {parsedReason.text}
                      </span>
                    </div>
                  ) : (
                    <div className="ai-modal-calc-text">
                      {parsedReason.text}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Diagnostik & Metadata */}
            <div>
              <div className="ai-modal-section-label" style={{ marginBottom: '0.5rem' }}>
                Diagnostik & Metadata
              </div>

              <div className="ai-modal-diagnostics-grid">
                {/* AI-modell */}
                <div className="ai-modal-diagnostic-chip">
                  <Cpu size={16} className="ai-modal-diagnostic-icon" style={{ color: '#8b5cf6' }} />
                  <div>
                    <div className="ai-modal-diagnostic-label">AI-modell</div>
                    <div className="ai-modal-diagnostic-val" style={{ wordBreak: 'break-all' }}>
                      {item.ai_model || 'google/gemma-4-12b-qat'}
                    </div>
                  </div>
                </div>

                {/* Analystid i sekunder */}
                <div className="ai-modal-diagnostic-chip">
                  <Clock size={16} className="ai-modal-diagnostic-icon" style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <div className="ai-modal-diagnostic-label">Analystid i LLM</div>
                    <div className="ai-modal-diagnostic-val">
                      {duration ? `${duration} sekunder` : 'Bakgrundsbearbetad'}
                    </div>
                  </div>
                </div>

                {/* ClickBait-granskning */}
                <div className="ai-modal-diagnostic-chip">
                  {isClickbait ? (
                    <AlertTriangle size={16} className="ai-modal-diagnostic-icon" style={{ color: '#ef4444' }} />
                  ) : (
                    <CheckCircle2 size={16} className="ai-modal-diagnostic-icon" style={{ color: '#10b981' }} />
                  )}
                  <div>
                    <div className="ai-modal-diagnostic-label">ClickBait-analys</div>
                    <div className="ai-modal-diagnostic-val" style={{ color: isClickbait ? '#ef4444' : undefined }}>
                      {isClickbait ? (clickbaitReason || 'ClickBait upptäckt (-25p)') : 'Ingen ClickBait'}
                    </div>
                  </div>
                </div>

                {/* Kluster och bekräftelse */}
                {clusterSize > 1 && (
                  <div className="ai-modal-diagnostic-chip">
                    <Layers size={16} className="ai-modal-diagnostic-icon" style={{ color: '#3b82f6' }} />
                    <div>
                      <div className="ai-modal-diagnostic-label">Flerkällsbekräftelse</div>
                      <div className="ai-modal-diagnostic-val">
                        {clusterSize} oberoende källor
                      </div>
                    </div>
                  </div>
                )}

                {/* Hämtad till systemet */}
                {recDateFormatted && (
                  <div className="ai-modal-diagnostic-chip">
                    <Clock size={16} className="ai-modal-diagnostic-icon" style={{ color: '#0ea5e9' }} />
                    <div>
                      <div className="ai-modal-diagnostic-label">Hämtad till systemet</div>
                      <div className="ai-modal-diagnostic-val">
                        {recDateFormatted}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Identifierade ämnestaggar */}
            {tags.length > 0 && (
              <div>
                <div className="ai-modal-section-label" style={{ marginBottom: '0.45rem' }}>
                  <Tag size={13} />
                  <span>Identifierade ämnestaggar</span>
                </div>
                <div className="ai-modal-tags-wrap">
                  {tags.map((t, i) => (
                    <span key={i} className="ai-modal-tag-chip">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="ai-modal-footer">
            {onReanalyze && (
              <button
                type="button"
                onClick={() => onReanalyze(item.id)}
                disabled={isAnalyzing}
                className="ai-modal-btn-secondary"
              >
                <RefreshCw size={15} className={isAnalyzing ? 'spin' : ''} />
                <span>{isAnalyzing ? 'Analyserar om...' : 'Kör om AI-analys'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="ai-modal-btn-primary"
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
