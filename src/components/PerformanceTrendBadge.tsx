import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, ArrowUpRight, ArrowDownRight, Minus, Sparkles } from 'lucide-react';
import { getPerformanceNarrative, PerformanceNarrativeParams } from '../utils/performanceExplainer';

interface PerformanceTrendBadgeProps extends PerformanceNarrativeParams {
  size?: 'normal' | 'sm' | 'xs';
  showHelpIcon?: boolean;
  className?: string;
}

export const PerformanceTrendBadge: React.FC<PerformanceTrendBadgeProps> = ({
  title,
  type,
  currCount,
  prevCount,
  currScore,
  prevScore,
  scoreDelta,
  growthRate,
  extra,
  currPeriodLabel,
  prevPeriodLabel,
  size = 'normal',
  showHelpIcon = true,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const badgeRef = useRef<HTMLDivElement>(null);

  const narrative = getPerformanceNarrative({
    title,
    type,
    currCount,
    prevCount,
    currScore,
    prevScore,
    scoreDelta,
    growthRate,
    extra,
    currPeriodLabel,
    prevPeriodLabel
  });

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    updatePosition(e.clientX, e.clientY);
    setIsHovered(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    updatePosition(e.clientX, e.clientY);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const updatePosition = (clientX: number, clientY: number) => {
    const tooltipWidth = 350;
    const tooltipHeight = 220;
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

  // İkon seçimi
  let StatusIcon = Minus;
  if (narrative.status === 'strong_positive' || narrative.status === 'positive') {
    StatusIcon = ArrowUpRight;
  } else if (narrative.status === 'strong_negative' || narrative.status === 'negative') {
    StatusIcon = ArrowDownRight;
  } else if (narrative.status === 'new_data') {
    StatusIcon = Sparkles;
  }

  const paddingClass = size === 'sm' 
    ? 'px-2 py-0.5 text-[10px]' 
    : size === 'xs' 
    ? 'px-1.5 py-0.5 text-[9px]' 
    : 'px-2.5 py-1 text-[11px]';

  const iconSize = size === 'sm' || size === 'xs' ? 10 : 12;

  return (
    <>
      <div
        ref={badgeRef}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`relative inline-flex items-center cursor-help select-none ${className}`}
        data-metric-tooltip="performance"
        data-metric-type={type}
        data-metric-name={title}
        data-curr-count={currCount}
        data-prev-count={prevCount !== undefined ? prevCount : ''}
        data-curr-score={currScore}
        data-prev-score={prevScore !== undefined ? prevScore : ''}
        data-score-delta={scoreDelta !== undefined ? scoreDelta : ''}
        data-growth-rate={growthRate !== undefined ? growthRate : ''}
        data-extra={extra || ''}
      >
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border transition-all duration-150 ${paddingClass} ${narrative.badgeStyleClass}`}
        >
          <StatusIcon size={iconSize} className="shrink-0" />
          <span className="font-black whitespace-nowrap tracking-tight">
            {size === 'xs' ? narrative.badgeShort : narrative.badgeText}
          </span>
          {showHelpIcon && (
            <HelpCircle size={10} className="opacity-50 hover:opacity-100 transition-opacity ml-0.5 shrink-0" />
          )}
        </span>
      </div>

      {/* Portal Tooltip - Asla overflow tarafından kesilmez */}
      {isHovered && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: `${coords.x}px`,
            top: `${coords.y}px`,
            zIndex: 99999,
            pointerEvents: 'none'
          }}
          className="w-[350px] bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-xl border border-slate-700/80 shadow-2xl transition-opacity duration-150 animate-in fade-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 shrink-0">
                {narrative.typeLabel}
              </span>
              <span className="text-sm font-bold text-white truncate">
                {title}
              </span>
            </div>
            <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border shrink-0 ${
              scoreDelta && scoreDelta > 0 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                : scoreDelta && scoreDelta < 0
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-slate-700/50 text-slate-300 border-slate-600'
            }`}>
              {scoreDelta && scoreDelta > 0 ? `+${scoreDelta}` : (scoreDelta !== undefined ? `${scoreDelta}` : '0')} Puan
            </span>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-800/70 rounded-lg p-2 mb-2.5 border border-slate-700/40 text-center">
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Bu Dönem</div>
              <div className="text-xs font-black text-white mt-0.5">%{currScore}</div>
              <div className="text-[10px] text-slate-300 font-medium">{currCount} yorum</div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Önceki Dönem</div>
              <div className="text-xs font-black text-slate-300 mt-0.5">{prevScore !== undefined ? `%${prevScore}` : '-'}</div>
              <div className="text-[10px] text-slate-400 font-medium">{prevCount !== undefined ? `${prevCount} yorum` : '-'}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Hacim Değişimi</div>
              <div className={`text-xs font-black mt-0.5 ${
                growthRate !== undefined && growthRate >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {growthRate !== undefined ? (growthRate >= 0 ? `+${growthRate}%` : `${growthRate}%`) : '-'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">{extra || 'Trend'}</div>
            </div>
          </div>

          {/* Narrative Sentences */}
          <div className="text-[11px] leading-relaxed text-slate-200 space-y-1 mb-2">
            <p className="flex items-start gap-1.5">
              <span className="text-indigo-400 font-bold shrink-0">•</span>
              <span>{narrative.volumeSentence}</span>
            </p>
            <p className="flex items-start gap-1.5">
              <span className="text-indigo-400 font-bold shrink-0">•</span>
              <span>{narrative.scoreSentence}</span>
            </p>
          </div>

          {/* Diagnosis / Summary */}
          <div className="pt-2 border-t border-dashed border-slate-700/60 text-[11px] font-bold text-slate-300 flex items-start gap-1.5">
            <span>{narrative.verdictSentence}</span>
          </div>

          {/* Subtitle footer */}
          <div className="mt-2 text-[9px] text-slate-400 font-medium text-right italic">
            İş Zekası & Karşılaştırmalı Metrik Şablonu
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
export default PerformanceTrendBadge;
