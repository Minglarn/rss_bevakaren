import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Sparkles, 
  RotateCcw, 
  ExternalLink, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  Rss, 
  Calendar, 
  Flame, 
  AlertCircle,
  MessageSquare,
  Tag,
  ArrowRight
} from 'lucide-react';
import api from '../api';
import { useAiChat } from '../context/AiChatContext';

const CATEGORY_PROMPTS = [
  {
    category: "Senaste 24h",
    title: "Topp 5 nyheter",
    prompt: "Ge mig en sammanfattning och topplista över de viktigaste händelserna senaste dygnet."
  },
  {
    category: "Blåljus",
    title: "Olyckor & Larm",
    prompt: "Vilka blåljushändelser, olyckor eller utryckningar har rapporterats senaste dygnet?"
  },
  {
    category: "Brott",
    title: "Vapen & Skottlossning",
    prompt: "Hitta alla händelser kopplade till skottlossning, vapenbrott eller grova incidenter bland artiklarna."
  },
  {
    category: "Ekonomi",
    title: "Ekonomi & Börs",
    prompt: "Vad är den senaste utvecklingen kring ekonomi, räntan och företagsnyheter?"
  },
  {
    category: "Teknik",
    title: "Teknik & AI",
    prompt: "Vilka är de viktigaste nyheterna inom teknik, AI och hårdvara bland mina flöden?"
  },
  {
    category: "Politik",
    title: "Politik & Beslut",
    prompt: "Sammanfatta de senaste politiska utspelen, regeringsbesluten och samhällsdebatten."
  },
  {
    category: "PRIO",
    title: "Dagens PRIO-larm",
    prompt: "Vilka artiklar har klassificerats som högprioriterade (PRIO) händelser idag?"
  },
  {
    category: "Lokalt",
    title: "Lokala nyheter",
    prompt: "Vilka lokala händelser, kommunala beslut eller vägavstängningar finns rapporterade?"
  },
  {
    category: "Motor",
    title: "Motor & Elbilar",
    prompt: "Vad rapporteras om bilar, fordonsregler, skatter eller elbilar i flödena?"
  },
  {
    category: "Utrikes",
    title: "Världsnyheter",
    prompt: "Ge en överblick av de största utrikeshändelserna och internationella nyheterna just nu."
  },
  {
    category: "Inrikes",
    title: "Inrikes i Sverige",
    prompt: "Vilka är de mest uppmärksammade inrikesnyheterna i Sverige idag?"
  },
  {
    category: "Vetenskap",
    title: "Forskning & Hälsa",
    prompt: "Finns det några nyheter eller framsteg inom vetenskap, hälsa eller medicin?"
  }
];

// Funktion för att välja relevanta följdfrågor efter varje AI-svar
const getSuggestedFollowups = (msgCount) => {
  const startIndex = (msgCount * 3) % (CATEGORY_PROMPTS.length - 3);
  return CATEGORY_PROMPTS.slice(startIndex, startIndex + 3);
};

export default function AiChat() {
  const {
    messages,
    isLoading,
    activeModel,
    aiHealthy,
    sendMessage,
    clearMessages
  } = useAiChat();

  const [inputMessage, setInputMessage] = useState('');
  const [expandedSources, setExpandedSources] = useState({});

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Automatisk scroll till senaste meddelandet
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Automatisk justering av textfältets höjd
  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  const handleClearChat = () => {
    clearMessages();
    setExpandedSources({});
  };

  const toggleSources = (msgIndex) => {
    setExpandedSources(prev => ({
      ...prev,
      [msgIndex]: !prev[msgIndex]
    }));
  };

  const handleSendMessage = (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    sendMessage(query);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Enkel och säker formatering av AI-svar med stöd för stycken, punktlistor och fetstil
  const renderFormattedText = (text) => {
    if (!text) return null;
    const paragraphs = text.split('\n');
    return paragraphs.map((para, pIdx) => {
      const trimmed = para.trim();
      if (!trimmed) {
        return <div key={pIdx} style={{ height: '0.5rem' }} />;
      }

      // Punktlista
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)) {
        const bulletText = trimmed.replace(/^(\*|-|\d+\.)\s*/, '');
        return (
          <div key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', marginBottom: '0.35rem', paddingLeft: '0.5rem' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>•</span>
            <span>{renderInlineFormatting(bulletText)}</span>
          </div>
        );
      }

      return (
        <p key={pIdx} style={{ margin: '0 0 0.6rem 0', lineHeight: '1.6' }}>
          {renderInlineFormatting(trimmed)}
        </p>
      );
    });
  };

  const renderInlineFormatting = (str) => {
    // Ersätt **fetstil**
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 60px)',
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '1rem',
      boxSizing: 'border-box'
    }}>
      {/* Toppsektion / Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '0.85rem',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            color: 'var(--primary)'
          }}>
            <MessageSquare size={18} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
              AI Nyhetschatt
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{
                display: 'inline-block',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: aiHealthy ? '#22c55e' : '#eab308'
              }} />
              <span>{activeModel ? `Modell: ${activeModel}` : 'Lokal AI redo'}</span>
            </div>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            title="Rensa konversationen och börja om"
          >
            <RotateCcw size={13} /> Rensa tråd
          </button>
        )}
      </div>

      {/* Meddelandeområde */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingRight: '0.4rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        {messages.length === 0 ? (
          /* Startskärm / Hero */
          <div style={{
            margin: 'auto 0',
            textAlign: 'center',
            padding: '2rem 1rem'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              color: 'var(--primary)',
              marginBottom: '1rem'
            }}>
              <Sparkles size={28} />
            </div>
            <h2 style={{ fontSize: '1.35rem', margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
              Vad vill du veta om dina nyheter?
            </h2>
            <p style={{ maxWidth: '540px', margin: '0 auto 2rem auto', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Ställ frågor på vanlig svenska till dina sparade RSS-artiklar. Modellen sammanställer händelser, räknar incidenter och källhänvisar direkt till artiklarna.
            </p>

            {/* Förslags-chips */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.75rem',
              maxWidth: '750px',
              margin: '0 auto',
              textAlign: 'left'
            }}>
              {CATEGORY_PROMPTS.slice(0, 6).map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.prompt)}
                  style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)' }}>
                      {item.title}
                    </div>
                    <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      {item.category}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    {item.prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Meddelandelista */
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  width: '100%'
                }}
              >
                <div style={{
                  maxWidth: isUser ? '75%' : '88%',
                  backgroundColor: isUser ? 'var(--primary)' : 'var(--bg-card)',
                  color: isUser ? '#ffffff' : 'var(--text-main)',
                  border: isUser ? 'none' : '1px solid var(--border-color)',
                  borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '0.9rem 1.15rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  position: 'relative'
                }}>
                  {/* Avsändarhuvud för assistenten */}
                  {!isUser && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.75rem',
                      color: 'var(--primary)',
                      fontWeight: 600,
                      marginBottom: '0.5rem'
                    }}>
                      <Sparkles size={13} />
                      <span>{msg.model || 'AI Assistent'}</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 'auto' }}>
                        {msg.timestamp}
                      </span>
                    </div>
                  )}

                  {/* Progressbar under GPU prompt processing */}
                  {!isUser && msg.isStreaming && !msg.content && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: '260px', maxWidth: '420px', padding: '0.2rem 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Loader2 size={14} className="spin" style={{ color: 'var(--primary)' }} />
                          {msg.progress !== null && msg.progress > 0 
                            ? "Bearbetar artikelunderlag i LM Studio..." 
                            : "Hämtar och matchar relevanta artiklar..."}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
                          {msg.progress || 0}%
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '6px',
                        backgroundColor: 'rgba(0,0,0,0.08)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.max(msg.progress || 0, 4)}%`,
                          backgroundColor: 'var(--primary)',
                          borderRadius: '4px',
                          transition: 'width 0.25s ease-out',
                          boxShadow: '0 0 8px rgba(37, 99, 235, 0.4)'
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Meddelandetext */}
                  {(!msg.isStreaming || msg.content) && (
                    <div style={{ fontSize: '0.92rem' }}>
                      {isUser ? (
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                          {msg.content}
                        </div>
                      ) : (
                        <div>
                          {renderFormattedText(msg.content)}
                          {msg.isStreaming && (
                            <span 
                              style={{ 
                                display: 'inline-block', 
                                width: '7px', 
                                height: '14px', 
                                marginLeft: '4px', 
                                backgroundColor: 'var(--primary)', 
                                verticalAlign: 'middle',
                                animation: 'pulse 1s infinite'
                              }} 
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Källor / Citations */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div style={{
                      marginTop: '0.85rem',
                      paddingTop: '0.65rem',
                      borderTop: '1px solid var(--border-color)'
                    }}>
                      <button
                        onClick={() => toggleSources(idx)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        <FileText size={13} />
                        <span>Källor ({msg.sources.length} artiklar)</span>
                        {expandedSources[idx] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      {expandedSources[idx] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            marginTop: '0.6rem'
                          }}
                        >
                          {msg.sources.map((src, sIdx) => (
                            <div
                              key={sIdx}
                              style={{
                                padding: '0.5rem 0.75rem',
                                backgroundColor: 'var(--bg-app)',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.8rem'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '0.2rem' }}>
                                <Rss size={12} />
                                <span>{src.source_name}</span>
                                {src.published_at && (
                                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.72rem', marginLeft: 'auto' }}>
                                    {src.published_at}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                                {src.title}
                              </div>
                              {src.summary && (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: '1.4', marginBottom: '0.35rem' }}>
                                  {src.summary.slice(0, 180)}...
                                </div>
                              )}
                              {src.link && (
                                <a
                                  href={src.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    color: 'var(--primary)',
                                    fontSize: '0.72rem',
                                    textDecoration: 'none',
                                    fontWeight: 500
                                  }}
                                >
                                  <span>Läs originalartikel</span>
                                  <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginRight: '0.25rem' }}>
                    {msg.timestamp}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Förslag på följdfrågor efter varje svar */}
        {messages.length > 0 && !isLoading && messages[messages.length - 1].role === 'assistant' && (
          <motion.div
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: '0.4rem 0.2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem'
            }}
          >
            <div style={{
              fontSize: '0.74rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}>
              <Sparkles size={12} style={{ color: 'var(--primary)' }} />
              <span>Förslag på följdfrågor:</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {messages[messages.length - 1].follow_ups && messages[messages.length - 1].follow_ups.length > 0 ? (
                messages[messages.length - 1].follow_ups.map((qText, fIdx) => (
                  <button
                    key={fIdx}
                    onClick={() => handleSendMessage(qText)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.38rem 0.85rem',
                      borderRadius: '16px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                    }}
                  >
                    <ArrowRight size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span>{qText}</span>
                  </button>
                ))
              ) : (
                getSuggestedFollowups(messages.length).map((item, fIdx) => (
                  <button
                    key={fIdx}
                    onClick={() => handleSendMessage(item.prompt)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '16px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary)' }}>
                      [{item.category}]
                    </span>
                    <span>{item.title}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* Fallback laddningsindikator om assistentbubbla inte skapats */}
        {isLoading && (!messages.length || messages[messages.length - 1].role !== 'assistant') && (
          <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px 16px 16px 4px',
              padding: '0.85rem 1.15rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              color: 'var(--text-muted)',
              fontSize: '0.85rem'
            }}>
              <Loader2 size={16} className="spin" style={{ color: 'var(--primary)' }} />
              <span>Initierar sökning och formulerar svar...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Inmatningsfält längst ner med rullbar kategori-rad */}
      <div style={{
        paddingTop: '0.65rem',
        borderTop: '1px solid var(--border-color)',
        marginTop: '0.5rem'
      }}>
        {/* Horisontell rullbar rad med kategorier för snabbfrågor */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          overflowX: 'auto',
          paddingBottom: '0.55rem',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0, paddingRight: '0.2rem' }}>
            Kategorier:
          </span>
          {CATEGORY_PROMPTS.map((item, cIdx) => (
            <button
              key={cIdx}
              onClick={() => handleSendMessage(item.prompt)}
              disabled={isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.25rem 0.65rem',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.color = 'var(--primary)';
                  e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.04)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.backgroundColor = 'var(--bg-card)';
              }}
              title={item.prompt}
            >
              <Tag size={11} style={{ color: 'var(--primary)' }} />
              <span>{item.category}: {item.title}</span>
            </button>
          ))}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '0.5rem 0.75rem',
          gap: '0.5rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
        }}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ställ en fråga om dina artiklar... (Enter för att skicka, Shift+Enter för ny rad)"
            disabled={isLoading}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              resize: 'none',
              color: 'var(--text-main)',
              fontSize: '0.92rem',
              lineHeight: '1.45',
              maxHeight: '140px',
              padding: '0.25rem 0',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: inputMessage.trim() && !isLoading ? 'var(--primary)' : 'var(--border-color)',
              color: '#ffffff',
              border: 'none',
              cursor: inputMessage.trim() && !isLoading ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.15s',
              flexShrink: 0
            }}
            title="Skicka fråga"
          >
            {isLoading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
          Svar genereras lokalt av LM Studio baserat på dina sparade RSS-artiklar.
        </div>
      </div>
    </div>
  );
}
