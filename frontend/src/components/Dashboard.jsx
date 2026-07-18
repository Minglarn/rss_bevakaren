import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, RefreshCw, Rss } from 'lucide-react';
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

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Rss /> Dashboard
        </h1>
        <button 
          onClick={fetchFeeds} 
          disabled={loading}
          className="refresh-btn"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {feeds.map((item, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                {item.source_title}
              </div>
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1.1rem', lineHeight: '1.4' }}>
                {item.title}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', flexGrow: 1, marginBottom: '1.5rem' }} dangerouslySetInnerHTML={{ __html: item.summary?.substring(0, 150) + '...' }}></p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(item.published).toLocaleDateString('sv-SE')}
                </span>
                <a 
                  href={item.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    color: 'var(--primary)',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    fontWeight: 500
                  }}
                >
                  Läs mer <ExternalLink size={14} />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
