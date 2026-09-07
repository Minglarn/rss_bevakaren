import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Sparkles, Check, X, ThumbsUp, ThumbsDown, Tag, ArrowRight, Loader2 } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

const DEFAULT_CATEGORIES = ['Teknik', 'Politik', 'Blåljus', 'Lokalt', 'Ekonomi', 'Nöje', 'Övrigt'];

const PrioOnboardingModal = ({ isOpen, onClose, onSaved }) => {
  const [prioRules, setPrioRules] = useState('');
  const [excludeRules, setExcludeRules] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(DEFAULT_CATEGORIES);
  const [newCatInput, setNewCatInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const toggleCategory = (cat) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length === 1) {
        toast.error('Du måste ha minst en kategori vald');
        return;
      }
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    const c = newCatInput.trim();
    if (!c) return;
    if (selectedCategories.some(cat => cat.toLowerCase() === c.toLowerCase())) {
      toast.error('Kategorin finns redan');
      return;
    }
    setSelectedCategories([...selectedCategories, c]);
    setNewCatInput('');
  };

  const handleSave = async (isDefault = false) => {
    try {
      setIsSaving(true);
      const payload = {
        prio_rules: isDefault ? '' : prioRules.trim(),
        exclude_rules: isDefault ? '' : excludeRules.trim(),
        categories: selectedCategories.length > 0 ? selectedCategories : DEFAULT_CATEGORIES,
        prio_threshold: 75,
        onboarding_completed: true
      };

      await api.put('/ai/config', payload);
      toast.success(isDefault ? 'Standardregler aktiverade för ditt Prio Flöde' : 'Dina personliga AI-prioriteringar har sparats!');
      window.dispatchEvent(new Event('aiConfigUpdated'));
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Kunde inte spara onboarding-inställningar', err);
      toast.error('Ett fel uppstod när inställningarna skulle sparas');
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
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
          boxSizing: 'border-box'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            boxSizing: 'border-box',
            position: 'relative'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div 
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(249, 115, 22, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f97316'
                }}
              >
                <Flame size={24} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  Personligt Prio Flöde
                </h2>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Träna AI:n att lyfta fram exakt de nyheter som är viktiga för dig.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleSave(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.35rem',
                borderRadius: '6px'
              }}
              title="Stäng och använd standard"
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Fråga 1: Vad är Hög Prio? */}
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                <ThumbsUp size={16} style={{ color: '#16a34a' }} /> Vad är HÖG prioritet för dig?
              </label>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.6rem 0' }}>
                Beskriv ämnen, företag, teknologier eller specifika geografiska platser som alltid ska lyftas fram.
              </p>
              <textarea
                value={prioRules}
                onChange={(e) => setPrioRules(e.target.value)}
                placeholder="T.ex. Elbilar och Tesla, nyheter om Göteborg, IT-säkerhet, rymdfart och viktiga samhällsvarningar..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem',
                  lineHeight: '1.4',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Fråga 2: Vad är Låg Prio? */}
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                <ThumbsDown size={16} style={{ color: '#ef4444' }} /> Vad vill du NEDPRIORITERA (Låg prioritet)?
              </label>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.6rem 0' }}>
                Ämnen som du inte vill bli störd av i ditt prioriterade flöde.
              </p>
              <textarea
                value={excludeRules}
                onChange={(e) => setExcludeRules(e.target.value)}
                placeholder="T.ex. Kändisskvaller, melodifestivalen, vardagliga fotbollsresultat, horoskop eller recept..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem',
                  lineHeight: '1.4',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Fråga 3: Kategorier */}
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                <Tag size={16} style={{ color: 'var(--primary)' }} /> Välj dina intressekategorier
              </label>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.6rem 0' }}>
                Klicka på en kategori för att välja eller välja bort den som filter i Prio Flödet.
              </p>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.75rem' }}>
                {selectedCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      backgroundColor: 'rgba(249, 115, 22, 0.15)',
                      border: '1px solid rgba(249, 115, 22, 0.4)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>{cat}</span>
                    <X size={13} style={{ color: 'var(--text-muted)' }} />
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Lägg till egen kategori..."
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(e); }}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Lägg till
                </button>
              </div>
            </div>
          </div>

          {/* Footer med åtgärder */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '1.75rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}
          >
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                textDecoration: 'underline',
                padding: '0.4rem 0.2rem'
              }}
            >
              Använd standardregler
            </button>

            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.7rem 1.4rem',
                backgroundColor: '#f97316',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.92rem',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.35)',
                transition: 'all 0.15s'
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Sparar preferenser...</span>
                </>
              ) : (
                <>
                  <span>Aktivera Mitt Prio Flöde</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PrioOnboardingModal;
