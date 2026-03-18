/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { ApiSettings } from './types';
import { Settings, Hotel, Mail, Users, LayoutTemplate } from 'lucide-react';
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from './firebase';
import { LetterModule } from './modules/LetterModule';
import { GuestListModule } from './modules/GuestListModule';
import { TemplateModule } from './modules/TemplateModule';
import { DashboardModule } from './modules/DashboardModule';
import { PhonebookModule } from './modules/PhonebookModule';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, PhoneCall } from 'lucide-react';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<'dashboard' | 'letters' | 'guestlist' | 'templates' | 'phonebook'>('dashboard');

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

      // Sync to Firestore for other instances
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

      // Clean URL
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }

    // Listen for token updates from Firestore
    const unsubscribe = onSnapshot(doc(db, "config", "api_settings"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.loginToken) {
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

          // Only update if different
          if (settings.loginToken !== data.loginToken) {
            console.log("Syncing new token from Firestore...");
            settings.loginToken = data.loginToken;
            localStorage.setItem('hotelApiSettings', JSON.stringify(settings));
            // Optional: Trigger a re-fetch or notify user
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="h-screen w-full bg-slate-100 flex font-sans overflow-hidden">
      {/* Navigation Bar */}
      <nav className="w-16 bg-slate-950 flex flex-col items-center py-6 gap-6 shrink-0 z-20 shadow-xl">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-2">
          <Hotel className="text-emerald-500" size={24} />
        </div>
        
        <div className="flex flex-col gap-4 w-full px-2">
          <button 
            onClick={() => setActiveModule('dashboard')}
            className={`p-3 rounded-xl transition-all duration-200 group relative flex justify-center ${activeModule === 'dashboard' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
            title="Ana Sayfa / Dashboard"
          >
            <BarChart3 size={22} strokeWidth={activeModule === 'dashboard' ? 2.5 : 2} />
            <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Ana Sayfa / Dashboard
            </span>
          </button>

          <button 
            onClick={() => setActiveModule('letters')}
            className={`p-3 rounded-xl transition-all duration-200 group relative flex justify-center ${activeModule === 'letters' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
            title="Mektup Asistanı"
          >
            <Mail size={22} strokeWidth={activeModule === 'letters' ? 2.5 : 2} />
            {/* Tooltip */}
            <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Mektup Asistanı
            </span>
          </button>
          
          <button 
            onClick={() => setActiveModule('guestlist')}
            className={`p-3 rounded-xl transition-all duration-200 group relative flex justify-center ${activeModule === 'guestlist' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
            title="Misafir Listesi"
          >
            <Users size={22} strokeWidth={activeModule === 'guestlist' ? 2.5 : 2} />
            <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Misafir Listesi
            </span>
          </button>

          <button 
            onClick={() => setActiveModule('templates')}
            className={`p-3 rounded-xl transition-all duration-200 group relative flex justify-center ${activeModule === 'templates' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
            title="Şablon Yöneticisi"
          >
            <LayoutTemplate size={22} strokeWidth={activeModule === 'templates' ? 2.5 : 2} />
            <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Şablon Yöneticisi
            </span>
          </button>

          <button 
            onClick={() => setActiveModule('phonebook')}
            className={`p-3 rounded-xl transition-all duration-200 group relative flex justify-center ${activeModule === 'phonebook' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
            title="Telefon Defteri"
          >
            <PhoneCall size={22} strokeWidth={activeModule === 'phonebook' ? 2.5 : 2} />
            <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Telefon Defteri
            </span>
          </button>
        </div>

        <div className="mt-auto mb-4">
           <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-all duration-200 group relative flex justify-center"
            title="Ayarlar"
          >
            <Settings size={22} />
            <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Ayarlar
            </span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-white h-16 flex items-center justify-between px-8 shrink-0 border-b border-slate-200 z-10">
          <div>
            <h1 className="font-bold text-xl text-slate-800 tracking-tight">
              {activeModule === 'dashboard' ? 'İş Zekası & Analitik' : activeModule === 'letters' ? 'Misafir Mektubu Asistanı' : activeModule === 'guestlist' ? 'Misafir Listesi' : activeModule === 'templates' ? 'Şablon Yöneticisi' : 'Telefon Defteri & Departmanlar'}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Otel CRM Platformu</p>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Additional header actions can go here */}
             <div className="px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Online
                </span>
             </div>
          </div>
        </header>

        {/* Module Content */}
        <main className="flex-1 flex overflow-hidden relative bg-slate-50">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex-1 flex w-full h-full"
            >
              {activeModule === 'dashboard' && <DashboardModule />}
              {activeModule === 'letters' && <LetterModule />}
              {activeModule === 'guestlist' && <GuestListModule />}
              {activeModule === 'templates' && <TemplateModule />}
              {activeModule === 'phonebook' && <PhonebookModule />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={(settings) => {
          console.log('Settings saved:', settings);
          // Force re-render or notify modules if needed, 
          // but modules fetch fresh settings on each request via executeElektraQuery
        }} 
      />
    </div>
  );
}
