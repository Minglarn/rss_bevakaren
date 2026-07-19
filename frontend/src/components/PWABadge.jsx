import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export default function PWABadge() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '5rem',
      right: '1.5rem',
      zIndex: 50,
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
      borderRadius: '12px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      maxWidth: '320px',
      animation: 'slideUp 0.3s ease-out forwards'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h3 style={{ color: 'var(--text-main)', fontWeight: 600, margin: '0 0 0.25rem 0', fontSize: '1rem' }}>
            Ny uppdatering tillgänglig!
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
            Klicka på ladda om för att uppdatera appen till den senaste versionen.
          </p>
        </div>
        <button 
          onClick={close} 
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: 'var(--text-muted)', 
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%'
          }} 
          aria-label="Stäng"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <X size={18} />
        </button>
      </div>
      <button
        style={{
          backgroundColor: 'var(--primary)',
          color: 'white',
          border: 'none',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          transition: 'background-color 0.2s',
          width: '100%'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
        onClick={() => updateServiceWorker(true)}
      >
        <RefreshCw size={16} />
        <span>Ladda om appen</span>
      </button>
    </div>
  );
}
