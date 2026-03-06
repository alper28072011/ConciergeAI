import React, { useState, useEffect } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { LetterModule } from './modules/LetterModule';
import { GuestListModule } from './modules/GuestListModule';
import { ApiSettings } from './types';
import { Settings, Hotel, Mail, Users } from 'lucide-react';
import { doc, setDoc } from "firebase/firestore";
import { db } from './firebase';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<'letters' | 'guests'>('letters');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      const savedSettings = localStorage.getItem('hotelApiSettings');
      let settings: ApiSettings = {
        baseUrl: '',
        loginToken: '',
        hotelId: ''
      };

      if (savedSettings) {
        try {
          settings = JSON.parse(savedSettings);
        } catch (e) {
          console.error('Error parsing settings', e);
        }
      }

      settings.loginToken = token;
      localStorage.setItem('hotelApiSettings', JSON.stringify(settings));

      const syncToken = async () => {
        try {
          await setDoc(doc(db, "config", "api_settings"), {
            loginToken: token,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          console.log("Token synced to Firestore from URL");
        } catch (error) {
          console.error("Error syncing token to Firestore:", error);
        }
      };
      syncToken();

      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, []);

  const navigationItems = [
    { id: 'letters' as const, icon: Mail, label: 'Mektup Asistanı' },
    { id: 'guests' as const, icon: Users, label: 'Misafir Listesi' }
  ];

  return (
    <div className="h-screen w-full bg-slate-100 flex font-sans overflow-hidden">
      <nav className="w-16 bg-slate-950 flex flex-col items-center py-4 shrink-0 print:hidden">
        <div className="mb-8 p-2 bg-white/10 rounded-lg">
          <Hotel size={24} className="text-white" />
        </div>

        <div className="flex-1 flex flex-col gap-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`group relative w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-lg'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
                title={item.label}
              >
                <Icon size={20} />

                <div className="absolute left-full ml-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl z-50">
                  {item.label}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center group relative"
          title="API Ayarları"
        >
          <Settings size={20} />

          <div className="absolute left-full ml-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl z-50">
            API Ayarları
          </div>
        </button>
      </nav>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white h-14 flex items-center px-6 shrink-0 border-b border-slate-200 print:hidden">
          <h1 className="font-semibold text-slate-900">
            {navigationItems.find(item => item.id === activeModule)?.label}
          </h1>
        </header>

        <main className="flex-1 flex overflow-hidden">
          {activeModule === 'letters' ? <LetterModule /> : <GuestListModule />}
        </main>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(settings) => {
          console.log('Settings saved:', settings);
        }}
      />
    </div>
  );
}
