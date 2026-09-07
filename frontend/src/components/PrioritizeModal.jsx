import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, X, Tag, Check, Loader2, Sparkles, BellRing } from 'lucide-react';
import api from '../api';

const STOP_WORDS = new Set([
  'och', 'i', 'att', 'det', 'som', 'en', 'på', 'är', 'av', 'för', 'med', 'till', 'den',
  'har', 'de', 'inte', 'om', 'ett', 'men', 'var', 'jag', 'ska', 'får', 'kan', 'man',
  'hur', 'så', 'här', 'efter', 'mot', 'vid', 'under', 'nya', 'mer', 'bli', 'blev',
  'just', 'nu', 'vill', 'ska', 'vara', 'sig', 'eller', 'vi', 'du', 'han', 'hon',
  'där', 'då', 'in', 'ut', 'upp', 'ner', 'över'
]);

function extractKeywordsFromTitle(title) {
  if (!title) return [];
  const suggestions = [];
  const colonParts = title.split(':');
  if (colonParts.length > 1 && colonParts[0].trim().length >= 3 && colonParts[0].trim().length <= 25) {
    suggestions.push(colonParts[0].trim());
  }

  const words = title
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()));

  for (const w of words) {
    const formatted = w.charAt(0).toUpperCase() + w.slice(1);
    if (!suggestions.some(s => s.toLowerCase() === formatted.toLowerCase())) {
      suggestions.push(formatted);
    }
  }

  return suggestions.slice(0, 5);
}

const PrioritizeModal = ({ isOpen, onClose, article, onPrioritized }) => {
  const [topic, setTopic] = useState('');
  const [addAsKeyword, setAddAsKeyword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestedTags, setSuggestedTags] = useState([]);

  useEffect(() => {
    if (article) {
      setError(null);
      // Försök extrahera taggar eller nyckelord från artikeln
      let tags = [];
      if (article.tags) {
        try {
          const parsed = typeof article.tags === 'string' ? JSON.parse(article.tags) : article.tags;
          if (Array.isArray(parsed)) tags = parsed;
        } catch (e) {
          // ignore
        }
      }
      if (tags.length === 0 && article.categories && Array.isArray(article.categories)) {
        tags = article.categories.filter(c => c && c.toLowerCase() !== 'alla' && c.toLowerCase() !== 'övrigt');
      }

      // Om varken taggar eller kategorier fanns, plocka smarta nyckelord ur rubriken
      if (tags.length === 0 && article.title) {
        tags = extractKeywordsFromTitle(article.title);
      }

      const validTags = tags.filter(t => typeof t === 'string' && t.trim().length > 1);
      setSuggestedTags(validTags);

      // Förifyll alltid fältet med det bästa förslaget
      if (validTags.length > 0) {
        setTopic(validTags[0]);
      } else if (article.source_title) {
        setTopic(article.source_title);
      } else {
        setTopic('');
      }
    }
  }, [article]);

  if (!isOpen || !article) return null;

  const handlePrioritize = async (saveTopic) => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        topic: saveTopic ? topic.trim() : null,
        add_as_keyword: saveTopic ? addAsKeyword : false
      };
      const res = await api.post(`/articles/${article.id}/prioritize`, payload);
      if (onPrioritized) {
        onPrioritized(article.id, res.data);
      }
      onClose();
    } catch (err) {
      console.error('Could not prioritize article:', err);
      setError('Could not update priority. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(249, 115, 22, 0.08), transparent)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                color: '#f97316',
                padding: '0.5rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Flame size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Prioritize in PRIO Feed
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Move event to your prioritized feed
                </p>
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
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Article preview */}
            <div style={{
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.85rem 1rem'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                {article.source_title}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500, lineHeight: 1.4 }}>
                {article.title}
              </div>
            </div>

            {/* Topic input */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                Topic or keyword to monitor in the future:
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Saab, Central Bank, Defense..."
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Field is automatically pre-filled with suggestions from the article. You can edit the text or click a suggestion below.
              </p>
            </div>

            {/* Suggestions from article */}
            {suggestedTags.length > 0 && (
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                  Suggestions from article (click to select):
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {suggestedTags.map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setTopic(t)}
                      style={{
                        background: topic.toLowerCase() === t.toLowerCase() ? 'rgba(249, 115, 22, 0.2)' : 'var(--bg-app)',
                        border: topic.toLowerCase() === t.toLowerCase() ? '1px solid #f97316' : '1px solid var(--border-color)',
                        color: topic.toLowerCase() === t.toLowerCase() ? '#f97316' : 'var(--text-muted)',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Tag size={11} />
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Checkbox for keyword list */}
            {topic.trim().length > 0 && (
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                cursor: 'pointer',
                fontSize: '0.85rem',
                color: 'var(--text-main)'
              }}>
                <input
                  type="checkbox"
                  checked={addAsKeyword}
                  onChange={(e) => setAddAsKeyword(e.target.checked)}
                  style={{
                    accentColor: '#f97316',
                    width: '16px',
                    height: '16px',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <BellRing size={14} style={{ color: '#f97316' }} />
                  Also add as an active keyword in your monitor list
                </span>
              </label>
            )}

            {error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '0.6rem 0.8rem',
                borderRadius: '6px',
                fontSize: '0.8rem'
              }}>
                {error}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: 'var(--bg-app)'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                padding: '0.55rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handlePrioritize(false)}
              disabled={loading}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                padding: '0.55rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Only this article
            </button>

            <button
              type="button"
              onClick={() => handlePrioritize(true)}
              disabled={loading || !topic.trim()}
              style={{
                backgroundColor: '#f97316',
                border: 'none',
                color: '#ffffff',
                padding: '0.55rem 1.1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: (!loading && topic.trim()) ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                opacity: (!loading && topic.trim()) ? 1 : 0.6
              }}
            >
              {loading ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Flame size={16} />
              )}
              Prioritize & monitor topic
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PrioritizeModal;
