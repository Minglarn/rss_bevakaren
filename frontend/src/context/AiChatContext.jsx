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

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const historyPayload = newMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.post('/ai/chat', {
        message: textToSend,
        history: historyPayload
      });

      const assistantMessage = {
        role: 'assistant',
        content: res.data.reply || 'Inget svar kunde genereras.',
        sources: res.data.sources || [],
        model: res.data.model || activeModel || 'Lokal AI',
        follow_ups: res.data.follow_ups || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages([...newMessages, assistantMessage]);
      if (res.data.model) {
        setActiveModel(res.data.model);
      }
    } catch (err) {
      console.error("AI Chat error:", err);
      const errorMessage = {
        role: 'assistant',
        content: 'Kunde inte kommunicera med AI-tjänsten. Kontrollera att LM Studio körs och är tillgänglig på det lokala nätverket.',
        sources: [],
        model: 'Fel',
        isError: true,
        follow_ups: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([...newMessages, errorMessage]);
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
