import React, { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, Calendar, Sparkles, ExternalLink, ChevronRight, Clock } from 'lucide-react';
import api from '../api';

const decodeHtmlEntities = (str) => {
  if (!str) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
};

const renderBriefingInline = (text) => {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} style={{ color: 'var(--text-main)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

const formatReportTitle = (title) => {
  if (!title) {
    const hour = new Date().getHours();
    return (hour >= 5 && hour < 12) ? 'Morgonrapport' : 'Kvällsrapport';
  }
  let clean = title.replace(/^(dagens\s+)?briefing\s*(-|–|:)?\s*/i, '').trim();
  clean = clean.replace(/^briefing\s*(-|–|:)?\s*/i, '').trim();
  if (!clean || clean.toLowerCase() === 'briefing') {
    const hour = new Date().getHours();
    return (hour >= 5 && hour < 12) ? 'Morgonrapport' : 'Kvällsrapport';
  }
  return clean;
};

const renderBriefingMarkdown = (content) => {
  if (!content) return null;
  const lines = content.split('\n');
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <div key={`list-${elements.length}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', margin: '0.65rem 0' }}>
          {currentList.map((item, lIdx) => (
            <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', lineHeight: 1.6 }}>
              <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '1rem', lineHeight: '1.2rem' }}>•</span>
              <div style={{ flex: 1 }}>{renderBriefingInline(item)}</div>
            </div>
          ))}
        </div>
      );
      currentList = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith('#')) {
      flushList();
      const headerText = trimmed.replace(/^#+\s*/, '');
      elements.push(
        <h4 key={idx} style={{ margin: '1rem 0 0.4rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
          {renderBriefingInline(headerText)}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const itemText = trimmed.replace(/^[-*•]\s*/, '');
      currentList.push(itemText);
      return;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      flushList();
      const numMatch = trimmed.match(/^(\d+\.)\s*(.*)/);
      if (numMatch) {
        elements.push(
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', margin: '0.5rem 0', lineHeight: 1.6 }}>
            <span style={{ color: 'var(--primary)', fontWeight: 700, minWidth: '1.3rem' }}>{numMatch[1]}</span>
            <div style={{ flex: 1 }}>{renderBriefingInline(numMatch[2])}</div>
          </div>
        );
        return;
      }
    }

    flushList();
    elements.push(
      <p key={idx} style={{ margin: '0 0 0.75rem 0', lineHeight: 1.65, color: 'var(--text-main)', fontSize: '0.95rem' }}>
        {renderBriefingInline(trimmed)}
      </p>
    );
  });

  flushList();
  return elements;
};

const formatDigestDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Idag ${timeStr}`;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Igår ${timeStr}`;
  }

  return `${d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} ${timeStr}`;
};

const BriefingView = () => {
  const [digests, setDigests] = useState([]);
  const [selectedDigestId, setSelectedDigestId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchDigests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/ai/digests?limit=30');
      if (res.data && Array.isArray(res.data)) {
        setDigests(res.data);
        if (res.data.length > 0) {
          setSelectedDigestId(prev => (prev !== null && res.data.some(d => d.id === prev)) ? prev : res.data[0].id);
        }
      }
    } catch (e) {
      console.error("Kunde inte hämta briefing-historik:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGenerate = async (forceRuleBased = false) => {
    setGenerating(true);
    try {
      const res = await api.post('/ai/digest/generate', { force_rule_based: forceRuleBased });
      if (res.data) {
        setDigests(prev => {
          const filtered = prev.filter(d => d.id !== res.data.id);
          return [res.data, ...filtered];
        });
        setSelectedDigestId(res.data.id);
      }
    } catch (e) {
      console.error("Kunde inte generera ny briefing:", e);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchDigests();

    const handleDigestUpdated = () => {
      fetchDigests();
    };

    window.addEventListener('digestUpdated', handleDigestUpdated);
    return () => window.removeEventListener('digestUpdated', handleDigestUpdated);
  }, [fetchDigests]);

  const selectedDigest = digests.find(d => d.id === selectedDigestId) || digests[0] || null;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: '1rem', 
        marginBottom: '1.5rem',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileText size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Dagens Briefing
            </h1>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Morgon- och kvällsrapporter genererade automatiskt i bakgrunden kl 07:00 och 18:00
            </p>
          </div>
        </div>

        <button
          onClick={() => handleGenerate(false)}
          disabled={generating}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.6rem 1.1rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            cursor: generating ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
            transition: 'all 0.15s ease'
          }}
          title="Generera en färsk briefing nu via LM Studio"
        >
          <RefreshCw size={15} className={generating ? 'spin' : ''} />
          <span>{generating ? 'Analyserar nyhetsläget...' : 'Generera ny briefing nu'}</span>
        </button>
      </div>

      {loading && digests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spin" style={{ margin: '0 auto 1rem auto', display: 'block', color: 'var(--primary)' }} />
          Hämtar dagliga briefings...
        </div>
      ) : digests.length === 0 ? (
        <div style={{ 
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          padding: '3rem 1.5rem', 
          textAlign: 'center',
          maxWidth: '560px',
          margin: '2rem auto'
        }}>
          <FileText size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem auto', display: 'block' }} />
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>Ingen briefing har skapats än</h3>
          <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Klicka på knappen nedan för att göra en direkt analys av dina aktiva nyhetsflöden från det senaste dygnet.
          </p>
          <button
            onClick={() => handleGenerate(false)}
            disabled={generating}
            style={{
              padding: '0.65rem 1.3rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              cursor: generating ? 'not-allowed' : 'pointer'
            }}
          >
            {generating ? 'Genererar...' : 'Skapa första briefingen'}
          </button>
        </div>
      ) : (
        <div className="briefing-view-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '1.5rem', alignItems: 'start' }}>
          {/* Huvudområde: Vald rapport */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1.75rem',
            boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.06)'
          }}>
            {selectedDigest ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: selectedDigest.digest_type === 'ai_generated' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                      color: selectedDigest.digest_type === 'ai_generated' ? '#10b981' : 'var(--primary)'
                    }}>
                      {selectedDigest.digest_type === 'ai_generated' ? <Sparkles size={13} /> : <Clock size={13} />}
                      {selectedDigest.digest_type === 'ai_generated' ? 'AI-analys (LM Studio)' : 'Regelbaserad sammanställning'}
                    </span>

                    {selectedDigest.created_at && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Calendar size={13} />
                        {formatDigestDate(selectedDigest.created_at)}
                      </span>
                    )}
                  </div>
                </div>

                <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.35 }}>
                  {formatReportTitle(selectedDigest.title)}
                </h2>

                <div style={{ color: 'var(--text-main)', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
                  {renderBriefingMarkdown(selectedDigest.content)}
                </div>

                {/* Berörda artiklar */}
                {selectedDigest.articles && selectedDigest.articles.length > 0 && (
                  <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1.25rem' }}>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Berörda källor och händelser ({selectedDigest.articles.length}):
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.6rem' }}>
                      {selectedDigest.articles.map((art) => (
                        <a
                          key={art.id}
                          href={art.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            padding: '0.55rem 0.85rem',
                            borderRadius: '8px',
                            fontSize: '0.82rem',
                            backgroundColor: 'var(--bg-app)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)',
                            textDecoration: 'none',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'none'; }}
                          title={`${art.source_title}: ${art.title}`}
                        >
                          <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 600, display: 'block', fontSize: '0.75rem', marginBottom: '0.1rem' }}>
                              {art.source_title}
                            </span>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {decodeHtmlEntities(art.title)}
                            </span>
                          </div>
                          <ExternalLink size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Högerpanel: Historik och tidigare rapporter */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1.25rem',
            position: 'sticky',
            top: '1.5rem',
            maxHeight: 'calc(100vh - 3rem)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Tidigare Briefings
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {digests.length} st
              </span>
            </div>

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingRight: '0.2rem' }}>
              {digests.map((d) => {
                const isSelected = d.id === selectedDigestId;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDigestId(d.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-app)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--primary)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatReportTitle(d.title)}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {formatDigestDate(d.created_at)} • {(d.articles || []).length || (d.article_ids || []).length} källor
                      </div>
                    </div>
                    <ChevronRight size={15} style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)', marginLeft: '0.4rem', flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BriefingView;
