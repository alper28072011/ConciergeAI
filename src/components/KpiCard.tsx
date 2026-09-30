import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  History, 
  Sparkles, 
  HelpCircle,
  Calendar,
  Scale
} from 'lucide-react';

export interface KpiComparisonData {
  fromText: string;
  toText: string;
  deltaText: string;
  isGood: boolean;
  tooltip: string;
}

export interface KpiCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  change?: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: 'indigo' | 'blue' | 'emerald' | 'red' | string;
  comparison?: KpiComparisonData;
  currentPeriodStr?: string;
  previousPeriodStr?: string;
  onClick?: () => void;
  dataFilterType?: string;
  dataFilterValue?: string;
}

const colorStyles: Record<string, { bg: string; text: string; circle: string; border: string }> = {
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', circle: 'bg-indigo-50/70', border: 'border-indigo-100' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', circle: 'bg-blue-50/70', border: 'border-blue-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', circle: 'bg-emerald-50/70', border: 'border-emerald-100' },
  red: { bg: 'bg-red-50', text: 'text-red-600', circle: 'bg-red-50/70', border: 'border-red-100' },
};

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subValue,
  change,
  icon: Icon,
  color,
  comparison,
  currentPeriodStr,
  previousPeriodStr,
  onClick,
  dataFilterType = 'all',
  dataFilterValue = 'all'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const compareRef = useRef<HTMLDivElement>(null);

  const styleConfig = colorStyles[color] || colorStyles.indigo;
  const isCategoryCard = label === 'En Başarılı Kategori' || label === 'Gelişim Alanı';

  const updatePosition = (clientX: number, clientY: number) => {
    const tooltipWidth = 350;
    const tooltipHeight = 250;
    let x = clientX + 16;
    let y = clientY + 16;

    if (x + tooltipWidth > window.innerWidth) {
      x = clientX - tooltipWidth - 16;
    }
    if (y + tooltipHeight > window.innerHeight) {
      y = Math.max(12, window.innerHeight - tooltipHeight - 12);
    }

    setCoords({ x, y });
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (comparison) {
      updatePosition(e.clientX, e.clientY);
      setIsHovered(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (comparison && isHovered) {
      updatePosition(e.clientX, e.clientY);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <>
      <div
        className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-indigo-300 transition-all interactive-filter-trigger flex flex-col justify-between"
        onClick={onClick}
        data-filter-type={dataFilterType}
        data-filter-value={dataFilterValue}
        data-kpi-card="true"
        data-kpi-comparison={comparison ? 'true' : 'false'}
        data-kpi-label={label}
        data-kpi-value={String(value)}
        data-kpi-subvalue={subValue || ''}
        data-kpi-change={change !== undefined ? String(change) : ''}
        data-kpi-from={comparison?.fromText || ''}
        data-kpi-to={comparison?.toText || ''}
        data-kpi-delta={comparison?.deltaText || ''}
        data-kpi-is-good={comparison ? String(comparison.isGood) : ''}
        data-kpi-tooltip={comparison?.tooltip || ''}
        data-kpi-prev-period={previousPeriodStr || ''}
        data-kpi-curr-period={currentPeriodStr || ''}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className={`absolute top-0 right-0 w-24 h-24 ${styleConfig.circle} rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110 pointer-events-none`} />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-xl ${styleConfig.bg} ${styleConfig.text}`}>
              <Icon size={20} />
            </div>
            {change !== undefined && (
              <div className={`flex items-center gap-0.5 text-[10px] font-bold ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(change)}%
              </div>
            )}
          </div>
          
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
          
          <div className="flex items-baseline gap-2">
            <h4 className="text-xl font-black text-slate-900 truncate" title={String(value)}>{value}</h4>
            {subValue && (
              <span className="text-xs font-semibold text-slate-500 shrink-0">{subValue}</span>
            )}
          </div>
        </div>

        {comparison && (
          <div
            ref={compareRef}
            className="relative z-10 mt-3.5 pt-2.5 border-t border-slate-100 bg-slate-50/70 hover:bg-indigo-50/40 p-2 rounded-xl border border-slate-100/90 transition-colors"
          >
            {isCategoryCard ? (
              // Kategori Kartları: 2 Satırlı Ferah Tasarım (Metinler kesinlikle sığar)
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 shrink-0">
                    <History size={11} className="text-slate-400" />
                    Önceki:
                  </span>
                  <span 
                    className="font-bold text-slate-700 truncate max-w-[130px] text-right" 
                    title={comparison.fromText}
                  >
                    {comparison.fromText}
                  </span>
                </div>
                
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/60 text-xs">
                  <span className="text-[9px] uppercase font-black text-indigo-500 flex items-center gap-1">
                    <span>Durum</span>
                    <HelpCircle size={10} className="text-slate-400 opacity-60" />
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-xs ${
                    comparison.isGood 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {comparison.deltaText}
                  </span>
                </div>
              </div>
            ) : (
              // Sayısal Kartlar (Ort. Memnuniyet & Toplam Yorum): Tek Satırda Ferah ve Dengeli
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1 text-slate-600 font-medium min-w-0">
                  <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                    <History size={11} className="text-slate-400" />
                    Önceki:
                  </span>
                  <span className="font-bold text-slate-700 truncate">{comparison.fromText}</span>
                  <HelpCircle size={10} className="text-slate-400 opacity-60 shrink-0 ml-0.5" />
                </div>
                
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-xs flex items-center gap-0.5 ${
                  comparison.isGood 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {comparison.isGood ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {comparison.deltaText}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Portallı Araç İpucu (Hover Tooltip) - Ekran sınırlarından ve overflow-hidden'dan asla etkilenmez */}
      {isHovered && comparison && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: `${coords.x}px`,
            top: `${coords.y}px`,
            zIndex: 99999,
            pointerEvents: 'none'
          }}
          className="w-[350px] bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl border border-slate-700/80 shadow-2xl transition-opacity duration-150 animate-in fade-in"
        >
          {/* Başlık ve Durum Rozeti */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="p-1 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
                <Scale size={13} />
              </span>
              <span className="text-xs font-black text-white truncate tracking-wide">
                {label} • Dönem Karşılaştırması
              </span>
            </div>
            
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${
              comparison.isGood
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}>
              {comparison.deltaText}
            </span>
          </div>

          {/* Tarih Dönemleri */}
          {(currentPeriodStr || previousPeriodStr) && (
            <div className="flex flex-col gap-1 mb-3 text-[10px] text-slate-400 bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
              {previousPeriodStr && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-medium">
                    <History size={10} className="text-slate-400" />
                    Önceki Dönem:
                  </span>
                  <span className="font-semibold text-slate-300">{previousPeriodStr}</span>
                </div>
              )}
              {currentPeriodStr && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-medium">
                    <Calendar size={10} className="text-indigo-400" />
                    Bu Dönem:
                  </span>
                  <span className="font-semibold text-indigo-200">{currentPeriodStr}</span>
                </div>
              )}
            </div>
          )}

          {/* Değerler Karşılaştırma Izgarası */}
          <div className="grid grid-cols-2 gap-2 bg-slate-800/80 rounded-xl p-2.5 mb-3 border border-slate-700/50 text-center">
            <div className="border-r border-slate-700/60 pr-2">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Önceki Veri</div>
              <div className="text-sm font-black text-slate-200 mt-0.5 truncate" title={comparison.fromText}>
                {comparison.fromText}
              </div>
            </div>
            <div className="pl-1">
              <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-tight">Şimdiki Veri</div>
              <div className="text-sm font-black text-white mt-0.5 truncate" title={comparison.toText}>
                {comparison.toText}
              </div>
            </div>
          </div>

          {/* Yönetici İçgörüsü / Stratejik Anlamı */}
          <div className="bg-slate-800/90 rounded-xl p-2.5 border border-slate-700/60 text-xs text-slate-300 leading-relaxed flex items-start gap-2">
            <Sparkles size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-200">
              {comparison.tooltip}
            </p>
          </div>

          <div className="mt-2.5 text-[9px] text-slate-400 text-center font-medium">
            💡 Detaylı analiz ve yorumları görmek için karta tıklayabilirsiniz.
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default KpiCard;
