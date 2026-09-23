import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles, Rss } from 'lucide-react';

const DashboardLoading = ({ activeFlowLayout = 'ultracompact' }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setStage(1);
    }, 1500);

    const timer2 = setTimeout(() => {
      setStage(2);
    }, 3200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const isUltracompact = activeFlowLayout === 'ultracompact';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      style={{
        width: '100%',
        maxWidth: '780px',
        margin: '1.25rem auto 3rem auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}
    >
      {/* Centralt laddningskort med dynamisk förloppsindikator */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          padding: '2.25rem 1.5rem',
          textAlign: 'center',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.05)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Shimmer-strimma i överkant */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            overflow: 'hidden'
          }}
        >
          <div
            className="skeleton-indeterminate-bar"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #f97316)',
              borderRadius: '3px'
            }}
          />
        </div>

        {/* Pulserande ikoncirkel */}
        <div
          style={{
            position: 'relative',
            width: '60px',
            height: '60px',
            margin: '0 auto 1.15rem auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              animation: 'skeletonPulse 2s ease-in-out infinite'
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: '-4px',
              borderRadius: '50%',
              border: '2px solid rgba(59, 130, 246, 0.25)',
              borderTopColor: 'var(--primary)',
              animation: 'spin 1.8s linear infinite'
            }}
          />
          {stage === 2 ? (
            <Sparkles size={24} style={{ color: '#f97316', position: 'relative', zIndex: 1 }} />
          ) : stage === 1 ? (
            <Rss size={24} style={{ color: 'var(--primary)', position: 'relative', zIndex: 1 }} />
          ) : (
            <Loader2 size={24} className="spin" style={{ color: 'var(--primary)', position: 'relative', zIndex: 1 }} />
          )}
        </div>

        {/* Mjuk animering mellan laddningsstegen */}
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <h3
              style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                margin: '0 0 0.35rem 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem'
              }}
            >
              {stage === 2 ? (
                <>
                  <span>Snart klar</span>
                  <span className="loading-dots-bounce">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                </>
              ) : stage === 1 ? (
                'Synkar artiklar & analyser...'
              ) : (
                'Laddar nyheter...'
              )}
            </h3>
            <p
              style={{
                fontSize: '0.88rem',
                color: 'var(--text-muted)',
                margin: 0,
                lineHeight: 1.45
              }}
            >
              {stage === 2
                ? 'Färdigställer sortering och klusterhändelser...'
                : stage === 1
                ? 'Hämtar de senaste uppdateringarna från dina källor...'
                : 'Ansluter till RSS-bevakaren och förbereder flödet...'}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Förhandsvisnings-skelett som matchar valt artikel-läge */}
      {isUltracompact ? (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '0.4rem 0.85rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
          }}
        >
          {[1, 2, 3, 4].map(idx => (
            <div
              key={idx}
              className="skeleton-shimmer"
              style={{
                padding: '0.65rem 0.25rem',
                borderBottom: idx === 4 ? 'none' : '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '0.85rem'
              }}
            >
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {/* Rubrik */}
                <div
                  style={{
                    height: '16px',
                    width: idx === 1 ? '78%' : idx === 2 ? '86%' : idx === 3 ? '68%' : '82%',
                    backgroundColor: 'var(--border-color)',
                    borderRadius: '4px',
                    opacity: 0.65
                  }}
                />
                {/* Kort notis */}
                <div
                  style={{
                    height: '11px',
                    width: idx === 1 ? '92%' : idx === 2 ? '84%' : '89%',
                    backgroundColor: 'var(--border-color)',
                    borderRadius: '4px',
                    opacity: 0.4
                  }}
                />
                {/* Källnamn och tid */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.15rem' }}>
                  <div style={{ height: '10px', width: '55px', backgroundColor: 'var(--border-color)', borderRadius: '3px', opacity: 0.35 }} />
                  <div style={{ height: '10px', width: '45px', backgroundColor: 'var(--border-color)', borderRadius: '3px', opacity: 0.35 }} />
                </div>
              </div>
              {/* Liten thumbnail */}
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--border-color)',
                  opacity: 0.45,
                  flexShrink: 0
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%' }}>
          {[1, 2, 3].map(idx => (
            <div
              key={idx}
              className="skeleton-shimmer"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--border-color)', opacity: 0.5 }} />
                <div style={{ width: '80px', height: '12px', borderRadius: '4px', backgroundColor: 'var(--border-color)', opacity: 0.4 }} />
                <div style={{ width: '45px', height: '12px', borderRadius: '4px', backgroundColor: 'var(--border-color)', opacity: 0.3 }} />
              </div>
              <div
                style={{
                  height: '20px',
                  width: idx === 1 ? '70%' : idx === 2 ? '85%' : '60%',
                  backgroundColor: 'var(--border-color)',
                  borderRadius: '4px',
                  opacity: 0.7
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ height: '13px', width: '96%', backgroundColor: 'var(--border-color)', borderRadius: '4px', opacity: 0.4 }} />
                <div style={{ height: '13px', width: '88%', backgroundColor: 'var(--border-color)', borderRadius: '4px', opacity: 0.4 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default DashboardLoading;
