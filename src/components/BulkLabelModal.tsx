import React, { useState } from 'react';
import { GuestData } from '../types';
import { X, Printer, LayoutGrid, Info } from 'lucide-react';
import { motion } from 'framer-motion';

interface BulkLabelModalProps {
  guests: GuestData[];
  onClose: () => void;
}

export const BulkLabelModal: React.FC<BulkLabelModalProps> = ({ guests, onClose }) => {
  const [startCol, setStartCol] = useState<number>(0); // 0=A, 1=B, 2=C
  const [startRow, setStartRow] = useState<number>(1); // 1-12

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Lütfen açılır pencerelere (pop-up) izin verin.");
      return;
    }

    const pagesHtml = pages.map((page, pageIndex) => `
      <div class="page">
        <div class="grid">
          ${page.map(cell => `
            <div class="cell">
              ${cell ? `<span>${formatLabel(cell)}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiket Yazdır</title>
          <style>
            @page { 
              size: A4; 
              margin: 0; 
            }
            body { 
              margin: 0; 
              padding: 0; 
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
              background: white;
            }
            .page { 
              width: 210mm; 
              height: 297mm; 
              padding-top: 11mm; 
              padding-bottom: 11mm; 
              box-sizing: border-box; 
              page-break-after: always; 
            }
            .grid { 
              display: grid; 
              grid-template-columns: repeat(3, 1fr); 
              grid-template-rows: repeat(12, 1fr); 
              height: 100%; 
            }
            .cell { 
              display: flex; 
              align-items: center; 
              justify-content: flex-start; 
              padding: 2mm 15mm;
              box-sizing: border-box;
              overflow: hidden;
            }
            .cell span {
              font-size: 12pt; 
              font-weight: 500; 
              text-align: left;
              color: black;
              line-height: 1.3;
              word-break: break-word;
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const startIndex = (startRow - 1) * 3 + startCol;
  const pages: (GuestData | null)[][] = [];
  let currentGuestIdx = 0;
  let isFirstPage = true;

  while (currentGuestIdx < guests.length) {
    const pageCells = [];
    const start = isFirstPage ? startIndex : 0;

    for (let i = 0; i < 36; i++) {
      if (i < start) {
        pageCells.push(null);
      } else if (currentGuestIdx < guests.length) {
        pageCells.push(guests[currentGuestIdx]);
        currentGuestIdx++;
      } else {
        pageCells.push(null);
      }
    }
    pages.push(pageCells);
    isFirstPage = false;
  }

  const formatLabel = (guest: GuestData) => {
    const room = guest.ROOMNO || 'Bilinmiyor';
    const names = guest.GUESTNAMES || '';
    // Split by common separators and take the first part
    const firstName = names.split(/[,&/]/)[0].trim();
    return `${room} - ${firstName}`;
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <LayoutGrid size={20} className="text-blue-600" />
            Toplu Etiket Üretimi ({guests.length} Misafir)
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col md:flex-row gap-8 bg-slate-50/50">
          {/* Controls */}
          <div className="w-full md:w-1/3 space-y-6">
            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm flex gap-3 border border-blue-100">
              <Info size={20} className="shrink-0 text-blue-600" />
              <p>A4 kağıdında 3 sütun (A, B, C) ve 12 satır bulunmaktadır. Yazdırmaya başlamak istediğiniz hücreyi seçin.</p>
            </div>

            <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Başlangıç Sütunu</label>
                <select
                  value={startCol}
                  onChange={(e) => setStartCol(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value={0}>A Sütunu (1. Sütun)</option>
                  <option value={1}>B Sütunu (2. Sütun)</option>
                  <option value={2}>C Sütunu (3. Sütun)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Başlangıç Satırı</label>
                <select
                  value={startRow}
                  onChange={(e) => setStartRow(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}. Satır</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handlePrint}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Printer size={18} />
              Etiketleri Yazdır
            </button>
          </div>

          {/* Preview */}
          <div className="w-full md:w-2/3 flex flex-col items-center">
            <h4 className="text-sm font-medium text-slate-500 mb-3 uppercase tracking-wider">A4 Önizleme (Sayfa 1 / {pages.length})</h4>
            <div className="w-full max-w-[350px] aspect-[210/297] bg-white shadow-md border border-slate-300 mx-auto relative flex flex-col" style={{ padding: '4% 0' }}>
              <div className="flex-1 grid grid-cols-3 grid-rows-12 gap-px bg-slate-100 border-y border-slate-200">
                {pages[0]?.map((cell, i) => {
                  const colLetter = ['A', 'B', 'C'][i % 3];
                  const rowNum = Math.floor(i / 3) + 1;
                  const cellName = `${colLetter}${rowNum}`;

                  return (
                    <div key={i} className={`bg-white flex flex-col justify-center px-4 py-1 relative ${cell ? 'bg-blue-50' : 'items-center'}`}>
                      {!cell && <span className="text-[10px] text-slate-300 absolute">{cellName}</span>}
                      {cell && (
                        <span className="text-[9px] font-medium text-blue-900 leading-tight text-left break-words">
                          {formatLabel(cell)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      </div>
    </>
  );
};
