import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, MessageSquare, Send, Copy, Check, X, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';

const ShareModal = ({ item, onClose }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const getCleanSummary = (text) => {
    if (!text) return '';
    return text.replace(/<[^>]+>/g, '').trim();
  };

  const title = item.title || 'Händelse';
  const summaryText = getCleanSummary(item.summary);
  const url = item.link || '';
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const getFormattedMessage = () => {
    if (summaryText) {
      return `${title}\n\n${summaryText}\n\nLänk: ${url}`;
    }
    return `${title}\n\nLänk: ${url}`;
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: title,
        text: summaryText ? `${title}\n\n${summaryText}` : title,
        url: url
      });
      onClose();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Kunde inte dela via systemdelning:', err);
      }
    }
  };

  const handleWhatsApp = () => {
    const text = getFormattedMessage();
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleSMS = () => {
    const text = getFormattedMessage();
    window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
    onClose();
  };

  const handleCopy = async () => {
    const text = getFormattedMessage();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Kopierat till urklipp!', {
        duration: 2500,
        style: {
          borderRadius: '8px',
          background: 'var(--bg-card)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-color)',
        }
      });
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Kunde inte kopiera till urklipp:', err);
      toast.error('Kunde inte kopiera');
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="share-modal-backdrop" 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}
      >
        <motion.div
          className="share-modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            width: '100%',
            maxWidth: '480px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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
                <Share2 size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Dela händelse</h3>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
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

          {/* Article preview snippet */}
          <div style={{
            padding: '1.25rem 1.5rem',
            background: 'var(--bg-app)',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '0.9rem'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              {item.source_title || 'Källa'}
            </div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem', lineHeight: '1.4' }}>
              {item.title}
            </div>
            {summaryText && (
              <div style={{
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                lineHeight: '1.4',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                marginBottom: '0.5rem'
              }}>
                {summaryText}
              </div>
            )}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              wordBreak: 'break-all'
            }}>
              <ExternalLink size={12} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
            </div>
          </div>

          {/* Actions List */}
          <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {canNativeShare && (
              <button
                onClick={handleNativeShare}
                className="share-action-btn share-action-system"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  padding: '0.85rem 1rem',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'opacity 0.2s'
                }}
              >
                <Share2 size={18} />
                <div style={{ flex: 1 }}>
                  <div>Dela via systemet</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.9 }}>Öppnar telefonens vanliga delningsmeny</div>
                </div>
              </button>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <button
                onClick={handleSMS}
                className="share-action-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 0.9rem',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <MessageSquare size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <span>SMS</span>
              </button>

              <button
                onClick={handleWhatsApp}
                className="share-action-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 0.9rem',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Send size={18} style={{ color: '#22c55e', flexShrink: 0 }} />
                <span>WhatsApp</span>
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="share-action-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                fontWeight: 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              {copied ? (
                <Check size={18} style={{ color: '#22c55e', flexShrink: 0 }} />
              ) : (
                <Copy size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div>{copied ? 'Kopierat!' : 'Kopiera text och länk'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>Placerar rubrik, text och länk i urklipp</div>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ShareModal;
