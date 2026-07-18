import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, RefreshCw, Rss, MapPin, ChevronRight } from 'lucide-react';
import api from '../api';

const Dashboard = () => {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFeeds = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard-feeds');
      setFeeds(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeeds();
  }, []);

  // Helper to format date
  const formatTime = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };

  // Assign a color based on source or index
  const getBorderColor = (index) => {
    const colors = ['#2563eb', '#e11d48', '#0ea5e9', '#16a34a', '#d97706'];
    return colors[index % colors.length];
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
          IDAG
        </h1>
        <button 
          onClick={fetchFeeds} 
          disabled={loading}
          className="refresh-btn"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 600,
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
        >
          <RefreshCw size={16} className={loading ? "spin" : ""} />
          Uppdatera
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Laddar nyheter...</p>
      ) : feeds.length === 0 ? (
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Inga nyheter hittades. Kanske behöver du lägga till flöden i RSS-hanteraren?</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {feeds.map((item, index) => {
            const color = getBorderColor(index);
            return (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  color: 'inherit'
                }}
                onClick={() => window.open(item.link, '_blank')}
              >
                {/* Left colored bar */}
                <div style={{
                  backgroundColor: color,
                  width: '80px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '1.5rem 0',
                  color: 'white',
                  flexShrink: 0
                }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {formatTime(item.published)}
                  </div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', letterSpacing: '1px' }}>
                    IDAG
                  </div>
                  <MapPin size={24} style={{ marginTop: 'auto', opacity: 0.7 }} />
                </div>

                {/* Right content area */}
                <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Tags */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ 
                      backgroundColor: 'rgba(37, 99, 235, 0.1)', 
                      color: 'var(--primary)', 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: '20px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontWeight: 500
                    }}>
                      <MapPin size={12} /> {item.source_title}
                    </div>
                    {item.title.split(' ').slice(0, 2).map((word, wIdx) => (
                      <div key={wIdx} style={{ 
                        backgroundColor: 'var(--bg-app)', 
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-muted)', 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '20px',
                        fontSize: '0.85rem'
                      }}>
                        {word.replace(/[^a-zA-ZåäöÅÄÖ]/g, '')}
                      </div>
                    ))}
                  </div>

                  {/* Title / Content */}
                  <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 400, lineHeight: '1.5' }}>
                    {item.title}
                  </h3>

                  {/* Footer */}
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                    <span style={{ backgroundColor: color, color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {formatTime(item.published)}
                    </span>
                    Läs hela notisen <ChevronRight size={16} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
