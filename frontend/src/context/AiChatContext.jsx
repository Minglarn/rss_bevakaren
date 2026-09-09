import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api';

const AiChatContext = createContext();

const STORAGE_KEY = 'rss_ai_chat_messages';

export const AiChatProvider = ({ children }) => {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [activeModel, setActiveModel] = useState('');
  const [aiHealthy, setAiHealthy] = useState(true);

  // Spara historik i sessionStorage vid ändringar
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('Could not save chat history to sessionStorage', e);
    }
  }, [messages]);

  // Kontrollera LM Studio hälsa vid start
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.get('/ai/config');
        if (res.data) {
          setAiHealthy(res.data.is_healthy);
          if (res.data.lm_studio_model) {
            setActiveModel(res.data.lm_studio_model);
          } else if (res.data.available_models && res.data.available_models.length > 0) {
            setActiveModel(res.data.available_models[0]);
          }
        }
      } catch {
        setAiHealthy(false);
      }
    };
    checkHealth();
  }, []);

  const sendMessage = async (userText) => {
    const textToSend = (userText || '').trim();
    if (!textToSend || isLoading) return;

    const userMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const initialAssistantMessage = {
      role: 'assistant',
      content: '',
      sources: [],
      follow_ups: [],
      progress: 0,
      isStreaming: true,
      model: activeModel || 'Lokal AI',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedWithUserAndBot = [...messages, userMessage, initialAssistantMessage];
    setMessages(updatedWithUserAndBot);
    setIsLoading(true);

    const historyPayload = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: textToSend,
          history: historyPayload
        })
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let currentContent = '';
      let currentSources = [];
      let currentModel = activeModel || 'Lokal AI';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Spara ofullständig rad

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const ev = JSON.parse(jsonStr);
            if (ev.type === 'sources') {
              currentSources = ev.sources || [];
              setMessages(prev => {
                const list = [...prev];
                const last = list[list.length - 1];
                if (last && last.role === 'assistant') {
                  list[list.length - 1] = { ...last, sources: currentSources };
                }
                return list;
              });
            } else if (ev.type === 'progress') {
              const pct = typeof ev.percent === 'number' ? ev.percent : 0;
              setMessages(prev => {
                const list = [...prev];
                const last = list[list.length - 1];
                if (last && last.role === 'assistant') {
                  list[list.length - 1] = { ...last, progress: pct };
                }
                return list;
              });
            } else if (ev.type === 'token') {
              currentContent += ev.content;
              setMessages(prev => {
                const list = [...prev];
                const last = list[list.length - 1];
                if (last && last.role === 'assistant') {
                  list[list.length - 1] = { 
                    ...last, 
                    content: currentContent,
                    progress: 100
                  };
                }
                return list;
              });
            } else if (ev.type === 'done') {
              currentContent = ev.reply || currentContent;
              if (ev.model) currentModel = ev.model;
              setMessages(prev => {
                const list = [...prev];
                const last = list[list.length - 1];
                if (last && last.role === 'assistant') {
                  list[list.length - 1] = {
                    ...last,
                    content: currentContent,
                    sources: ev.sources || currentSources,
                    follow_ups: ev.follow_ups || [],
                    model: currentModel,
                    progress: null,
                    isStreaming: false
                  };
                }
                return list;
              });
              if (ev.model) setActiveModel(ev.model);
            } else if (ev.type === 'error') {
              throw new Error(ev.message || 'Ett fel uppstod');
            }
          } catch (parseErr) {
            console.warn('Could not parse SSE chunk', parseErr);
          }
        }
      }
    } catch (err) {
      console.warn("SSE Stream misslyckades, provar fallback till standard POST /ai/chat:", err);
      try {
        const res = await api.post('/ai/chat', {
          message: textToSend,
          history: historyPayload
        });

        setMessages(prev => {
          const list = [...prev];
          const last = list[list.length - 1];
          if (last && last.role === 'assistant') {
            list[list.length - 1] = {
              ...last,
              content: res.data.reply || 'Inget svar kunde genereras.',
              sources: res.data.sources || [],
              model: res.data.model || activeModel || 'Lokal AI',
              follow_ups: res.data.follow_ups || [],
              progress: null,
              isStreaming: false
            };
          }
          return list;
        });
        if (res.data.model) setActiveModel(res.data.model);
      } catch (fallbackErr) {
        console.error("AI Chat fallback error:", fallbackErr);
        setMessages(prev => {
          const list = [...prev];
          const last = list[list.length - 1];
          if (last && last.role === 'assistant') {
            list[list.length - 1] = {
              ...last,
              content: 'Kunde inte kommunicera med AI-tjänsten. Kontrollera att LM Studio körs och är tillgänglig på det lokala nätverket.',
              sources: [],
              model: 'Fel',
              isError: true,
              follow_ups: [],
              progress: null,
              isStreaming: false
            };
          }
          return list;
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return (
    <AiChatContext.Provider value={{
      messages,
      setMessages,
      isLoading,
      activeModel,
      setActiveModel,
      aiHealthy,
      sendMessage,
      clearMessages
    }}>
      {children}
    </AiChatContext.Provider>
  );
};

export const useAiChat = () => {
  const context = useContext(AiChatContext);
  if (!context) {
    throw new Error('useAiChat must be used within an AiChatProvider');
  }
  return context;
};
