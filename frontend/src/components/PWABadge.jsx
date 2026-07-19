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
    <div className="fixed bottom-4 right-4 z-50 bg-[#1e1e1e] border border-[#333] shadow-lg rounded-xl p-4 flex flex-col gap-3 max-w-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-white font-medium text-sm">Ny uppdatering tillgänglig!</h3>
          <p className="text-gray-400 text-xs mt-1">
            Klicka på ladda om för att uppdatera appen till den senaste versionen.
          </p>
        </div>
        <button onClick={close} className="text-gray-400 hover:text-white transition-colors" aria-label="Stäng">
          <X size={16} />
        </button>
      </div>
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors w-full"
        onClick={() => updateServiceWorker(true)}
      >
        <RefreshCw size={14} />
        <span>Ladda om appen</span>
      </button>
    </div>
  );
}
