import React, { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, Calendar, Sparkles, ExternalLink, ChevronRight, Clock, Volume2, VolumeX, Copy, Check, Share2 } from 'lucide-react';
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

const isMorningReport = (digest) => {
  if (!digest) return true;
  if (digest.title && digest.title.toLowerCase().includes('morgon')) return true;
  if (digest.title && (digest.title.toLowerCase().includes('kväll') || digest.title.toLowerCase().includes('eftermiddag'))) return false;
  if (digest.created_at) {
    const d = new Date(typeof digest.created_at === 'number' ? digest.created_at * 1000 : digest.created_at);
    return d.getHours() < 14;
  }
  return true;
};

const renderBriefingMarkdown = (content) => {
  if (!content) return null;
  const lines = content.split('\n');
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <div key={`list-${elements.length}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', margin: '0.4rem 0 0.65rem 0' }}>
          {currentList.map((item, lIdx) => (
            <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.85rem', lineHeight: '1.4', flexShrink: 0 }}>•</span>
              <div style={{ flex: 1, fontSize: '0.91rem' }}>{renderBriefingInline(item)}</div>
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
        <div key={idx} style={{ 
          margin: elements.length === 0 ? '0 0 0.4rem 0' : '0.9rem 0 0.4rem 0', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.45rem',
          paddingBottom: '0.2rem',
          borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.06))'
        }}>
          <span style={{ width: '3px', height: '14px', borderRadius: '2px', backgroundColor: 'var(--primary)', flexShrink: 0 }} />
          <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {renderBriefingInline(headerText)}
          </h4>
        </div>
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
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', margin: '0.4rem 0', lineHeight: 1.5 }}>
            <span style={{ color: 'var(--primary)', fontWeight: 700, minWidth: '1.2rem', fontSize: '0.9rem' }}>{numMatch[1]}</span>
            <div style={{ flex: 1, fontSize: '0.91rem' }}>{renderBriefingInline(numMatch[2])}</div>
          </div>
        );
        return;
      }
    }

    flushList();
    elements.push(
      <p key={idx} style={{ margin: '0 0 0.55rem 0', lineHeight: 1.55, color: 'var(--text-main)', fontSize: '0.91rem' }}>
        {renderBriefingInline(trimmed)}
      </p>
    );
  });

  flushList();
  return elements;
};

const formatDigestDate = (ts) => {
  if (!ts) return '';
  const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
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
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

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
    return () => {
      window.removeEventListener('digestUpdated', handleDigestUpdated);
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [fetchDigests]);

  const selectedDigest = digests.find(d => d.id === selectedDigestId) || digests[0] || null;

  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
  }, [selectedDigestId]);

  const toggleSpeech = () => {
    if (!window.speechSynthesis) {
      alert("Talsyntes stöds inte av denna webbläsare.");
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    if (!selectedDigest || !selectedDigest.content) return;

    window.speechSynthesis.cancel();
    const cleanText = `${formatReportTitle(selectedDigest.title)}. ${selectedDigest.content.replace(/[*#_`>•]/g, ' ').replace(/\s+/g, ' ').trim()}`;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'sv-SE';
    utterance.rate = 1.0;

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  const handleCopy = () => {
    if (!selectedDigest || !selectedDigest.content) return;
    const fullText = `${formatReportTitle(selectedDigest.title)}\n\n${selectedDigest.content}`;
    navigator.clipboard.writeText(fullText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShare = () => {
    if (!selectedDigest) return;
    const title = formatReportTitle(selectedDigest.title);
    const text = `${title}\n\n${selectedDigest.content}`;
    if (navigator.share) {
      navigator.share({ title, text }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <div className="briefing-view-container">
      {/* Header bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: '0.75rem', 
        marginBottom: '0.75rem',
        paddingBottom: '0.65rem',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <FileText size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Morgon- & Kvällsrapport
            </h1>
            <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Sammanställning av nyhetsläget kl 07:00 och 18:00
            </p>
          </div>
        </div>

        <button
          onClick={() => handleGenerate(false)}
          disabled={generating}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.85rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            cursor: generating ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
            transition: 'all 0.15s ease'
          }}
          title="Generera en färsk briefing nu via AI"
        >
          <RefreshCw size={14} className={generating ? 'spin' : ''} />
          <span>{generating ? 'Analyserar...' : 'Generera ny nu'}</span>
        </button>
      </div>

      {loading && digests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={26} className="spin" style={{ margin: '0 auto 1rem auto', display: 'block', color: 'var(--primary)' }} />
          Hämtar dagliga rapporter...
        </div>
      ) : digests.length === 0 ? (
        <div style={{ 
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          padding: '2.5rem 1.25rem', 
          textAlign: 'center',
          maxWidth: '520px',
          margin: '2rem auto'
        }}>
          <FileText size={34} style={{ color: 'var(--text-muted)', margin: '0 auto 0.75rem auto', display: 'block' }} />
          <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-main)' }}>Ingen briefing har skapats än</h3>
          <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
            Klicka på knappen nedan för att göra en direkt analys av dina aktiva nyhetsflöden från det senaste dygnet.
          </p>
          <button
            onClick={() => handleGenerate(false)}
            disabled={generating}
            style={{
              padding: '0.6rem 1.2rem',
              fontSize: '0.88rem',
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
        <>
          {/* Horisontell snabbväljare för rapporter (särskilt bekväm på mobil) */}
          {digests.length > 0 && (
            <div className="briefing-quick-tabs">
              {digests.map((d) => {
                const isSelected = d.id === selectedDigestId;
                const isMorning = isMorningReport(d);
                const accentColor = isMorning ? '#2563eb' : '#ea580c';
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDigestId(d.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.32rem 0.65rem',
                      borderRadius: '20px',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 700 : 500,
                      whiteSpace: 'nowrap',
                      border: `1px solid ${isSelected ? accentColor : 'var(--border-color)'}`,
                      backgroundColor: isSelected ? accentColor : 'var(--bg-card)',
                      color: isSelected ? '#ffffff' : 'var(--text-main)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.15)' : 'none'
                    }}
                  >
                    <Sparkles size={11} style={{ opacity: isSelected ? 1 : 0.7 }} />
                    <span>{formatDigestDate(d.created_at)}</span>
                    <span style={{ opacity: isSelected ? 0.9 : 0.6, fontSize: '0.72rem' }}>
                      ({isMorning ? 'Morgon' : 'Kväll'})
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="briefing-view-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '1rem', alignItems: 'start' }}>
            {/* Huvudområde: Vald rapport formaterad som ett snyggt artikelkort */}
            <div>
              {selectedDigest ? (
                <article 
                  className="feed-card card-modern" 
                  style={{ 
                    borderLeft: `4px solid ${isMorningReport(selectedDigest) ? '#2563eb' : '#ea580c'}`,
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 14px -2px rgba(0, 0, 0, 0.06)',
                    cursor: 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%'
                  }}
                >
                  {/* Modern Topp-Bar */}
                  <div 
                    className="feed-card-topbar topbar-modern"
                    style={{
                      background: isMorningReport(selectedDigest)
                        ? 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)' 
                        : 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.28rem 0.6rem',
                      minHeight: '30px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                      <span className="modern-time-pill" title={`Skapad: ${formatDigestDate(selectedDigest.created_at)}`}>
                        Publ: {formatDigestDate(selectedDigest.created_at)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem' }}>
                        <Sparkles size={12} />
                        <span>{isMorningReport(selectedDigest) ? 'Morgonrapport' : 'Kvällsrapport'}</span>
                      </div>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.2rem', 
                        padding: '0.1rem 0.35rem', 
                        borderRadius: '4px', 
                        fontSize: '0.68rem', 
                        fontWeight: 600, 
                        backgroundColor: 'rgba(0, 0, 0, 0.25)', 
                        color: 'rgba(255, 255, 255, 0.95)' 
                      }}>
                        {selectedDigest.digest_type === 'ai_generated' ? 'AI-genererad' : 'Regelbaserad'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <button
                        onClick={toggleSpeech}
                        title={isPlayingAudio ? 'Stoppa uppläsning' : 'Lyssna på rapporten'}
                        className="modern-time-pill"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          backgroundColor: isPlayingAudio ? '#ef4444' : 'rgba(0, 0, 0, 0.28)'
                        }}
                      >
                        {isPlayingAudio ? <VolumeX size={12} /> : <Volume2 size={12} />}
                        <span>{isPlayingAudio ? 'Stoppa' : 'Lyssna'}</span>
                      </button>

                      <button
                        onClick={handleCopy}
                        title="Kopiera rapport"
                        className="modern-time-pill"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          backgroundColor: isCopied ? '#10b981' : 'rgba(0, 0, 0, 0.28)'
                        }}
                      >
                        {isCopied ? <Check size={12} /> : <Copy size={12} />}
                        <span>{isCopied ? 'Kopierad' : 'Kopiera'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Kortinnehåll */}
                  <div className="feed-card-content" style={{ padding: '0.6rem 0.75rem' }}>
                    <h2 style={{ 
                      margin: '0.15rem 0 0.6rem 0', 
                      fontSize: '1.15rem', 
                      fontWeight: 700, 
                      color: 'var(--text-main)', 
                      lineHeight: 1.35 
                    }}>
                      {formatReportTitle(selectedDigest.title)}
                    </h2>

                    {/* Insjunken AI-ruta, exakt som på artikelkorten */}
                    <div className="ai-summary-well" style={{ padding: '0.65rem 0.8rem', margin: '0.25rem 0 0.75rem 0' }}>
                      <div style={{ color: 'var(--text-main)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                        {renderBriefingMarkdown(selectedDigest.content)}
                      </div>
                    </div>

                    {/* Berörda källor och händelser */}
                    {selectedDigest.articles && selectedDigest.articles.length > 0 && (
                      <div style={{ marginTop: '0.75rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.65rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>
                          Berörda källor och händelser ({selectedDigest.articles.length}):
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.4rem' }}>
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
                                gap: '0.4rem',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                backgroundColor: 'var(--bg-app)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-main)',
                                textDecoration: 'none',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = isMorningReport(selectedDigest) ? '#3b82f6' : '#ea580c'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            >
                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <span style={{ color: isMorningReport(selectedDigest) ? '#2563eb' : '#ea580c', fontWeight: 600, display: 'block', fontSize: '0.7rem' }}>
                                  {art.source_title}
                                </span>
                                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {decodeHtmlEntities(art.title)}
                                </span>
                              </div>
                              <ExternalLink size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Nedre knapprad */}
                  <div 
                    className="feed-card-bottombar bottombar-modern"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.35rem 0.65rem',
                      borderTop: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card-hover, rgba(0,0,0,0.02))'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        onClick={toggleSpeech}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          backgroundColor: isPlayingAudio ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-card)',
                          color: isPlayingAudio ? '#ef4444' : 'var(--text-main)',
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer'
                        }}
                      >
                        {isPlayingAudio ? <VolumeX size={13} /> : <Volume2 size={13} />}
                        <span>{isPlayingAudio ? 'Stoppa' : 'Lyssna'}</span>
                      </button>

                      <button
                        onClick={handleCopy}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 500,
                          backgroundColor: isCopied ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                          color: isCopied ? '#10b981' : 'var(--text-main)',
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer'
                        }}
                      >
                        {isCopied ? <Check size={13} /> : <Copy size={13} />}
                        <span>{isCopied ? 'Kopierad!' : 'Kopiera'}</span>
                      </button>
                    </div>

                    <button
                      onClick={handleShare}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer'
                      }}
                    >
                      <Share2 size={13} />
                      <span>Dela</span>
                    </button>
                  </div>
                </article>
              ) : null}
            </div>

            {/* Högerpanel: Historik och tidigare rapporter (visas endast på desktop) */}
            <div className="briefing-desktop-sidebar" style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1rem',
              position: 'sticky',
              top: '1.5rem',
              maxHeight: 'calc(100vh - 3rem)',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Tidigare Briefings
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {digests.length} st
                </span>
              </div>

              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '0.2rem' }}>
                {digests.map((d) => {
                  const isSelected = d.id === selectedDigestId;
                  const isMorning = isMorningReport(d);
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDigestId(d.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        border: `1px solid ${isSelected ? (isMorning ? '#2563eb' : '#ea580c') : 'var(--border-color)'}`,
                        backgroundColor: isSelected ? (isMorning ? 'rgba(37, 99, 235, 0.08)' : 'rgba(234, 88, 12, 0.08)') : 'transparent',
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
                        <div style={{ fontSize: '0.82rem', fontWeight: isSelected ? 700 : 600, color: isSelected ? (isMorning ? '#2563eb' : '#ea580c') : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatReportTitle(d.title)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {formatDigestDate(d.created_at)} • {(d.articles || []).length || (d.article_ids || []).length} källor
                        </div>
                      </div>
                      <ChevronRight size={14} style={{ color: isSelected ? (isMorning ? '#2563eb' : '#ea580c') : 'var(--text-muted)', marginLeft: '0.35rem', flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BriefingView;
