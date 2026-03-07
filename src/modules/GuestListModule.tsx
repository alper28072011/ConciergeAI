import React from 'react';
import { Users } from 'lucide-react';

export function GuestListModule() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-full w-full">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users size={32} className="text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Misafir Listesi</h2>
        <p className="text-slate-500">Bu modül şu anda geliştirme aşamasındadır. Yakında burada misafir listesi ve detaylarını görüntüleyebileceksiniz.</p>
      </div>
    </div>
  );
}
