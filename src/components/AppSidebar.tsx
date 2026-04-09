import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Hotel, BarChart3, Mail, Briefcase, Users, LayoutTemplate, PhoneCall, Settings } from 'lucide-react';

interface AppSidebarProps {
  openCasesCount: number;
  onOpenSettings: () => void;
}

export function AppSidebar({ openCasesCount, onOpenSettings }: AppSidebarProps) {
  const location = useLocation();

  return (
    <nav className="w-16 bg-slate-950 flex flex-col items-center py-6 gap-6 shrink-0 z-20 shadow-xl">
      <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-2">
        <Hotel className="text-emerald-500" size={24} />
      </div>
      
      <div className="flex flex-col gap-4 w-full px-2">
        <Link 
          to="/"
          className={`p-3 rounded-xl transition-all duration-200 group relative flex justify-center ${location.pathname === '/' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
          title="Ana Sayfa / Dashboard"
        >
          <BarChart3 size={22} strokeWidth={location.pathname === '/' ? 2.5 : 2} />
          <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            Ana Sayfa / Dashboard
          </span>
        </Link>

        <Link 
          to="/letters"
          className={`p-3 rounded-xl transition-all duration-200 group relative flex justify-center ${location.pathname === '/letters' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
          title="Mektup Asistanı"
        >
          <Mail size={22} strokeWidth={location.pathname === '/letters' ? 2.5 : 2} />
          <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            Mektup Asistanı
          </span>
        </Link>

        <Link 
          to="/cases"
          className={`p-3 rounded-xl transition-all duration-200 group relative flex justify-center ${location.pathname === '/cases' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
          title="Vaka Takibi"
        >
          <div className="relative">
            <Briefcase size={22} strokeWidth={location.pathname === '/cases' ? 2.5 : 2} />
            {openCasesCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-slate-950">
                {openCasesCount}
              </span>
            )}
          </div>
          <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            Vaka Takibi
          </span>
        </Link>
        
        <Link 
          to="/guests"
          className={`p-3 rounded-xl transition-all duration-200 group relative flex justify-center ${location.pathname === '/guests' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
          title="Misafir Listesi"
        >
          <Users size={22} strokeWidth={location.pathname === '/guests' ? 2.5 : 2} />
          <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            Misafir Listesi
          </span>
        </Link>

        <Link 
          to="/templates"
          className={`p-3 rounded-xl transition-all duration-200 group relative flex justify-center ${location.pathname === '/templates' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
          title="Şablon Yöneticisi"
        >
          <LayoutTemplate size={22} strokeWidth={location.pathname === '/templates' ? 2.5 : 2} />
          <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            Şablon Yöneticisi
          </span>
        </Link>

        <Link 
          to="/phonebook"
          className={`p-3 rounded-xl transition-all duration-200 group relative flex justify-center ${location.pathname === '/phonebook' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
          title="Telefon Defteri"
        >
          <PhoneCall size={22} strokeWidth={location.pathname === '/phonebook' ? 2.5 : 2} />
          <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            Telefon Defteri
          </span>
        </Link>
      </div>

      <div className="mt-auto mb-4">
         <button 
          onClick={onOpenSettings}
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
  );
}
