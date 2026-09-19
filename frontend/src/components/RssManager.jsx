import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, List, Edit2, Check, X, Link as LinkIcon, 
  Activity, Globe, Search, Library, Eye, CheckSquare, 
  Square, Filter, FolderPlus, EyeOff, Layers, Download,
  ChevronDown, FileCode, FileText, Upload
} from 'lucide-react';
import api from '../api';
import { resolveFeedIcon } from '../utils/textUtils';

const RssManager = ({ embedded = false }) => {
  // Huvudtillstånd
  const [activeTab, setActiveTab] = useState('my_feeds'); // 'my_feeds' | 'catalog'
  const [feeds, setFeeds] = useState([]);
  const [opmlFeeds, setOpmlFeeds] = useState([]);
  const [loading, setLoading] = useState(false);

  // Slumpmässigt intervall mellan 10 och 30 minuter för att inte polla alla flöden samtidigt
  const getRandomInterval = () => Math.floor(Math.random() * (30 - 10 + 1)) + 10;

  // Manuellt formulär
  const [showAddForm, setShowAddForm] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [pollingInterval, setPollingInterval] = useState(getRandomInterval);
  const [maxItems, setMaxItems] = useState(0);
  const [scrapeEnabled, setScrapeEnabled] = useState(true);
  const [includeInDashboard, setIncludeInDashboard] = useState(true);
  const [clickbaitEnabled, setClickbaitEnabled] = useState(true);

  // Redigering och borttagning av befintliga flöden
  const [editingFeedId, setEditingFeedId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editPollingInterval, setEditPollingInterval] = useState(60);
  const [editMaxItems, setEditMaxItems] = useState(0);
  const [editScrapeEnabled, setEditScrapeEnabled] = useState(true);
  const [editIncludeInDashboard, setEditIncludeInDashboard] = useState(true);
  const [editClickbaitEnabled, setEditClickbaitEnabled] = useState(true);
  const [deletingFeedId, setDeletingFeedId] = useState(null);
  const [feedSearch, setFeedSearch] = useState('');

  // Katalogsökning, filter och flerval
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('Alla');
  const [hideAlreadyAdded, setHideAlreadyAdded] = useState(false);
  const [selectedFeedUrls, setSelectedFeedUrls] = useState([]);
  const [addingFeedUrl, setAddingFeedUrl] = useState(null);
  const [batchAdding, setBatchAdding] = useState(false);

  // Förhandsgranskning (Preview)
  const [previewFeed, setPreviewFeed] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Export av flöden
  const [exportingFormat, setExportingFormat] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  const handleExport = async (format) => {
    try {
      setExportingFormat(format);
      const endpoint = format === 'json' ? '/feeds/export/json' : '/feeds/export/opml';
      const res = await api.get(endpoint, { responseType: 'blob' });
      const extension = format === 'json' ? 'json' : 'opml';
      const mimeType = format === 'json' ? 'application/json' : 'application/xml';
      const dateStr = new Date().toISOString().slice(0, 10);
      
      const blob = new Blob([res.data], { type: mimeType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `rss-bevakaren-floden-${dateStr}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      setShowExportMenu(false);
    } catch (err) {
      console.error("Kunde inte exportera flöden:", err);
    } finally {
      setExportingFormat(null);
    }
  };

  // Import av flöden
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Återställ filväljaren så att samma fil kan väljas igen
    e.target.value = '';

    setImporting(true);
    setImportMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/feeds/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = res.data;
      if (data.status === 'ok') {
        setImportMessage({
          type: 'success',
          text: data.message || `${data.added_count} flöden importerades.`
        });
        await fetchFeeds();
      } else {
        setImportMessage({
          type: 'warning',
          text: data.message || 'Inga flöden kunde importeras från filen.'
        });
      }
    } catch (err) {
      console.error('Kunde inte importera flöden:', err);
      const detail = err.response?.data?.detail || 'Ett fel uppstod vid import av filen.';
      setImportMessage({
        type: 'error',
        text: `Import misslyckades: ${detail}`
      });
    } finally {
      setImporting(false);
    }
  };

  const fetchFeeds = async () => {
    try {
      const res = await api.get('/feeds');
      setFeeds(res.data);
      window.dispatchEvent(new Event('feedsUpdated'));
    } catch (err) {
      console.error("Could not fetch feeds", err);
    }
  };

  const fetchOpmlFeeds = async () => {
    try {
      const res = await api.get('/opml-feeds');
      setOpmlFeeds(res.data);
    } catch (err) {
      console.error("Could not fetch OPML feeds", err);
    }
  };

  useEffect(() => {
    fetchFeeds();
    fetchOpmlFeeds();
  }, []);

  // Snabb enskild prenumeration
  const handleQuickAdd = async (feedUrl, feedTitle) => {
    setAddingFeedUrl(feedUrl);
    const randomInterval = getRandomInterval();
    try {
      await api.post('/feeds', { 
        url: feedUrl, 
        title: feedTitle, 
        polling_interval: randomInterval, 
        scrape_enabled: true, 
        include_in_dashboard: true,
        clickbait_enabled: true
      });
      await fetchFeeds();
      setSelectedFeedUrls(prev => prev.filter(u => u !== feedUrl));
    } catch (err) {
      console.error("Fel vid tillägg av flöde:", err);
    } finally {
      setAddingFeedUrl(null);
    }
  };

  // Masstillägg av markerade flöden
  const handleBatchAdd = async (feedsToAdd) => {
    if (!feedsToAdd || feedsToAdd.length === 0) return;
    setBatchAdding(true);
    try {
      await api.post('/feeds/batch', {
        feeds: feedsToAdd.map(f => ({ url: f.url, title: f.title }))
      });
      await fetchFeeds();
      setSelectedFeedUrls([]);
    } catch (err) {
      console.error("Fel vid masstillägg av flöden:", err);
    } finally {
      setBatchAdding(false);
    }
  };

  // Manuellt formulärtillägg
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    try {
      await api.post('/feeds', { 
        url, 
        title, 
        polling_interval: parseInt(pollingInterval, 10), 
        scrape_enabled: scrapeEnabled, 
        include_in_dashboard: includeInDashboard,
        clickbait_enabled: clickbaitEnabled,
        max_items: parseInt(maxItems, 10) || 0
      });
      setUrl('');
      setTitle('');
      setPollingInterval(getRandomInterval());
      setMaxItems(0);
      setScrapeEnabled(true);
      setIncludeInDashboard(true);
      setClickbaitEnabled(true);
      setShowAddForm(false);
      fetchFeeds();
    } catch (err) {
      console.error("Fel vid tillägg:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/feeds/${id}`);
      fetchFeeds();
    } catch (err) {
      console.error("Fel vid borttagning av flöde:", err);
    }
  };

  // Öppna förhandsgranskning
  const openPreview = async (feed) => {
    setPreviewFeed(feed);
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await api.get(`/preview-feed?url=${encodeURIComponent(feed.url)}`);
      setPreviewData(res.data);
    } catch (err) {
      setPreviewData({ error: 'Kunde inte läsa in förhandsgranskningen just nu.', articles: [] });
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewFeed(null);
    setPreviewData(null);
  };

  // Befintliga flöden som filtreras
  const sortedAndFilteredFeeds = feeds
    .filter(f => !feedSearch || (f.title || '').toLowerCase().includes(feedSearch.toLowerCase()) || (f.url || '').toLowerCase().includes(feedSearch.toLowerCase()))
    .sort((a, b) => (a.title || a.url || '').localeCompare(b.title || b.url || ''));

  // Kategoristatistik
  const categoryStats = useMemo(() => {
    const stats = {};
    const existingUrlSet = new Set(feeds.map(f => f.url));
    
    opmlFeeds.forEach(f => {
      const cat = f.category || 'Övrigt';
      if (!stats[cat]) {
        stats[cat] = { total: 0, unadded: 0 };
      }
      stats[cat].total += 1;
      if (!existingUrlSet.has(f.url)) {
        stats[cat].unadded += 1;
      }
    });

    const list = Object.keys(stats).map(name => ({
      name,
      total: stats[name].total,
      unadded: stats[name].unadded
    }));

    list.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    return list;
  }, [opmlFeeds, feeds]);

  // Filtrerade katalogflöden
  const filteredCatalogFeeds = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const existingUrlSet = new Set(feeds.map(f => f.url));

    return opmlFeeds.filter(f => {
      const isAlreadyAdded = existingUrlSet.has(f.url);
      if (hideAlreadyAdded && isAlreadyAdded) return false;

      const matchesCategory = catalogCategory === 'Alla' 
        ? true 
        : ((f.category || '').trim().toLowerCase() === catalogCategory.trim().toLowerCase());
      const matchesSearch = !term ||
        (f.title && f.title.toLowerCase().includes(term)) ||
        (f.description && f.description.toLowerCase().includes(term)) ||
        (f.category && f.category.toLowerCase().includes(term)) ||
        (f.url && f.url.toLowerCase().includes(term));

      return matchesCategory && matchesSearch;
    });
  }, [opmlFeeds, feeds, searchTerm, catalogCategory, hideAlreadyAdded]);

  // Hantering av kryssrutor för batch
  const toggleSelectFeed = (feedUrl) => {
    setSelectedFeedUrls(prev => 
      prev.includes(feedUrl) ? prev.filter(u => u !== feedUrl) : [...prev, feedUrl]
    );
  };

  const handleSelectAllVisible = () => {
    const existingUrlSet = new Set(feeds.map(f => f.url));
    const selectableUrls = filteredCatalogFeeds
      .filter(f => !existingUrlSet.has(f.url))
      .map(f => f.url);
    setSelectedFeedUrls(selectableUrls);
  };

  const handleDeselectAll = () => {
    setSelectedFeedUrls([]);
  };

  // Lägg till hela den valda kategorin
  const handleAddCategoryAll = () => {
    const existingUrlSet = new Set(feeds.map(f => f.url));
    const toAdd = filteredCatalogFeeds.filter(f => !existingUrlSet.has(f.url));
    handleBatchAdd(toAdd);
  };

  return (
    <div className={embedded ? "" : "dashboard-container"} style={{ maxWidth: '1100px', margin: embedded ? '0' : '0 auto' }}>
      
      {/* Huvudrubrik och primär fliknavigering */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <h2 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: embedded ? '1.4rem' : '1.8rem' }}>
            <List size={embedded ? 22 : 28} style={{ color: 'var(--primary)' }} /> Hantera flöden
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Exportera flöden */}
            <div style={{ position: 'relative' }} ref={exportMenuRef}>
              <button 
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={feeds.length === 0 || exportingFormat !== null}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: showExportMenu ? 'var(--bg-app)' : 'var(--bg-card)',
                  color: feeds.length === 0 ? 'var(--text-muted)' : 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: feeds.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  opacity: feeds.length === 0 ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
                title={feeds.length === 0 ? 'Du har inga flöden att exportera' : 'Exportera dina flöden med aktiveringsstatus och inställningar'}
              >
                <Download size={16} style={{ color: 'var(--primary)' }} />
                {exportingFormat ? 'Exporterar...' : 'Exportera'}
                <ChevronDown 
                  size={14} 
                  style={{ 
                    color: 'var(--text-muted)', 
                    transform: showExportMenu ? 'rotate(180deg)' : 'none', 
                    transition: 'transform 0.2s' 
                  }} 
                />
              </button>

              {showExportMenu && (
                <div 
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 6px)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    padding: '0.5rem',
                    minWidth: '260px',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleExport('opml')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '0.2rem',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '7px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'var(--text-main)',
                      width: '100%',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-app)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, fontSize: '0.88rem' }}>
                      <FileCode size={15} style={{ color: 'var(--primary)' }} />
                      OPML 2.0 (Rekommenderas)
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Universellt RSS-format berikat med aktiveringsstatus, dashboard-val och intervall
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport('json')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '0.2rem',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '7px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'var(--text-main)',
                      width: '100%',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-app)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, fontSize: '0.88rem' }}>
                      <FileText size={15} style={{ color: '#10b981' }} />
                      JSON-backup
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Fullständig datastruktur med alla användaranpassade inställningar
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Dold filväljare för import */}
            <input 
              type="file"
              ref={fileInputRef}
              accept=".opml,.xml,.json"
              onChange={handleFileImport}
              style={{ display: 'none' }}
            />

            {/* Importera flöden */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: importing ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                opacity: importing ? 0.7 : 1,
                transition: 'all 0.2s'
              }}
              title="Importera flöden från en OPML- eller JSON-fil"
            >
              <Upload size={16} style={{ color: 'var(--primary)' }} />
              {importing ? 'Importerar...' : 'Importera'}
            </button>

            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: showAddForm ? 'var(--bg-app)' : 'var(--bg-card)',
                color: 'var(--text-main)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
              }}
            >
              {showAddForm ? <X size={16} /> : <Plus size={16} style={{ color: 'var(--primary)' }} />}
              {showAddForm ? 'Dölj formulär' : 'Lägg till eget flöde'}
            </button>
          </div>
        </div>

        {/* Återkoppling vid import */}
        {importMessage && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            backgroundColor: importMessage.type === 'success' 
              ? 'rgba(16, 185, 129, 0.12)' 
              : importMessage.type === 'warning'
              ? 'rgba(245, 158, 11, 0.12)'
              : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${
              importMessage.type === 'success' 
                ? 'rgba(16, 185, 129, 0.3)' 
                : importMessage.type === 'warning'
                ? 'rgba(245, 158, 11, 0.3)'
                : 'rgba(239, 68, 68, 0.3)'
            }`,
            color: importMessage.type === 'success' 
              ? '#10b981' 
              : importMessage.type === 'warning'
              ? '#f59e0b'
              : '#ef4444',
            fontSize: '0.9rem',
            fontWeight: 500
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {importMessage.type === 'success' ? <Check size={16} /> : <Activity size={16} />}
              <span>{importMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setImportMessage(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Segmenterad flikväljare */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          background: 'var(--bg-app)',
          padding: '0.35rem',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          maxWidth: '520px'
        }}>
          <button
            onClick={() => setActiveTab('my_feeds')}
            style={{
              flex: 1,
              padding: '0.6rem 1rem',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'my_feeds' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'my_feeds' ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: activeTab === 'my_feeds' ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: activeTab === 'my_feeds' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <List size={16} style={{ color: activeTab === 'my_feeds' ? 'var(--primary)' : 'inherit' }} />
            Mina flöden
            <span style={{ 
              fontSize: '0.75rem', 
              padding: '0.1rem 0.5rem', 
              borderRadius: '10px', 
              background: activeTab === 'my_feeds' ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-card)', 
              color: activeTab === 'my_feeds' ? 'var(--primary)' : 'var(--text-muted)' 
            }}>
              {feeds.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            style={{
              flex: 1,
              padding: '0.6rem 1rem',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'catalog' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'catalog' ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: activeTab === 'catalog' ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: activeTab === 'catalog' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <Library size={16} style={{ color: activeTab === 'catalog' ? 'var(--primary)' : 'inherit' }} />
            Flödeskatalog & Upptäck
            <span style={{ 
              fontSize: '0.75rem', 
              padding: '0.1rem 0.5rem', 
              borderRadius: '10px', 
              background: activeTab === 'catalog' ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-card)', 
              color: activeTab === 'catalog' ? 'var(--primary)' : 'var(--text-muted)' 
            }}>
              {opmlFeeds.length}
            </span>
          </button>
        </div>
      </div>

      {/* Manuellt formulär för att lägga till URL */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            transition={{ duration: 0.25 }}
          >
            <div style={{
              backgroundColor: 'var(--bg-card)',
              padding: '1.5rem',
              borderRadius: '12px',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
              marginBottom: '2rem',
              border: '1px solid var(--border-color)'
            }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                <Globe size={18} style={{ color: 'var(--primary)' }}/> Lägg till eget RSS-flöde
              </h3>
              <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1', minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Titel (valfritt)</label>
                  <input 
                    type="text" 
                    placeholder="T.ex. Min Nyhetskälla" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
                <div style={{ flex: '2', minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>RSS-adress (URL) *</label>
                  <input 
                    type="url" 
                    placeholder="https://exempel.se/rss" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
                <div style={{ flex: '0 1 120px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Intervall (min)</label>
                  <input 
                    type="number" 
                    min="1"
                    title="Slumpas som standard mellan 10-30 min för att sprida ut hämtningen"
                    value={pollingInterval}
                    onChange={(e) => setPollingInterval(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
                <div style={{ flex: '0 1 120px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Max artiklar</label>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="0 = alla"
                    title="Högsta antal artiklar att läsa in per hämtning (0 = alla/obegränsat)"
                    value={maxItems === 0 ? '' : maxItems}
                    onChange={(e) => setMaxItems(parseInt(e.target.value, 10) || 0)}
                    style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: '1', minWidth: '350px', flexWrap: 'wrap', paddingBottom: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <div className="toggle-switch">
                      <input type="checkbox" checked={scrapeEnabled} onChange={(e) => setScrapeEnabled(e.target.checked)} />
                      <span className="toggle-slider"></span>
                    </div>
                    Automatisk hämtning
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <div className="toggle-switch">
                      <input type="checkbox" checked={includeInDashboard} onChange={(e) => setIncludeInDashboard(e.target.checked)} />
                      <span className="toggle-slider"></span>
                    </div>
                    Visa i nyhetsflödet
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.9rem' }} title="AI granskar och flaggar eventuellt ClickBait (kan inaktiveras för myndigheter och krisinformation)">
                    <div className="toggle-switch">
                      <input type="checkbox" checked={clickbaitEnabled} onChange={(e) => setClickbaitEnabled(e.target.checked)} />
                      <span className="toggle-slider"></span>
                    </div>
                    ClickBait-granskning
                  </label>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  style={{
                    padding: '0.6rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    minWidth: '120px',
                    justifyContent: 'center'
                  }}
                >
                  <Plus size={18} /> Lägg till
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLIK 1: FLÖDESKATALOG & UPPTÄCK */}
      {activeTab === 'catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Ämneskort / Kategorinät */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Välj ämnesområde
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {categoryStats.length} kategorier tillgängliga
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}>
              {/* Kort för alla ämnen */}
              <button
                type="button"
                onClick={() => setCatalogCategory('Alla')}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  textAlign: 'left',
                  border: '1px solid',
                  borderColor: catalogCategory === 'Alla' ? 'var(--primary)' : 'var(--border-color)',
                  background: catalogCategory === 'Alla' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.4rem'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: catalogCategory === 'Alla' ? 'var(--primary)' : 'var(--text-main)' }}>
                  Alla ämnen
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {opmlFeeds.length} källor totalt
                </div>
              </button>

              {/* Kort för varje enskild kategori */}
              {categoryStats.map(cat => {
                const isSelected = catalogCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setCatalogCategory(cat.name)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      textAlign: 'left',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)',
                      background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.4rem'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? 'var(--primary)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cat.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>{cat.total} källor</span>
                      {cat.unadded > 0 ? (
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{cat.unadded} nya</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Alla tillagda</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sökning, filterväxlar och batchknappar */}
          <div style={{
            background: 'var(--bg-card)',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              
              {/* Sökruta */}
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.9rem', flex: 1, minWidth: '240px' }}>
                <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '0.6rem' }} />
                <input 
                  type="text" 
                  placeholder="Sök källa, ämne eller beskrivning..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-main)', fontSize: '0.9rem' }}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Dölj redan tillagda växel */}
              <button
                type="button"
                onClick={() => setHideAlreadyAdded(!hideAlreadyAdded)}
                style={{
                  padding: '0.5rem 0.9rem',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: hideAlreadyAdded ? 'var(--primary)' : 'var(--border-color)',
                  background: hideAlreadyAdded ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-app)',
                  color: hideAlreadyAdded ? 'var(--primary)' : 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  transition: 'all 0.15s ease'
                }}
              >
                {hideAlreadyAdded ? <EyeOff size={15} /> : <Filter size={15} />}
                {hideAlreadyAdded ? 'Visar endast ej tillagda' : 'Dölj redan tillagda'}
              </button>

              {/* Snabbprenumeration på hela kategorin */}
              {catalogCategory !== 'Alla' && (
                <button
                  type="button"
                  onClick={handleAddCategoryAll}
                  disabled={batchAdding || filteredCatalogFeeds.filter(f => !feeds.some(ef => ef.url === f.url)).length === 0}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    opacity: (batchAdding || filteredCatalogFeeds.filter(f => !feeds.some(ef => ef.url === f.url)).length === 0) ? 0.5 : 1
                  }}
                >
                  <FolderPlus size={15} />
                  Lägg till alla i {catalogCategory}
                </button>
              )}
            </div>

            {/* Rad med markering och räknare */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>Visar {filteredCatalogFeeds.length} källor</span>
                <span>·</span>
                <button 
                  type="button" 
                  onClick={handleSelectAllVisible}
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, fontSize: '0.85rem', fontWeight: 600 }}
                >
                  Markera alla visas
                </button>
                {selectedFeedUrls.length > 0 && (
                  <>
                    <span>·</span>
                    <button 
                      type="button" 
                      onClick={handleDeselectAll}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}
                    >
                      Avmarkera
                    </button>
                  </>
                )}
              </div>

              {/* Batch-action knapp när poster är markerade */}
              {selectedFeedUrls.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {selectedFeedUrls.length} flöden valda
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const toAdd = opmlFeeds.filter(f => selectedFeedUrls.includes(f.url));
                      handleBatchAdd(toAdd);
                    }}
                    disabled={batchAdding}
                    style={{
                      padding: '0.45rem 1rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    {batchAdding ? <Activity size={14} className="spin-animation" /> : <Plus size={14} />}
                    Lägg till alla markerade
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Listning av källor i katalogen */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
          }}>
            {opmlFeeds.length === 0 ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Läser in katalogen...
              </div>
            ) : filteredCatalogFeeds.length === 0 ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {searchTerm ? `Inga källor matchade "${searchTerm}".` : 'Inga källor att visa i denna vy.'}
              </div>
            ) : (
              <div key={catalogCategory} style={{ display: 'flex', flexDirection: 'column' }}>
                {filteredCatalogFeeds.map((feed, idx) => {
                  const isAlreadyAdded = feeds.some(existing => existing.url === feed.url);
                  const isAdding = addingFeedUrl === feed.url;
                  const isSelected = selectedFeedUrls.includes(feed.url);

                  return (
                    <div 
                      key={`${catalogCategory}_${feed.url || idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem 1.25rem',
                        borderBottom: idx < filteredCatalogFeeds.length - 1 ? '1px solid var(--border-color)' : 'none',
                        gap: '1rem',
                        backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.03)' : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {/* Vänster: Kryssruta för flerval */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flex: 1, minWidth: 0 }}>
                        <button
                          type="button"
                          disabled={isAlreadyAdded}
                          onClick={() => toggleSelectFeed(feed.url)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: isAlreadyAdded ? 'default' : 'pointer',
                            color: isAlreadyAdded ? 'var(--text-muted)' : isSelected ? 'var(--primary)' : 'var(--text-muted)',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            opacity: isAlreadyAdded ? 0.3 : 1
                          }}
                          title={isAlreadyAdded ? 'Redan tillagd' : isSelected ? 'Avmarkera' : 'Markera för masstillägg'}
                        >
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.98rem', color: 'var(--text-main)' }}>
                              {feed.title}
                            </span>
                            {feed.category && (
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                background: 'var(--bg-app)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-muted)',
                                fontWeight: 500
                              }}>
                                {feed.category}
                              </span>
                            )}
                          </div>
                          {feed.description && feed.description !== feed.title && (
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {feed.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Höger: Åtgärder (Förhandsgranska & Lägg till) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => openPreview(feed)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-app)',
                            color: 'var(--text-main)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            transition: 'all 0.15s ease'
                          }}
                          title="Förhandsgranska senaste artiklar från källan"
                        >
                          <Eye size={14} style={{ color: 'var(--text-muted)' }} />
                          Förhandsgranska
                        </button>

                        <button
                          type="button"
                          onClick={() => handleQuickAdd(feed.url, feed.title)}
                          disabled={isAlreadyAdded || isAdding}
                          style={{
                            padding: '0.45rem 0.9rem',
                            borderRadius: '6px',
                            border: isAlreadyAdded ? '1px solid var(--border-color)' : 'none',
                            backgroundColor: isAlreadyAdded ? 'transparent' : 'var(--primary)',
                            color: isAlreadyAdded ? 'var(--text-muted)' : 'white',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            cursor: isAlreadyAdded ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            whiteSpace: 'nowrap',
                            opacity: isAdding ? 0.7 : 1,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {isAdding ? <Activity size={14} className="spin-animation" /> : 
                           isAlreadyAdded ? <Check size={14} /> : <Plus size={14} />}
                          {isAlreadyAdded ? 'Tillagd' : 'Lägg till'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FLIK 2: MINA BEFINTLIGA FLÖDEN */}
      {activeTab === 'my_feeds' && (
        <div>
          {feeds.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 1rem', marginBottom: '1.25rem' }}>
              <Search size={18} style={{ color: 'var(--text-muted)', marginRight: '0.75rem' }} />
              <input 
                type="text" 
                placeholder="Sök bland dina bevakade flöden..." 
                value={feedSearch}
                onChange={(e) => setFeedSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-main)', fontSize: '0.95rem' }}
              />
              {feedSearch && (
                <button onClick={() => setFeedSearch('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          <div className="rss-list-container">
            {feeds.length === 0 ? (
              <div style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <Globe size={48} style={{ opacity: 0.25, margin: '0 auto 1rem auto', display: 'block' }} />
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>Du bevakar inga flöden ännu</h3>
                <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem' }}>
                  Utforska katalogen med över 300 kvalitetssäkrade källor eller lägg till egna RSS-länkar.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Library size={16} /> Öppna flödeskatalogen
                </button>
              </div>
            ) : sortedAndFilteredFeeds.length === 0 ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                Inga träffar för "{feedSearch}".
              </div>
            ) : (
              <>
                {/* Desktop gemensam tabellheader */}
                <div className="rss-table-header">
                  <div>Källa / Flöde</div>
                  <div className="rss-table-col-center" title="Uppdateringsintervall i minuter">Intervall</div>
                  <div className="rss-table-col-center" title="Max antal artiklar att läsa in per hämtning (0 = obegränsat)">Max art.</div>
                  <div className="rss-table-col-center" title="Hämta artiklar automatiskt i bakgrunden">Hämta</div>
                  <div className="rss-table-col-center" title="Visa artiklar i nyhetsflödet">I flöde</div>
                  <div className="rss-table-col-center" title="ClickBait-granskning med AI">ClickBait</div>
                  <div className="rss-table-col-right">Åtgärder</div>
                </div>

                {sortedAndFilteredFeeds.map((feed) => (
                  <div className="rss-list-item" key={feed.id}>
                    {editingFeedId === feed.id ? (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%', padding: '0.25rem 0' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 200px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Flödestitel</label>
                            <input 
                              type="text"
                              value={editTitle} 
                              onChange={e => setEditTitle(e.target.value)}
                              placeholder="Titel"
                              style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--primary)', background: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '0.92rem', width: '100%' }}
                            />
                          </div>
                          <div style={{ flex: '2 1 300px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>RSS-adress (URL)</label>
                            <input 
                              type="url"
                              value={editUrl} 
                              onChange={e => setEditUrl(e.target.value)}
                              placeholder="RSS-adress"
                              style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--primary)', background: 'var(--bg-app)', color: 'var(--text-muted)', fontSize: '0.88rem', width: '100%' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', background: 'var(--bg-app)', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Intervall:</span>
                              <div className="rss-pill-input">
                                <Activity size={12} style={{ color: 'var(--primary)' }} />
                                <input 
                                  type="number" 
                                  min="1" 
                                  value={editPollingInterval} 
                                  onChange={e => setEditPollingInterval(parseInt(e.target.value, 10) || 1)} 
                                />
                                <span>m</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Max art:</span>
                              <div className="rss-pill-input">
                                <input 
                                  type="number" 
                                  min="0" 
                                  placeholder="0"
                                  value={editMaxItems} 
                                  onChange={e => setEditMaxItems(parseInt(e.target.value, 10) || 0)} 
                                />
                                <span>st</span>
                              </div>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                              <div className="toggle-switch" style={{ transform: 'scale(0.75)' }}>
                                <input type="checkbox" checked={editScrapeEnabled} onChange={e => setEditScrapeEnabled(e.target.checked)} />
                                <span className="toggle-slider"></span>
                              </div>
                              Hämta
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                              <div className="toggle-switch" style={{ transform: 'scale(0.75)' }}>
                                <input type="checkbox" checked={editIncludeInDashboard} onChange={e => setEditIncludeInDashboard(e.target.checked)} />
                                <span className="toggle-slider"></span>
                              </div>
                              I flöde
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                              <div className="toggle-switch" style={{ transform: 'scale(0.75)' }}>
                                <input type="checkbox" checked={editClickbaitEnabled} onChange={e => setEditClickbaitEnabled(e.target.checked)} />
                                <span className="toggle-slider"></span>
                              </div>
                              ClickBait
                            </label>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              type="button"
                              onClick={() => {
                                api.put(`/feeds/${feed.id}`, { 
                                  title: editTitle, 
                                  url: editUrl, 
                                  polling_interval: editPollingInterval, 
                                  max_items: editMaxItems,
                                  scrape_enabled: editScrapeEnabled, 
                                  include_in_dashboard: editIncludeInDashboard,
                                  clickbait_enabled: editClickbaitEnabled
                                }).then(fetchFeeds);
                                setEditingFeedId(null);
                              }} 
                              style={{ padding: '0.4rem 0.85rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}
                            >
                              <Check size={14} /> Spara
                            </button>
                            <button 
                              type="button"
                              onClick={() => setEditingFeedId(null)} 
                              style={{ padding: '0.4rem 0.75rem', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
                            >
                              <X size={14} /> Avbryt
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* DESKTOP VY */}
                        {/* 1. Källa / Flöde */}
                        <div className="rss-desktop-only" style={{ flexDirection: 'column', minWidth: 0, gap: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <img 
                              src={resolveFeedIcon(feed.icon_url)} 
                              alt="" 
                              style={{ width: 18, height: 18, borderRadius: '4px', objectFit: 'contain', flexShrink: 0 }} 
                              onError={(e) => { 
                                if (!e.currentTarget.src.endsWith('/default-feed-icon.png')) {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = '/default-feed-icon.png';
                                }
                              }} 
                            />
                            <span style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={feed.title}>
                              {feed.title || '[Ingen titel angiven]'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem', color: 'var(--text-muted)', paddingLeft: '1.65rem' }}>
                            <LinkIcon size={11} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={feed.url}>
                              {feed.url}
                            </span>
                          </div>
                        </div>

                        {/* 2. Intervall */}
                        <div className="rss-desktop-only" style={{ justifyContent: 'center' }}>
                          <div className="rss-pill-input" title="Uppdateringsintervall i minuter">
                            <Activity size={12} style={{ color: 'var(--primary)' }} />
                            <input
                              type="number"
                              min="1"
                              defaultValue={feed.polling_interval || 60}
                              key={`interval-${feed.id}-${feed.polling_interval}`}
                              onBlur={(e) => {
                                const newVal = parseInt(e.target.value, 10);
                                if (newVal !== feed.polling_interval && !isNaN(newVal) && newVal > 0) {
                                  api.put(`/feeds/${feed.id}`, { 
                                    title: feed.title, 
                                    url: feed.url, 
                                    polling_interval: newVal, 
                                    max_items: feed.max_items || 0,
                                    scrape_enabled: feed.scrape_enabled, 
                                    include_in_dashboard: feed.include_in_dashboard, 
                                    clickbait_enabled: feed.clickbait_enabled !== undefined ? feed.clickbait_enabled : true 
                                  }).then(fetchFeeds);
                                }
                              }}
                            />
                            <span>m</span>
                          </div>
                        </div>

                        {/* 3. Max artiklar */}
                        <div className="rss-desktop-only" style={{ justifyContent: 'center' }}>
                          <div className="rss-pill-input" title="Max antal artiklar att hämta per pollning (0 = obegränsat/systemstandard)">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              defaultValue={feed.max_items || 0}
                              key={`max-${feed.id}-${feed.max_items}`}
                              onBlur={(e) => {
                                const newVal = parseInt(e.target.value, 10) || 0;
                                if (newVal !== (feed.max_items || 0)) {
                                  api.put(`/feeds/${feed.id}`, { 
                                    title: feed.title, 
                                    url: feed.url, 
                                    polling_interval: feed.polling_interval, 
                                    max_items: newVal,
                                    scrape_enabled: feed.scrape_enabled, 
                                    include_in_dashboard: feed.include_in_dashboard, 
                                    clickbait_enabled: feed.clickbait_enabled !== undefined ? feed.clickbait_enabled : true 
                                  }).then(fetchFeeds);
                                }
                              }}
                            />
                            <span>st</span>
                          </div>
                        </div>

                        {/* 4. Automatisk hämtning */}
                        <div className="rss-desktop-only" style={{ justifyContent: 'center' }} title="Hämta artiklar automatiskt">
                          <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                            <input
                              type="checkbox"
                              checked={feed.scrape_enabled}
                              onChange={(e) => {
                                api.put(`/feeds/${feed.id}`, { 
                                  title: feed.title, 
                                  url: feed.url, 
                                  polling_interval: feed.polling_interval, 
                                  max_items: feed.max_items || 0,
                                  scrape_enabled: e.target.checked, 
                                  include_in_dashboard: feed.include_in_dashboard, 
                                  clickbait_enabled: feed.clickbait_enabled !== undefined ? feed.clickbait_enabled : true 
                                }).then(fetchFeeds);
                              }}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>

                        {/* 5. Nyhetsflöde */}
                        <div className="rss-desktop-only" style={{ justifyContent: 'center' }} title="Visa i nyhetsflödet">
                          <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                            <input
                              type="checkbox"
                              checked={feed.include_in_dashboard}
                              onChange={(e) => {
                                api.put(`/feeds/${feed.id}`, { 
                                  title: feed.title, 
                                  url: feed.url, 
                                  polling_interval: feed.polling_interval, 
                                  max_items: feed.max_items || 0,
                                  scrape_enabled: feed.scrape_enabled, 
                                  include_in_dashboard: e.target.checked, 
                                  clickbait_enabled: feed.clickbait_enabled !== undefined ? feed.clickbait_enabled : true 
                                }).then(fetchFeeds);
                              }}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>

                        {/* 6. ClickBait */}
                        <div className="rss-desktop-only" style={{ justifyContent: 'center' }} title="AI-granskning av ClickBait">
                          <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                            <input
                              type="checkbox"
                              checked={feed.clickbait_enabled !== undefined ? Boolean(feed.clickbait_enabled) : true}
                              onChange={(e) => {
                                api.put(`/feeds/${feed.id}`, { 
                                  title: feed.title, 
                                  url: feed.url, 
                                  polling_interval: feed.polling_interval, 
                                  max_items: feed.max_items || 0,
                                  scrape_enabled: feed.scrape_enabled, 
                                  include_in_dashboard: feed.include_in_dashboard, 
                                  clickbait_enabled: e.target.checked 
                                }).then(fetchFeeds);
                              }}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>

                        {/* 7. Åtgärder */}
                        <div className="rss-desktop-only" style={{ justifyContent: 'flex-end', gap: '0.25rem' }}>
                          {deletingFeedId === feed.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                              <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 'bold' }}>Radera?</span>
                              <div style={{ display: 'flex', gap: '0.2rem' }}>
                                <button onClick={() => { handleDelete(feed.id); setDeletingFeedId(null); }} style={{ padding: '0.15rem 0.45rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 'bold' }}>JA</button>
                                <button onClick={() => setDeletingFeedId(null)} style={{ padding: '0.15rem 0.45rem', background: 'var(--bg-app)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer' }}>NEJ</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button 
                                type="button"
                                onClick={() => { 
                                  setEditingFeedId(feed.id); 
                                  setEditTitle(feed.title); 
                                  setEditUrl(feed.url); 
                                  setEditPollingInterval(feed.polling_interval || 60);
                                  setEditMaxItems(feed.max_items || 0);
                                  setEditScrapeEnabled(feed.scrape_enabled);
                                  setEditIncludeInDashboard(feed.include_in_dashboard);
                                  setEditClickbaitEnabled(feed.clickbait_enabled !== undefined ? Boolean(feed.clickbait_enabled) : true);
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '0.35rem',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                title="Redigera flöde"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button 
                                type="button"
                                onClick={() => setDeletingFeedId(feed.id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '0.35rem',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                title="Ta bort flöde"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>

                        {/* MOBIL VY (KORTLAYOUT) */}
                        <div className="rss-mobile-only" style={{ flexDirection: 'column', width: '100%', gap: '0.65rem' }}>
                          <div className="rss-mobile-top">
                            <div className="rss-mobile-header-info">
                              <img 
                                src={resolveFeedIcon(feed.icon_url)} 
                                alt="" 
                                style={{ width: 20, height: 20, borderRadius: '4px', objectFit: 'contain', flexShrink: 0 }} 
                                onError={(e) => { 
                                  if (!e.currentTarget.src.endsWith('/default-feed-icon.png')) {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = '/default-feed-icon.png';
                                  }
                                }} 
                              />
                              <h3 title={feed.title}>
                                {feed.title || '[Ingen titel angiven]'}
                              </h3>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                              {deletingFeedId === feed.id ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 'bold' }}>Radera?</span>
                                  <button onClick={() => { handleDelete(feed.id); setDeletingFeedId(null); }} style={{ padding: '0.2rem 0.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}>JA</button>
                                  <button onClick={() => setDeletingFeedId(null)} style={{ padding: '0.2rem 0.5rem', background: 'var(--bg-app)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>NEJ</button>
                                </div>
                              ) : (
                                <>
                                  <button 
                                    type="button"
                                    onClick={() => { 
                                      setEditingFeedId(feed.id); 
                                      setEditTitle(feed.title); 
                                      setEditUrl(feed.url); 
                                      setEditPollingInterval(feed.polling_interval || 60);
                                      setEditMaxItems(feed.max_items || 0);
                                      setEditScrapeEnabled(feed.scrape_enabled);
                                      setEditIncludeInDashboard(feed.include_in_dashboard);
                                      setEditClickbaitEnabled(feed.clickbait_enabled !== undefined ? Boolean(feed.clickbait_enabled) : true);
                                    }}
                                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.45rem', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                                    title="Redigera flöde"
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => setDeletingFeedId(feed.id)}
                                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.45rem', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                                    title="Ta bort flöde"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="rss-mobile-url" title={feed.url}>
                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                            <span>{feed.url}</span>
                          </div>

                          <div className="rss-mobile-controls">
                            <div className="rss-mobile-values-row">
                              <div className="rss-mobile-val-item">
                                <span>Intervall:</span>
                                <div className="rss-pill-input">
                                  <Activity size={12} style={{ color: 'var(--primary)' }} />
                                  <input
                                    type="number"
                                    min="1"
                                    defaultValue={feed.polling_interval || 60}
                                    key={`m-int-${feed.id}-${feed.polling_interval}`}
                                    onBlur={(e) => {
                                      const newVal = parseInt(e.target.value, 10);
                                      if (newVal !== feed.polling_interval && !isNaN(newVal) && newVal > 0) {
                                        api.put(`/feeds/${feed.id}`, { 
                                          title: feed.title, 
                                          url: feed.url, 
                                          polling_interval: newVal, 
                                          max_items: feed.max_items || 0,
                                          scrape_enabled: feed.scrape_enabled, 
                                          include_in_dashboard: feed.include_in_dashboard, 
                                          clickbait_enabled: feed.clickbait_enabled !== undefined ? feed.clickbait_enabled : true 
                                        }).then(fetchFeeds);
                                      }
                                    }}
                                  />
                                  <span>m</span>
                                </div>
                              </div>

                              <div className="rss-mobile-val-item">
                                <span>Max art:</span>
                                <div className="rss-pill-input">
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    defaultValue={feed.max_items || 0}
                                    key={`m-max-${feed.id}-${feed.max_items}`}
                                    onBlur={(e) => {
                                      const newVal = parseInt(e.target.value, 10) || 0;
                                      if (newVal !== (feed.max_items || 0)) {
                                        api.put(`/feeds/${feed.id}`, { 
                                          title: feed.title, 
                                          url: feed.url, 
                                          polling_interval: feed.polling_interval, 
                                          max_items: newVal,
                                          scrape_enabled: feed.scrape_enabled, 
                                          include_in_dashboard: feed.include_in_dashboard, 
                                          clickbait_enabled: feed.clickbait_enabled !== undefined ? feed.clickbait_enabled : true 
                                        }).then(fetchFeeds);
                                      }
                                    }}
                                  />
                                  <span>st</span>
                                </div>
                              </div>
                            </div>

                            <div className="rss-mobile-switches-row">
                              <div className="rss-mobile-switch-item" title="Automatisk hämtning">
                                <span className="rss-mobile-switch-label">Hämta</span>
                                <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                                  <input
                                    type="checkbox"
                                    checked={feed.scrape_enabled}
                                    onChange={(e) => {
                                      api.put(`/feeds/${feed.id}`, { 
                                        title: feed.title, 
                                        url: feed.url, 
                                        polling_interval: feed.polling_interval, 
                                        max_items: feed.max_items || 0,
                                        scrape_enabled: e.target.checked, 
                                        include_in_dashboard: feed.include_in_dashboard, 
                                        clickbait_enabled: feed.clickbait_enabled !== undefined ? feed.clickbait_enabled : true 
                                      }).then(fetchFeeds);
                                    }}
                                  />
                                  <span className="toggle-slider"></span>
                                </label>
                              </div>

                              <div className="rss-mobile-switch-item" title="Visa i nyhetsflödet">
                                <span className="rss-mobile-switch-label">I flöde</span>
                                <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                                  <input
                                    type="checkbox"
                                    checked={feed.include_in_dashboard}
                                    onChange={(e) => {
                                      api.put(`/feeds/${feed.id}`, { 
                                        title: feed.title, 
                                        url: feed.url, 
                                        polling_interval: feed.polling_interval, 
                                        max_items: feed.max_items || 0,
                                        scrape_enabled: feed.scrape_enabled, 
                                        include_in_dashboard: e.target.checked, 
                                        clickbait_enabled: feed.clickbait_enabled !== undefined ? feed.clickbait_enabled : true 
                                      }).then(fetchFeeds);
                                    }}
                                  />
                                  <span className="toggle-slider"></span>
                                </label>
                              </div>

                              <div className="rss-mobile-switch-item" title="ClickBait-granskning">
                                <span className="rss-mobile-switch-label">ClickBait</span>
                                <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                                  <input
                                    type="checkbox"
                                    checked={feed.clickbait_enabled !== undefined ? Boolean(feed.clickbait_enabled) : true}
                                    onChange={(e) => {
                                      api.put(`/feeds/${feed.id}`, { 
                                        title: feed.title, 
                                        url: feed.url, 
                                        polling_interval: feed.polling_interval, 
                                        max_items: feed.max_items || 0,
                                        scrape_enabled: feed.scrape_enabled, 
                                        include_in_dashboard: feed.include_in_dashboard, 
                                        clickbait_enabled: e.target.checked 
                                      }).then(fetchFeeds);
                                    }}
                                  />
                                  <span className="toggle-slider"></span>
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* FÖRHANDSGRANSKNINGS-MODAL */}
      <AnimatePresence>
        {previewFeed && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem'
          }} onClick={closePreview}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                width: '100%',
                maxWidth: '650px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
                overflow: 'hidden'
              }}
            >
              {/* Modal header */}
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>
                      {previewFeed.title}
                    </h3>
                    {previewFeed.category && (
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background: 'var(--bg-app)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-muted)'
                      }}>
                        {previewFeed.category}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '480px' }}>
                    {previewFeed.url}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closePreview}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.3rem',
                    borderRadius: '6px',
                    display: 'flex'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal innehåll */}
              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                {previewLoading ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Activity size={28} className="spin-animation" style={{ margin: '0 auto 1rem auto', display: 'block', color: 'var(--primary)' }} />
                    Hämtar de senaste artiklarna från källan...
                  </div>
                ) : previewData?.error ? (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#ef4444' }}>
                    {previewData.error}
                  </div>
                ) : !previewData?.articles || previewData.articles.length === 0 ? (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Inga artiklar kunde läsas in från detta flöde för tillfället.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Senaste artiklar ({previewData.articles.length})
                    </div>
                    {previewData.articles.map((art, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          padding: '1rem', 
                          borderRadius: '8px', 
                          background: 'var(--bg-app)', 
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem'
                        }}
                      >
                        <a 
                          href={art.link} 
                          target="_blank" 
                          rel="noreferrer" 
                          style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', textDecoration: 'none' }}
                          onMouseOver={(e) => { e.currentTarget.style.color = 'var(--primary)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-main)'; }}
                        >
                          {art.title}
                        </a>
                        {art.published && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {art.published}
                          </div>
                        )}
                        {art.summary && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            {art.summary}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal sidfot */}
              <div style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-app)'
              }}>
                <button
                  type="button"
                  onClick={closePreview}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Stäng
                </button>

                {feeds.some(f => f.url === previewFeed.url) ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                    <Check size={16} /> Redan i ditt nyhetsflöde
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleQuickAdd(previewFeed.url, previewFeed.title);
                      closePreview();
                    }}
                    style={{
                      padding: '0.5rem 1.25rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: 'white',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <Plus size={16} /> Lägg till detta flöde
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default RssManager;
