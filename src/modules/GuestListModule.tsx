import React from 'react';
import { Users, Construction } from 'lucide-react';

export function GuestListModule() {
  return (
    <div className="flex-1 bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-slate-100 rounded-full mb-6">
          <Users size={48} className="text-slate-400" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-800 mb-2">Misafir Listesi Modülü</h2>
        <p className="text-slate-500 mb-6">Bu modül şu anda geliştirilme aşamasında.</p>
        <div className="inline-flex items-center gap-2 text-sm text-slate-400 bg-slate-100 px-4 py-2 rounded-lg">
          <Construction size={16} />
          <span>Yakında kullanıma sunulacak</span>
        </div>
      </div>
    </div>
  );
}
