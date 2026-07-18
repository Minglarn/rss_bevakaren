import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, RefreshCw, Rss, MapPin, ChevronRight, Loader2, ArrowLeft } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';

const Dashboard = () => {
  const [allFeeds, setAllFeeds] = useState([]);
  const [displayedFeeds, setDisplayedFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;
  const observer = useRef();
  const [searchParams] = useSearchParams();
  const feedId = searchParams.get('feedId');
  
  const [expandedItems, setExpandedItems] = useState({});
  const [scrapedContents, setScrapedContents] = useState({});
  const [scrapingUrls, setScrapingUrls] = useState({});

  const fetchFeeds = async () => {
    setLoading(true);
    setPage(1);
    try {
      const url = feedId ? `/dashboard-feeds?feed_id=${feedId}` : '/dashboard-feeds';
      const res = await api.get(url);
      setAllFeeds(res.data);
      setDisplayedFeeds(res.data.slice(0, itemsPerPage));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeeds();
  }, [feedId]);

  // Infinite Scroll logic
  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && displayedFeeds.length < allFeeds.length) {
        const nextPage = page + 1;
        setPage(nextPage);
        setDisplayedFeeds(allFeeds.slice(0, nextPage * itemsPerPage));
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, displayedFeeds.length, allFeeds.length, page, allFeeds]);

  // Helper to format date
  const formatTime = (dateString) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (dateString) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'IDAG';
    const today = new Date();
    if (d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
      return 'IDAG';
    }
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

  const handleExpand = async (index, url) => {
    // Toggle expand
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }));
    
    // If expanding and content not scraped yet
    if (!expandedItems[index] && !scrapedContents[url]) {
      const feedItems = allFeeds.filter(f => f.link === url);
      const isScrapeEnabled = feedItems.length > 0 && feedItems[0].scrape_enabled !== false;
      
      if (isScrapeEnabled) {
        setScrapingUrls(prev => ({ ...prev, [url]: true }));
        try {
          const res = await api.get(`/scrape?url=${encodeURIComponent(url)}`);
          setScrapedContents(prev => ({ ...prev, [url]: res.data.content }));
        } catch (err) {
          console.error("Scrape error", err);
          setScrapedContents(prev => ({ ...prev, [url]: 'Det gick inte att ladda artikeln automatiskt. Läs mer på original-sidan.' }));
        } finally {
          setScrapingUrls(prev => ({ ...prev, [url]: false }));
        }
      } else {
        // Just use the local summary
        setScrapedContents(prev => ({ ...prev, [url]: feedItems[0]?.summary || 'Läs mer på original-sidan.' }));
      }
    }
  };

  // Assign a color based on source or index
  const getBorderColor = (index) => {
    const colors = ['#2563eb', '#e11d48', '#0ea5e9', '#16a34a', '#d97706'];
    return colors[index % colors.length];
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {feedId && (
            <Link to="/" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', textDecoration: 'none', backgroundColor: 'var(--bg-card)', padding: '0.5rem', borderRadius: '50%', border: '1px solid var(--border-color)' }} title="Visa alla flöden">
              <ArrowLeft size={20} />
            </Link>
          )}
          <h1 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
            {feedId && allFeeds.length > 0 ? allFeeds[0].source_title.toUpperCase() : 'IDAG'}
          </h1>
        </div>
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

      {loading && allFeeds.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Laddar nyheter...</p>
      ) : allFeeds.length === 0 ? (
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Inga nyheter hittades. Kanske behöver du lägga till flöden i RSS-hanteraren?</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {displayedFeeds.map((item, index) => {
            const color = getBorderColor(index);
            const isLast = index === displayedFeeds.length - 1;
            
            let showDivider = false;
            let dividerText = '';
            
            const currentD = new Date(item.published);
            if (!isNaN(currentD.getTime())) {
                if (index === 0) {
                    showDivider = true;
                } else {
                    const prevD = new Date(displayedFeeds[index - 1].published);
                    // Check if day changed
                    if (!isNaN(prevD.getTime()) && 
                       (currentD.getDate() !== prevD.getDate() || currentD.getMonth() !== prevD.getMonth() || currentD.getFullYear() !== prevD.getFullYear())) {
                        showDivider = true;
                    }
                }
                if (showDivider) {
                    let text = currentD.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
                    // Capitalize first letter
                    dividerText = text.charAt(0).toUpperCase() + text.slice(1);
                }
            }
            
            return (
              <React.Fragment key={index}>
                {showDivider && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    margin: '1.5rem 0 1rem 0'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '1.2rem' }}>
                      {dividerText}
                    </div>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                  </div>
                )}
                <motion.div 
                  ref={isLast ? lastElementRef : null}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  overflow: 'hidden',
                  textDecoration: 'none',
                  color: 'inherit'
                }}
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
                    {formatDateLabel(item.published)}
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
                    {item.categories && item.categories.map((cat, cIdx) => (
                      <div key={cIdx} style={{ 
                        backgroundColor: 'var(--bg-app)', 
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-muted)', 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '20px',
                        fontSize: '0.85rem'
                      }}>
                        {cat}
                      </div>
                    ))}
                  </div>

                  {/* Title / Content */}
                  <h3 
                    onClick={() => handleExpand(index, item.link)}
                    style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 400, lineHeight: '1.5', cursor: 'pointer' }}
                  >
                    {item.title}
                  </h3>
                  
                  {item.image_url && (
                    <div 
                      onClick={() => handleExpand(index, item.link)}
                      style={{ 
                        width: '100%', 
                        height: '200px', 
                        marginBottom: '1rem', 
                        borderRadius: '8px', 
                        overflow: 'hidden', 
                        cursor: 'pointer' 
                      }}
                    >
                      <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  
                  {/* Expanded Content */}
                  {expandedItems[index] && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-main)' }}
                    >
                      {scrapingUrls[item.link] ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                          <Loader2 className="spin" size={16} /> Hämtar artikeltext...
                        </div>
                      ) : (
                        <div style={{ whiteSpace: 'pre-line' }}>
                          {scrapedContents[item.link] || item.summary || 'Ingen ytterligare text kunde hittas.'}
                        </div>
                      )}
                      
                      <div style={{ marginTop: '1rem' }}>
                        <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                          <ExternalLink size={16} /> Läs på original-sidan
                        </a>
                      </div>
                    </motion.div>
                  )}

                  {/* Footer */}
                  <div 
                    onClick={() => handleExpand(index, item.link)}
                    style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <span style={{ backgroundColor: color, color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {formatTime(item.published)}
                    </span>
                    {expandedItems[index] ? 'Fäll ihop' : 'Läs hela notisen'} <ChevronRight size={16} style={{ transform: expandedItems[index] ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                </div>
              </motion.div>
              </React.Fragment>
            );
          })}
          
          {displayedFeeds.length < allFeeds.length && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <Loader2 className="spin" size={24} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
