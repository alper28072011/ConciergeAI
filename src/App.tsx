/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SettingsModal } from './components/SettingsModal';
import { ApiSettings } from './types';
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from './firebase';
import { LetterModule } from './modules/LetterModule';
import { GuestListModule } from './modules/GuestListModule';
import { TemplateModule } from './modules/TemplateModule';
import { DashboardModule } from './modules/DashboardModule';
import { PhonebookModule } from './modules/PhonebookModule';
import { CaseTrackingModule } from './modules/CaseTrackingModule';
import { motion, AnimatePresence } from 'framer-motion';
import { listenToCases } from './services/firebaseService';
import { AppSidebar } from './components/AppSidebar';

// A wrapper component to handle the header title based on location
function AppContent({ openCasesCount, isSettingsOpen, setIsSettingsOpen }: any) {
  const location = useLocation();
  
  const getHeaderTitle = () => {
    switch (location.pathname) {
      case '/': return 'İş Zekası & Analitik';
      case '/letters': return 'Misafir Mektubu Asistanı';
      case '/guests': return 'Misafir Listesi';
      case '/templates': return 'Şablon Yöneticisi';
      case '/cases': return 'Vaka Takibi';
      case '/phonebook': return 'Telefon Defteri & Departmanlar';
      default: return 'Otel CRM Platformu';
    }
  };

  return (
    <div className="h-screen w-full bg-slate-100 flex font-sans overflow-hidden">
      <AppSidebar openCasesCount={openCasesCount} onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-white h-16 flex items-center justify-between px-8 shrink-0 border-b border-slate-200 z-10">
          <div>
            <h1 className="font-bold text-xl text-slate-800 tracking-tight">
              {getHeaderTitle()}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Otel CRM Platformu</p>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Additional header actions can go here */}
             <div id="header-actions-portal"></div>
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
            <Routes location={location}>
              <Route path="/" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex-1 flex w-full h-full"
                >
                  <DashboardModule />
                </motion.div>
              } />
              <Route path="/guests" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex-1 flex w-full h-full"
                >
                  <GuestListModule />
                </motion.div>
              } />
              <Route path="/letters" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex-1 flex w-full h-full"
                >
                  <LetterModule />
                </motion.div>
              } />
              <Route path="/templates" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex-1 flex w-full h-full"
                >
                  <TemplateModule />
                </motion.div>
              } />
              <Route path="/phonebook" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex-1 flex w-full h-full"
                >
                  <PhonebookModule />
                </motion.div>
              } />
              <Route path="/cases" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex-1 flex w-full h-full"
                >
                  <CaseTrackingModule />
                </motion.div>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
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

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [openCasesCount, setOpenCasesCount] = useState(0);

  useEffect(() => {
    const unsubscribe = listenToCases((cases) => {
      const openCases = cases.filter(c => c.status === 'open');
      setOpenCasesCount(openCases.length);
    });
    return () => unsubscribe();
  }, []);

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

    // Listen for settings updates from Firestore
    const unsubscribeSettings = onSnapshot(doc(db, "config", "api_settings"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const savedSettings = localStorage.getItem('hotelApiSettings');
        let currentSettings: any = {};

        if (savedSettings) {
          try {
            currentSettings = JSON.parse(savedSettings);
          } catch (e) {
            console.error('Error parsing settings', e);
          }
        }

        // Check if there are meaningful differences to avoid infinite loops
        // We compare key fields
        const hasChanges = 
          currentSettings.loginToken !== data.loginToken ||
          currentSettings.baseUrl !== data.baseUrl ||
          currentSettings.hotelId !== data.hotelId ||
          currentSettings.commentPayloadTemplate !== data.commentPayloadTemplate ||
          currentSettings.commentDetailPayloadTemplate !== data.commentDetailPayloadTemplate ||
          currentSettings.inhousePayloadTemplate !== data.inhousePayloadTemplate ||
          currentSettings.reservationPayloadTemplate !== data.reservationPayloadTemplate ||
          currentSettings.checkoutPayloadTemplate !== data.checkoutPayloadTemplate ||
          currentSettings.geminiApiKey !== data.geminiApiKey ||
          currentSettings.geminiModel !== data.geminiModel ||
          JSON.stringify(currentSettings.featureModels || {}) !== JSON.stringify(data.featureModels || {});

        if (hasChanges) {
          console.log("Syncing settings from Firestore...");
          // Merge data with existing settings
          const newSettings = { ...currentSettings, ...data };
          // Remove updatedAt from local storage if it exists to keep it clean
          delete newSettings.updatedAt;
          
          localStorage.setItem('hotelApiSettings', JSON.stringify(newSettings));
          
          // Dispatch a custom event so other components can react if needed
          window.dispatchEvent(new Event('hotelApiSettingsUpdated'));
        }
      }
    });

    // Listen for sub-room mappings updates from Firestore
    const unsubscribeMappings = onSnapshot(doc(db, "config", "sub_room_mappings"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.mappings && Array.isArray(data.mappings)) {
          const savedMappings = localStorage.getItem('subRoomMappings');
          let currentMappings: any[] = [];
          
          if (savedMappings) {
            try {
              currentMappings = JSON.parse(savedMappings);
            } catch (e) {
              console.error('Error parsing subRoomMappings', e);
            }
          }

          if (JSON.stringify(currentMappings) !== JSON.stringify(data.mappings)) {
            console.log("Syncing sub-room mappings from Firestore...");
            localStorage.setItem('subRoomMappings', JSON.stringify(data.mappings));
            window.dispatchEvent(new Event('hotelApiSettingsUpdated'));
          }
        }
      }
    });

    return () => {
      unsubscribeSettings();
      unsubscribeMappings();
    };
  }, []);

  return (
    <Router>
      <AppContent 
        openCasesCount={openCasesCount} 
        isSettingsOpen={isSettingsOpen} 
        setIsSettingsOpen={setIsSettingsOpen} 
      />
    </Router>
  );
}
