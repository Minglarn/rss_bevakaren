import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Rss, Cpu, Sliders, Check, ChevronRight, ChevronLeft, 
  X, CheckCircle2, AlertCircle, Loader2, Sparkles, Layers,
  Compass, ShieldAlert, Zap, Globe, Plus, Info, Bell
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

// Rekommenderade svenska flödespaket
const RECOMMENDED_PACKAGES = [
  {
    id: 'news',
    title: 'Svenska Riksnyheter',
    description: 'De ledande nyhetsredaktionerna för bred och opartisk nyhetsbevakning.',
    feeds: [
      { title: 'SVT Nyheter', url: 'https://www.svt.se/rss.xml' },
      { title: 'SR Ekot', url: 'https://api.sr.se/api/rss/program/83' },
      { title: 'Dagens Nyheter', url: 'https://www.dn.se/rss' },
      { title: 'Svenska Dagbladet', url: 'https://www.svd.se/feed/articles.rss' },
      { title: 'Aftonbladet Senaste Nytt', url: 'https://rss.aftonbladet.se/rss2/small/pages/sections/senastenytt' },
      { title: 'Expressen', url: 'https://feeds.expressen.se' }
    ]
  },
  {
    id: 'tech',
    title: 'Teknik & IT',
    description: 'Håll koll på digital utveckling, hårdvara, AI och säkerhet.',
    feeds: [
      { title: 'SweClockers', url: 'https://www.sweclockers.com/feeds/nyheter' },
      { title: 'Ny Teknik', url: 'https://www.nyteknik.se/feed' },
      { title: 'Computer Sweden', url: 'https://computersweden.se/feed' },
      { title: 'Feber', url: 'https://feber.se/rss/' }
    ]
  },
  {
    id: 'economy',
    title: 'Ekonomi & Finans',
    description: 'Börs, makroekonomi, entreprenörskap och företagsnyheter.',
    feeds: [
      { title: 'Dagens Industri', url: 'https://www.di.se/rss' },
      { title: 'Breakit', url: 'https://www.breakit.se/feed/artiklar' },
      { title: 'Affärsvärlden', url: 'https://www.affarsvarlden.se/feed' }
    ]
  },
  {
    id: 'emergency',
    title: 'Blåljus & Krisinformation',
    description: 'Officiella larm, polisens händelserapporter och samhällsvarningar.',
    feeds: [
      { title: 'Polisen Händelser', url: 'https://polisen.se/aktuellt/rss/hela-landet/handelser-i-hela-landet/' },
      { title: 'Krisinformation.se', url: 'https://api.krisinformation.se/v1/feed?format=rss' }
    ]
  },
  {
    id: 'motor',
    title: 'Motor & Elbilar',
    description: 'Tester, fordonsnyheter och omställningen till eldrift.',
    feeds: [
      { title: 'Vi Bilägare', url: 'https://www.vibilagare.se/rss/nyheter' },
      { title: 'Allt om elbil', url: 'https://alltomelbil.se/feed' },
      { title: 'CarUp', url: 'https://carup.se/feed' }
    ]
  }
];

// Standardkategorier med neutral baslinje 6/10
const BASE_CATEGORIES = [
  { name: 'Blåljus', weight: 6 },
  { name: 'Lokalt', weight: 6 },
  { name: 'Inrikes', weight: 6 },
  { name: 'Utrikes', weight: 6 },
  { name: 'Politik', weight: 6 },
  { name: 'Ekonomi', weight: 6 },
  { name: 'Teknik', weight: 6 },
  { name: 'Motor', weight: 6 },
  { name: 'Vetenskap & Hälsa', weight: 6 },
  { name: 'Sport', weight: 5 },
  { name: 'Nöje & Kultur', weight: 5 },
  { name: 'Övrigt', weight: 5 }
];

const OnboardingWizard = ({ isOpen, onClose, onCompleted }) => {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Steg 1: Valda flöden (URL:er)
  const [selectedFeeds, setSelectedFeeds] = useState(() => {
    // Förbockade som standard: SVT, SR Ekot, SweClockers och Polisen
    return [
      'https://www.svt.se/rss.xml',
      'https://api.sr.se/api/rss/program/83',
      'https://www.sweclockers.com/feeds/nyheter',
      'https://polisen.se/aktuellt/rss/hela-landet/handelser-i-hela-landet/'
    ];
  });

  // Steg 2: AI-inställningar
  const [aiHealthy, setAiHealthy] = useState(false);
  const [aiUrl, setAiUrl] = useState('');
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [pushSummaryType, setPushSummaryType] = useState('short');
  const [checkingAi, setCheckingAi] = useState(false);

  // Steg 3: Frågebatteri för Intresseprofil
  const [highPriorityTopics, setHighPriorityTopics] = useState(['tech', 'emergency']);
  const [lowPriorityTopics, setLowPriorityTopics] = useState(['entertainment', 'sports', 'clickbait']);
  const [urgencyMode, setUrgencyMode] = useState('high'); // 'high' | 'balanced' | 'calm'
  const [customKeywords, setCustomKeywords] = useState('');

  // Steg 4: Beräknade kategorivikter (kan finjusteras i steg 4)
  const [categoryWeights, setCategoryWeights] = useState(BASE_CATEGORIES);

  // Ladda AI-konfiguration vid öppning
  useEffect(() => {
    if (!isOpen) return;
    const fetchAiConfig = async () => {
      try {
        setCheckingAi(true);
        const res = await api.get('/ai/config');
        if (res.data) {
          setAiHealthy(Boolean(res.data.is_healthy));
          setAiUrl(res.data.lm_studio_url || 'http://host.docker.internal:1234');
          setAvailableModels(res.data.available_models || []);
          if (res.data.lm_studio_model) {
            setSelectedModel(res.data.lm_studio_model);
          } else if (res.data.available_models && res.data.available_models.length > 0) {
            setSelectedModel(res.data.available_models[0]);
          }
          if (res.data.push_summary_type) {
            setPushSummaryType(res.data.push_summary_type);
          }
        }
      } catch (err) {
        console.error('Kunde inte läsa AI-konfiguration i guiden:', err);
      } finally {
        setCheckingAi(false);
      }
    };
    fetchAiConfig();
  }, [isOpen]);

  // Beräkna kategorivikter dynamiskt utifrån frågebatteriet
  useEffect(() => {
    const weightsMap = {};
    BASE_CATEGORIES.forEach(c => {
      weightsMap[c.name] = 6;
    });

    // Fråga 1: Hög prioritet (+3 eller +4)
    if (highPriorityTopics.includes('tech')) weightsMap['Teknik'] = 9;
    if (highPriorityTopics.includes('economy')) weightsMap['Ekonomi'] = 9;
    if (highPriorityTopics.includes('emergency')) weightsMap['Blåljus'] = 9;
    if (highPriorityTopics.includes('local')) weightsMap['Lokalt'] = 9;
    if (highPriorityTopics.includes('politics')) {
      weightsMap['Politik'] = 7;
      weightsMap['Inrikes'] = 8;
    }
    if (highPriorityTopics.includes('science')) weightsMap['Vetenskap & Hälsa'] = 9;
    if (highPriorityTopics.includes('motor')) weightsMap['Motor'] = 8;

    // Fråga 2: Dämpade ämnen (-3 till -5)
    if (lowPriorityTopics.includes('entertainment')) weightsMap['Nöje & Kultur'] = 2;
    if (lowPriorityTopics.includes('sports')) weightsMap['Sport'] = 1;
    if (lowPriorityTopics.includes('politics_down')) weightsMap['Politik'] = 3;

    // Fråga 3: Krisläge
    if (urgencyMode === 'high') {
      weightsMap['Blåljus'] = Math.min(10, (weightsMap['Blåljus'] || 6) + 1);
    } else if (urgencyMode === 'calm') {
      weightsMap['Blåljus'] = 5;
    }

    setCategoryWeights(
      BASE_CATEGORIES.map(c => ({
        name: c.name,
        weight: weightsMap[c.name] !== undefined ? weightsMap[c.name] : c.weight
      }))
    );
  }, [highPriorityTopics, lowPriorityTopics, urgencyMode]);

  if (!isOpen) return null;

  // Skippa guiden och spara onboarding_completed = true med standardinställningar
  const handleSkip = async () => {
    try {
      setIsSaving(true);
      await api.put('/ai/config', {
        onboarding_completed: true
      });
      toast.success('Introduktionen hoppades över. Du kan konfigurera källor och AI under Inställningar när du vill.');
      window.dispatchEvent(new Event('aiConfigUpdated'));
      if (onCompleted) onCompleted();
      onClose();
    } catch (err) {
      console.error('Kunde inte hoppa över guiden:', err);
      toast.error('Ett fel uppstod vid sparandet.');
    } finally {
      setIsSaving(false);
    }
  };

  // Växla flödesval
  const toggleFeed = (url) => {
    setSelectedFeeds(prev => 
      prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
    );
  };

  // Växla helt paket
  const togglePackage = (pkg) => {
    const pkgUrls = pkg.feeds.map(f => f.url);
    const allSelected = pkgUrls.every(u => selectedFeeds.includes(u));
    if (allSelected) {
      setSelectedFeeds(prev => prev.filter(u => !pkgUrls.includes(u)));
    } else {
      setSelectedFeeds(prev => Array.from(new Set([...prev, ...pkgUrls])));
    }
  };

  // Slutför och spara allt
  const handleComplete = async () => {
    try {
      setIsSaving(true);

      // 1. Lägg till alla valda flöden
      const allFeeds = RECOMMENDED_PACKAGES.flatMap(p => p.feeds);
      const feedsToAdd = allFeeds.filter(f => selectedFeeds.includes(f.url));

      for (const feed of feedsToAdd) {
        try {
          await api.post('/feeds', {
            url: feed.url,
            title: feed.title,
            polling_interval: Math.floor(Math.random() * 15) + 15,
            scrape_enabled: true,
            include_in_dashboard: true
          });
        } catch (feedErr) {
          // Flödet kanske redan finns, fortsätt
        }
      }

      // 2. Beräkna tröskel utifrån akuthetsval
      let prioThreshold = 75;
      if (urgencyMode === 'high') prioThreshold = 70;
      if (urgencyMode === 'calm') prioThreshold = 80;

      // 3. Bygg regler
      const prioRules = customKeywords.trim();
      const excludeRules = lowPriorityTopics.includes('entertainment') ? 'Kändisskvaller, dokusåpor, röda mattan' : '';

      // 4. Spara AI-konfiguration & kategorivikter
      await api.put('/ai/config', {
        categories: categoryWeights,
        prio_rules: prioRules,
        exclude_rules: excludeRules,
        prio_threshold: prioThreshold,
        lm_studio_model: selectedModel || undefined,
        push_summary_type: pushSummaryType,
        onboarding_completed: true
      });

      toast.success('Installationen är klar! Ditt nyhetsflöde är nu igång.');
      window.dispatchEvent(new Event('feedsUpdated'));
      window.dispatchEvent(new Event('aiConfigUpdated'));
      if (onCompleted) onCompleted();
      onClose();
    } catch (err) {
      console.error('Fel vid sparande av onboarding:', err);
      toast.error('Kunde inte slutföra konfigurationen.');
    } finally {
      setIsSaving(false);
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
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
          boxSizing: 'border-box'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.22 }}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '720px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
            boxSizing: 'border-box',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {/* Header */}
          <div 
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-app)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div 
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Compass size={22} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Välkommen till RSS-Bevakaren
                </h2>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Installationsguide för flöden, lokal AI och din personliga nyhetsprofil
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleSkip}
                disabled={isSaving}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  textDecoration: 'underline',
                  padding: '0.35rem 0.5rem'
                }}
                title="Hoppa över och använd standardinställningar"
              >
                Hoppa över
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={isSaving}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.35rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Stäng och hoppa över"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Steg-indikator */}
          <div 
            style={{
              display: 'flex',
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--bg-app)',
              borderBottom: '1px solid var(--border-color)',
              gap: '0.5rem'
            }}
          >
            {[
              { num: 1, label: 'Källor' },
              { num: 2, label: 'Lokal AI' },
              { num: 3, label: 'Intresseprofil' },
              { num: 4, label: 'Granska & Starta' }
            ].map(s => {
              const isActive = step === s.num;
              const isDone = step > s.num;
              return (
                <div 
                  key={s.num}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.35rem 0.5rem',
                    borderRadius: '8px',
                    backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                    border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                    opacity: isActive || isDone ? 1 : 0.55
                  }}
                >
                  <div 
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: isDone ? '#16a34a' : (isActive ? 'var(--primary)' : 'var(--border-color)'),
                      color: 'white',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {isDone ? <Check size={13} /> : s.num}
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 600 : 500, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Huvudinnehåll (scrollbart) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', boxSizing: 'border-box' }}>
            {/* STEG 1: FLÖDESREKOMMENDATIONER */}
            {step === 1 && (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    Steg 1: Välj dina första nyhetskällor
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Välj bland rekommenderade svenska kvalitetsflöden. Du kan välja hela temapaket eller plocka enskilda redaktioner.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {RECOMMENDED_PACKAGES.map(pkg => {
                    const pkgUrls = pkg.feeds.map(f => f.url);
                    const selectedCount = pkgUrls.filter(u => selectedFeeds.includes(u)).length;
                    const allSelected = selectedCount === pkgUrls.length;

                    return (
                      <div 
                        key={pkg.id}
                        style={{
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '1rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                              {pkg.title}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {pkg.description}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => togglePackage(pkg)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: allSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                              color: allSelected ? 'var(--primary)' : 'var(--text-main)',
                              fontSize: '0.78rem',
                              fontWeight: 500,
                              cursor: 'pointer'
                            }}
                          >
                            {allSelected ? 'Avmarkera paket' : 'Välj alla i paketet'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                          {pkg.feeds.map(feed => {
                            const isChecked = selectedFeeds.includes(feed.url);
                            return (
                              <button
                                key={feed.url}
                                type="button"
                                onClick={() => toggleFeed(feed.url)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  padding: '0.4rem 0.75rem',
                                  borderRadius: '20px',
                                  fontSize: '0.82rem',
                                  backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                                  border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                  color: isChecked ? 'var(--primary)' : 'var(--text-main)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                {isChecked ? <Check size={14} /> : <Plus size={14} />}
                                <span>{feed.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEG 2: AI-MOTOR */}
            {step === 2 && (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    Steg 2: Kontrollera din lokala AI-motor
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    RSS-Bevakaren använder lokal AI (LM Studio eller motsvarande) för sammanfattningar, taggar och prioritering helt privat på din egen maskin.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                  {/* Statusbox */}
                  <div 
                    style={{
                      padding: '1.1rem',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.9rem'
                    }}
                  >
                    <div 
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: aiHealthy ? 'rgba(22, 163, 74, 0.12)' : 'rgba(234, 179, 8, 0.15)',
                        color: aiHealthy ? '#16a34a' : '#ca8a04',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {aiHealthy ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                          {aiHealthy ? 'Ansluten till LM Studio' : 'LM Studio är för närvarande offline'}
                        </span>
                        <span 
                          style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: aiHealthy ? '#16a34a' : '#eab308'
                          }}
                        />
                      </div>
                      <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Adress: <code style={{ backgroundColor: 'var(--bg-card)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{aiUrl}</code>
                      </p>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        {aiHealthy 
                          ? 'AI-motorn är redo att börja analysera och prioritera nyheter direkt.'
                          : 'Du kan fortsätta ändå. Systemet fungerar som en blixtsnabb RSS-läsare, och AI-analysen startar automatiskt i bakgrunden så fort du startar LM Studio på din dator.'}
                      </p>
                    </div>
                  </div>

                  {/* Modellval */}
                  {availableModels.length > 0 && (
                    <div 
                      style={{
                        padding: '1.1rem',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                        Vald språkmodell i LM Studio
                      </label>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.6rem 0.8rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-main)',
                          fontSize: '0.88rem'
                        }}
                      >
                        {availableModels.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Notisformat */}
                  <div 
                    style={{
                      padding: '1.1rem',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                      Notissammanfattning i mobilen och på klockan
                    </label>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Välj hur korta du vill att push-notiserna från AI-analysen ska vara:
                    </p>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setPushSummaryType('short')}
                        style={{
                          flex: 1,
                          minWidth: '200px',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: pushSummaryType === 'short' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: pushSummaryType === 'short' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          Kompakt notis (1 mening)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Kärnkoncentrerad snabbläsning optimerad för låsskärm och smartklocka.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPushSummaryType('full')}
                        style={{
                          flex: 1,
                          minWidth: '200px',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: pushSummaryType === 'full' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: pushSummaryType === 'full' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          Full sammanfattning (2–3 meningar)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Mer detaljerad bakgrund och sammanhang direkt i notisen.
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEG 3: FRÅGEBATTERI FÖR INTRESSEPROFIL */}
            {step === 3 && (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    Steg 3: Skapa din personliga intresseprofil
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Som standard har alla kategorier en neutral baslinje (6/10). Svara på 4 snabba frågor så anpassar vi vikterna och prioriteringsreglerna automatiskt efter din smak.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Fråga 1 */}
                  <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                      1. Vilka ämnesområden prioriterar du högst i din vardag?
                    </label>
                    <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Välj ett eller flera områden som ska tilldelas högsta prioritet (8–9 poäng).
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                      {[
                        { id: 'tech', label: 'Teknik & Digitalisering' },
                        { id: 'emergency', label: 'Trygghet, blåljus & larm' },
                        { id: 'economy', label: 'Ekonomi, marknad & börs' },
                        { id: 'local', label: 'Lokala nyheter & närområde' },
                        { id: 'politics', label: 'Samhälle & inrikespolitik' },
                        { id: 'science', label: 'Forskning & hälsa' },
                        { id: 'motor', label: 'Motor & fordon' }
                      ].map(item => {
                        const isSelected = highPriorityTopics.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setHighPriorityTopics(prev => 
                                prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id]
                              );
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '20px',
                              fontSize: '0.82rem',
                              backgroundColor: isSelected ? 'rgba(22, 163, 74, 0.12)' : 'var(--bg-card)',
                              border: isSelected ? '1px solid #16a34a' : '1px solid var(--border-color)',
                              color: isSelected ? '#16a34a' : 'var(--text-main)',
                              cursor: 'pointer',
                              fontWeight: isSelected ? 600 : 400
                            }}
                          >
                            {isSelected && <Check size={13} />}
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fråga 2 */}
                  <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                      2. Vilka typer av nyheter vill du helst tona ner eller slippa?
                    </label>
                    <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Dessa områden får kraftigt sänkta poäng (1–2 poäng) så att de inte stör ditt flöde.
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                      {[
                        { id: 'entertainment', label: 'Kändisnyheter, nöje & skvaller' },
                        { id: 'sports', label: 'Sportresultat & matchtabeller' },
                        { id: 'politics_down', label: 'Partipolitiska utspel' },
                        { id: 'clickbait', label: 'ClickBait & klickrubriker' }
                      ].map(item => {
                        const isSelected = lowPriorityTopics.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setLowPriorityTopics(prev => 
                                prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id]
                              );
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '20px',
                              fontSize: '0.82rem',
                              backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-card)',
                              border: isSelected ? '1px solid #ef4444' : '1px solid var(--border-color)',
                              color: isSelected ? '#ef4444' : 'var(--text-main)',
                              cursor: 'pointer',
                              fontWeight: isSelected ? 600 : 400
                            }}
                          >
                            {isSelected && <Check size={13} />}
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fråga 3 */}
                  <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                      3. Hur ska akuta händelser och krislarm hanteras?
                    </label>
                    <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Styr hur lätt akuta larm bryter igenom till notiser.
                    </p>

                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      {[
                        { id: 'high', title: 'Maximal bevakning', desc: 'Blåljus prioriteras alltid högst' },
                        { id: 'balanced', title: 'Balanserat normalläge', desc: 'Behandlas som övriga nyheter' },
                        { id: 'calm', title: 'Fokusläge', desc: 'Endast bekräftade rikskriser' }
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setUrgencyMode(m.id)}
                          style={{
                            flex: 1,
                            minWidth: '180px',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '8px',
                            border: urgencyMode === m.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: urgencyMode === m.id ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                            textAlign: 'left',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                            {m.title}
                          </div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            {m.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fråga 4 */}
                  <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                      4. Har du några särskilda hjärtefrågor eller bevakningsord? (Valfritt)
                    </label>
                    <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Skriv in specifika ämnen, företag eller orter som AI:n alltid ska hålla extra utkik efter.
                    </p>

                    <input
                      type="text"
                      placeholder="T.ex. Solceller, AI-agenter, Göteborg, Cybersäkerhet, Volvo..."
                      value={customKeywords}
                      onChange={(e) => setCustomKeywords(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '0.88rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEG 4: FÖRHANDSGRANSKNING & SLUTFÖR */}
            {step === 4 && (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    Steg 4: Granska din profil och starta
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Här ser du hur dina svar har format kategorivikterna. Du kan justera reglagen manuellt om du vill finlira innan du startar.
                  </p>
                </div>

                {/* Summeringskort */}
                <div 
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.75rem',
                    marginBottom: '1.25rem'
                  }}
                >
                  <div style={{ padding: '0.85rem', borderRadius: '10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Valda källor</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--primary)', marginTop: '0.2rem' }}>
                      {selectedFeeds.length} st källor
                    </div>
                  </div>

                  <div style={{ padding: '0.85rem', borderRadius: '10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lokal AI-status</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, color: aiHealthy ? '#16a34a' : '#ca8a04', marginTop: '0.2rem' }}>
                      {aiHealthy ? 'Ansluten' : 'Offline (valfri)'}
                    </div>
                  </div>

                  <div style={{ padding: '0.85rem', borderRadius: '10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Notisstil</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                      {pushSummaryType === 'short' ? 'Kompakt (1 mening)' : 'Fullständig'}
                    </div>
                  </div>
                </div>

                {/* Kategorireglage */}
                <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '0.8rem' }}>
                    Resulterande kategorivikter (1–10)
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                    {categoryWeights.map((cat, idx) => (
                      <div 
                        key={cat.name}
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 500, color: 'var(--text-main)' }}>
                            {cat.name}
                          </span>
                          <span 
                            style={{
                              fontSize: '0.84rem',
                              fontWeight: 700,
                              color: cat.weight >= 8 ? '#16a34a' : (cat.weight <= 3 ? '#ef4444' : 'var(--primary)')
                            }}
                          >
                            {cat.weight} / 10
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={cat.weight}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setCategoryWeights(prev => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], weight: val };
                              return copy;
                            });
                          }}
                          style={{
                            width: '100%',
                            accentColor: cat.weight >= 8 ? '#16a34a' : (cat.weight <= 3 ? '#ef4444' : 'var(--primary)'),
                            cursor: 'pointer'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer med åtgärdsknappar */}
          <div 
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-app)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}
          >
            {/* Vänster sida: Skippa */}
            <button
              type="button"
              onClick={handleSkip}
              disabled={isSaving}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.84rem',
                textDecoration: 'underline',
                padding: '0.4rem 0.2rem'
              }}
            >
              Hoppa över introduktionen
            </button>

            {/* Höger sida: Föregående / Nästa / Slutför */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(prev => prev - 1)}
                  disabled={isSaving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.6rem 1.1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <ChevronLeft size={16} />
                  <span>Föregående</span>
                </button>
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep(prev => prev + 1)}
                  disabled={isSaving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <span>Nästa</span>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={isSaving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.65rem 1.4rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#16a34a',
                    color: 'white',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
                  }}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>Sparar profil...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Spara och starta bevakningen</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default OnboardingWizard;
