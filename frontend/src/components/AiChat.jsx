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
  MessageSquare
} from 'lucide-react';
import api from '../api';

const PROMPT_SUGGESTIONS = [
  {
    title: "Senaste dygnet",
    prompt: "Sammanfatta det viktigaste som har hänt det senaste dygnet."
  },
  {
    title: "Olyckor & trafik",
    prompt: "Vilka olyckor eller trafikstörningar har rapporterats igår och var inträffade de?"
  },
  {
    title: "Vapenbrott & skottlossning",
    prompt: "Hitta alla händelser kopplade till skottlossning eller vapenbrott bland de sparade artiklarna."
  },
  {
    title: "Ekonomi & ränta",
    prompt: "Vad är den senaste utvecklingen kring ekonomi, räntan och företagsnyheter?"
  }
];

export default function AiChat() {
  const [messages, setMessages] = useState(() => {
    const saved = sessionStorage.getItem('rss_ai_chat_messages');
    return saved ? JSON.parse(saved) : [];
  });
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState({});
  const [activeModel, setActiveModel] = useState('');
  const [aiHealthy, setAiHealthy] = useState(true);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Spara meddelanden i sessionStorage så att användaren kan navigera runt utan att tappa tråden
  useEffect(() => {
    try {
      sessionStorage.setItem('rss_ai_chat_messages', JSON.stringify(messages));
    } catch (e) {
      // Ignorera kvotfel
    }
  }, [messages]);

  // Hämta AI-modellstatus från konfigurationen
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const res = await api.get('/ai/config');
        if (res.data) {
          setActiveModel(res.data.lm_studio_model || 'Standardmodell');
          setAiHealthy(res.data.is_healthy);
        }
      } catch (err) {
        setAiHealthy(false);
      }
    };
    checkConfig();
  }, []);

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
    setMessages([]);
    setExpandedSources({});
    sessionStorage.removeItem('rss_ai_chat_messages');
  };

  const toggleSources = (msgIndex) => {
    setExpandedSources(prev => ({
      ...prev,
      [msgIndex]: !prev[msgIndex]
    }));
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMessage = {
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      // Skicka meddelandet samt tidigare meddelandehistorik till RAG-endpointen
      const historyPayload = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.post('/ai/chat', {
        message: query,
        history: historyPayload
      });

      const assistantMessage = {
        role: 'assistant',
        content: res.data.reply || 'Inget svar kunde genereras.',
        sources: res.data.sources || [],
        model: res.data.model || activeModel || 'Lokal AI',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages([...newMessages, assistantMessage]);
      if (res.data.model) {
        setActiveModel(res.data.model);
      }
    } catch (err) {
      const errorMessage = {
        role: 'assistant',
        content: 'Kunde inte kommunicera med AI-tjänsten. Kontrollera att LM Studio körs och är tillgänglig på det lokala nätverket.',
        sources: [],
        model: 'Fel',
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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
              {PROMPT_SUGGESTIONS.map((item, idx) => (
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
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.25rem' }}>
                    {item.title}
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

                  {/* Meddelandetext */}
                  <div style={{ fontSize: '0.92rem' }}>
                    {isUser ? (
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                        {msg.content}
                      </div>
                    ) : (
                      renderFormattedText(msg.content)
                    )}
                  </div>

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

        {/* Laddningsindikator */}
        {isLoading && (
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
              <span>Söker igenom artiklar och formulerar svar...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Inmatningsfält längst ner */}
      <div style={{
        paddingTop: '0.85rem',
        borderTop: '1px solid var(--border-color)',
        marginTop: '0.75rem'
      }}>
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
