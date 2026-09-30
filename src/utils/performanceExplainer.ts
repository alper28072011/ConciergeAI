/**
 * Performans Eğilimi ve Metrik Açıklama Şablon Motoru
 * Hem web arayüzünde hem de dışarı aktarılan HTML raporunda
 * metriklerin yöneticiler ve kullanıcılar tarafından zahmetsizce anlaşılmasını sağlar.
 */

export interface PerformanceNarrativeParams {
  title: string;
  type: 'source' | 'category' | 'subCategory' | 'nationality' | 'timeline' | 'topic' | 'praisedTopic' | 'urgentTopic' | 'general';
  currCount: number;
  prevCount?: number;
  currScore: number;
  prevScore?: number;
  scoreDelta?: number;
  growthRate?: number;
  extra?: string;
  currPeriodLabel?: string;
  prevPeriodLabel?: string;
}

export interface PerformanceNarrativeResult {
  title: string;
  typeLabel: string;
  status: 'strong_positive' | 'positive' | 'neutral' | 'negative' | 'strong_negative' | 'new_data';
  badgeText: string;
  badgeShort: string;
  badgeStyleClass: string;
  scoreDeltaText: string;
  volumeSentence: string;
  scoreSentence: string;
  verdictSentence: string;
  fullHtml: string;
}

export function getPerformanceNarrative(params: PerformanceNarrativeParams): PerformanceNarrativeResult {
  const {
    title,
    type,
    currCount,
    prevCount,
    currScore,
    prevScore,
    scoreDelta,
    growthRate,
    extra
  } = params;

  // Tip Etiketi
  let typeLabel = 'Metrik Analizi';
  if (type === 'source') typeLabel = 'Kanal Kaynağı';
  else if (type === 'category') typeLabel = 'Ana Kategori';
  else if (type === 'subCategory') typeLabel = 'Alt Kategori / Konu';
  else if (type === 'nationality') typeLabel = 'Pazar / Uyruk';
  else if (type === 'timeline') typeLabel = 'Zaman Periyodu';
  else if (type === 'topic') typeLabel = 'Gündem / Konu';
  else if (type === 'praisedTopic') typeLabel = 'Övülen Başarı';
  else if (type === 'urgentTopic') typeLabel = 'Acil Müdahale';

  // Durum Belirleme
  let status: PerformanceNarrativeResult['status'] = 'neutral';
  let badgeText = '0 Puan Değişim Yok (Dengeli) ▬';
  let badgeShort = '0 Puan Dengeli ▬';
  let badgeStyleClass = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80';
  let scoreDeltaText = '0 puan';

  const hasScoreDelta = scoreDelta !== undefined && scoreDelta !== null;
  const hasPrevCount = prevCount !== undefined && prevCount !== null && prevCount > 0;
  const hasPrevScore = prevScore !== undefined && prevScore !== null;

  if (type === 'praisedTopic') {
    if (currScore >= 95) {
      status = 'strong_positive';
      badgeText = `👑 Zirveyi Koruyor (%${currScore})`;
      badgeShort = '👑 Zirve (%95+)';
      badgeStyleClass = 'bg-amber-50 text-amber-800 border-amber-300 font-extrabold shadow-sm hover:bg-amber-100';
    } else if (hasScoreDelta && scoreDelta >= 5) {
      status = 'strong_positive';
      badgeText = `+${scoreDelta} Puan Güçlenen Başarı ↗`;
      badgeShort = `+${scoreDelta}p Güçlenen ↗`;
      badgeStyleClass = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-extrabold shadow-sm hover:bg-emerald-100';
    } else if (!hasPrevCount) {
      status = 'new_data';
      badgeText = '🌱 Yeni Başarı Alanı ✨';
      badgeShort = 'Yeni Başarı 🌱';
      badgeStyleClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
    } else {
      status = 'positive';
      badgeText = hasScoreDelta && scoreDelta > 0 ? `+${scoreDelta} Puan Artış ↗` : '🌟 İstikrarlı Başarı ▬';
      badgeShort = hasScoreDelta && scoreDelta > 0 ? `+${scoreDelta}p Artış ↗` : 'İstikrarlı 🌟';
      badgeStyleClass = 'bg-emerald-50/80 text-emerald-700 border-emerald-200 font-bold hover:bg-emerald-100';
    }
    scoreDeltaText = hasScoreDelta ? (scoreDelta > 0 ? `+${scoreDelta} puan` : `${scoreDelta} puan`) : '0 puan';
  } else if (type === 'urgentTopic') {
    if (growthRate !== undefined && growthRate > 0 && hasScoreDelta && scoreDelta <= 0) {
      status = 'strong_negative';
      badgeText = `🚨 Kritikleşen Problem (+%${growthRate} Hacim)`;
      badgeShort = '🚨 Kritik Problem';
      badgeStyleClass = 'bg-rose-100 text-rose-800 border-rose-300 font-black shadow-sm hover:bg-rose-200';
    } else if (hasScoreDelta && scoreDelta >= 5) {
      status = 'positive';
      badgeText = `✅ Toparlanma Eğiliminde (+${scoreDelta} p.)`;
      badgeShort = `✅ Toparlanma (+${scoreDelta}p)`;
      badgeStyleClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold hover:bg-emerald-100';
    } else if (!hasPrevCount) {
      status = 'new_data';
      badgeText = '⚡ Yeni Beliren Sorun ✨';
      badgeShort = 'Yeni Sorun ⚡';
      badgeStyleClass = 'bg-amber-50 text-amber-700 border-amber-200 font-bold hover:bg-amber-100';
    } else {
      status = 'negative';
      badgeText = `⚠️ Kronik Memnuniyetsizlik (${hasScoreDelta ? `${scoreDelta} p.` : 'Risk'})`;
      badgeShort = '⚠️ Kronik Sorun';
      badgeStyleClass = 'bg-rose-50 text-rose-700 border-rose-200 font-bold hover:bg-rose-100';
    }
    scoreDeltaText = hasScoreDelta ? `${scoreDelta} puan` : 'Risk';
  } else if (type === 'topic') {
    if (growthRate !== undefined && growthRate >= 50) {
      status = 'strong_positive';
      badgeText = `🔥 Hızlı Yükselen Gündem (+%${growthRate})`;
      badgeShort = `🔥 Hızlı Yükselen (+%${growthRate})`;
      badgeStyleClass = 'bg-purple-50 text-purple-800 border-purple-300 font-extrabold shadow-sm hover:bg-purple-100';
    } else if (growthRate !== undefined && growthRate <= -30) {
      status = 'neutral';
      badgeText = `📉 Azalan İlgi (%${growthRate} Hacim)`;
      badgeShort = `📉 Azalan İlgi (%${growthRate})`;
      badgeStyleClass = 'bg-slate-100 text-slate-700 border-slate-300 font-bold hover:bg-slate-200';
    } else if (hasScoreDelta && scoreDelta >= 5) {
      status = 'strong_positive';
      badgeText = `🌟 Pozitif Trend (+${scoreDelta} Puan) ↗`;
      badgeShort = `🌟 Pozitif (+${scoreDelta}p) ↗`;
      badgeStyleClass = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-extrabold shadow-sm hover:bg-emerald-100';
    } else if (hasScoreDelta && scoreDelta <= -5) {
      status = 'strong_negative';
      badgeText = `⚠️ Dikkat Çeken Düşüş (${scoreDelta} Puan) ↘`;
      badgeShort = `⚠️ Düşüş (${scoreDelta}p) ↘`;
      badgeStyleClass = 'bg-rose-50 text-rose-800 border-rose-300 font-extrabold shadow-sm hover:bg-rose-100';
    } else if (!hasPrevCount) {
      status = 'new_data';
      badgeText = '✨ Yeni Gündem Konusu';
      badgeShort = 'Yeni Gündem ✨';
      badgeStyleClass = 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100';
    } else {
      status = 'neutral';
      badgeText = hasScoreDelta && scoreDelta !== 0 
        ? `⚖️ Dengeli Gündem (${scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta} p.)` 
        : '⚖️ Dengeli Gündem (0 p.) ▬';
      badgeShort = '⚖️ Dengeli Gündem';
      badgeStyleClass = 'bg-slate-50 text-slate-700 border-slate-200 font-bold hover:bg-slate-100';
    }
    scoreDeltaText = hasScoreDelta ? (scoreDelta > 0 ? `+${scoreDelta} puan` : `${scoreDelta} puan`) : '0 puan';
  } else if (!hasScoreDelta && !hasPrevScore && !hasPrevCount) {
    status = 'new_data';
    badgeText = 'Önceki Veri Yok (Yeni) ✨';
    badgeShort = 'Yeni Veri ✨';
    badgeStyleClass = 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100';
    scoreDeltaText = 'Yeni';
  } else if (hasScoreDelta) {
    if (scoreDelta >= 5) {
      status = 'strong_positive';
      badgeText = `+${scoreDelta} Puan Güçlü İyileşme ↗`;
      badgeShort = `+${scoreDelta} Puan Güçlü ↗`;
      badgeStyleClass = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-extrabold shadow-sm hover:bg-emerald-100';
      scoreDeltaText = `+${scoreDelta} puan`;
    } else if (scoreDelta > 0) {
      status = 'positive';
      badgeText = `+${scoreDelta} Puan Artış ↗`;
      badgeShort = `+${scoreDelta} Puan Artış ↗`;
      badgeStyleClass = 'bg-teal-50 text-teal-800 border-teal-300 font-bold hover:bg-teal-100';
      scoreDeltaText = `+${scoreDelta} puan`;
    } else if (scoreDelta <= -5) {
      status = 'strong_negative';
      badgeText = `${scoreDelta} Puan Belirgin Düşüş ↘`;
      badgeShort = `${scoreDelta} Puan Kritik ↘`;
      badgeStyleClass = 'bg-rose-50 text-rose-800 border-rose-300 font-extrabold shadow-sm hover:bg-rose-100';
      scoreDeltaText = `${scoreDelta} puan`;
    } else if (scoreDelta < 0) {
      status = 'negative';
      badgeText = `${scoreDelta} Puan Düşüş ↘`;
      badgeShort = `${scoreDelta} Puan Düşüş ↘`;
      badgeStyleClass = 'bg-rose-50/80 text-rose-700 border-rose-200 font-bold hover:bg-rose-100';
      scoreDeltaText = `${scoreDelta} puan`;
    } else {
      status = 'neutral';
      badgeText = '0 Puan Değişim Yok (Dengeli) ▬';
      badgeShort = '0 Puan Dengeli ▬';
      badgeStyleClass = 'bg-slate-100 text-slate-700 border-slate-200 font-bold hover:bg-slate-200/80';
      scoreDeltaText = '0 puan';
    }
  }

  // 1. Cümle: Yorum Hacmi & Bahsedilme Değişimi
  let volumeSentence = '';
  const growthAbs = Math.abs(growthRate || 0);

  if (type === 'praisedTopic') {
    if (hasPrevCount) {
      volumeSentence = `Önceki dönemde bu konuda ${prevCount} övgü alınmışken, bu dönemde övgü sayısı ${currCount} adede ulaştı (${growthRate !== undefined && growthRate >= 0 ? `övgü hacmi %${growthAbs} büyüdü` : `övgü adedi %${growthAbs} azaldı`}).`;
    } else {
      volumeSentence = `Bu konuda önceki dönemde kayıtlı övgü bulunmuyor; bu dönemde toplam ${currCount} yeni övgü kaydedildi.`;
    }
  } else if (type === 'urgentTopic') {
    if (hasPrevCount) {
      volumeSentence = `Önceki dönemde bu konuda ${prevCount} şikayet bildirilmişken, bu dönemde şikayet sayısı ${currCount} adede ulaştı (${growthRate !== undefined && growthRate > 0 ? `şikayet hacmi %${growthAbs} ARTTI ⚠️` : `şikayet adedi %${growthAbs} azaldı 📉`}).`;
    } else {
      volumeSentence = `Bu konu önceki dönemde şikayet konusu olmamışken, bu dönem ilk kez ${currCount} şikayet bildirildi.`;
    }
  } else if (type === 'topic') {
    if (hasPrevCount) {
      volumeSentence = `Önceki dönemde bu konudan ${prevCount} kez bahsedilmişken, bu dönem ${currCount} yoruma ulaştı (gündeme gelme sıklığı %${growthAbs} ${currCount >= (prevCount || 0) ? 'arttı' : 'azaldı'}).`;
    } else {
      volumeSentence = `Bu konu önceki dönemde gündemde yokken, bu dönem ${currCount} misafir yorumunda yer aldı.`;
    }
  } else if (type === 'source') {
    if (hasPrevCount) {
      if (currCount > (prevCount || 0)) {
        volumeSentence = `Önceki dönemde ${title} kanalından ${prevCount} yorum gelmişken, bu dönemde ${currCount} yoruma ulaşıldı (yorum hacmi %${growthAbs} büyüdü).`;
      } else if (currCount < (prevCount || 0)) {
        volumeSentence = `Önceki dönemde ${title} kanalından ${prevCount} yorum alınmışken, bu dönemde ${currCount} yoruma geriledi (yorum hacmi %${growthAbs} daraldı).`;
      } else {
        volumeSentence = `Önceki dönemle aynı sayıda (${currCount} adet) yorum kaydedildi (hacim korundu).`;
      }
    } else {
      volumeSentence = `Bu kanal için önceki dönemde kayıtlı yorum bulunmuyor. Bu dönemde ilk kez ${currCount} yorum kaydedildi.`;
    }
  } else if (type === 'category' || type === 'subCategory') {
    if (hasPrevCount) {
      if (currCount > (prevCount || 0)) {
        volumeSentence = `Önceki dönemde bu konudan ${prevCount} kez bahsedilmişken, bu dönemde ${currCount} yoruma ulaşıldı (gündeme gelme oranı %${growthAbs} arttı).`;
      } else if (currCount < (prevCount || 0)) {
        volumeSentence = `Önceki dönemde bu konudan ${prevCount} kez bahsedilmişken, bu dönemde ${currCount} yoruma indi (gündeme gelme sıklığı %${growthAbs} azaldı).`;
      } else {
        volumeSentence = `Önceki dönem ile bu dönemde aynı sıklıkta (${currCount} kez) dile getirildi.`;
      }
    } else {
      volumeSentence = `Bu konu önceki dönemde hiç dile getirilmemişken, bu dönem ${currCount} misafir yorumunda yer aldı.`;
    }
  } else if (type === 'nationality') {
    if (hasPrevCount) {
      if (currCount > (prevCount || 0)) {
        volumeSentence = `Önceki dönemde ${title} pazarından ${prevCount} misafir yorumu alınmışken, bu dönemde ${currCount} yoruma ulaşıldı (pazar hacmi %${growthAbs} büyüdü).`;
      } else if (currCount < (prevCount || 0)) {
        volumeSentence = `Önceki dönemde ${title} pazarından ${prevCount} yorum gelmişken, bu dönemde ${currCount} yoruma geriledi (pazar hacmi %${growthAbs} azaldı).`;
      } else {
        volumeSentence = `Önceki dönem ile bu dönemde aynı sayıda (${currCount} adet) misafir değerlendirmesi alındı.`;
      }
    } else {
      volumeSentence = `Bu uyruk / pazar için önceki dönemde kayıtlı yorum bulunmuyor; bu dönem ilk kez ${currCount} yorum alındı.`;
    }
  } else if (type === 'timeline') {
    if (hasPrevCount) {
      if (currCount > (prevCount || 0)) {
        volumeSentence = `Önceki eşdeğer periyotta ${prevCount} yorum toplanmışken, bu periyotta ${currCount} yoruma ulaşıldı (yorum akışı %${growthAbs} arttı).`;
      } else if (currCount < (prevCount || 0)) {
        volumeSentence = `Önceki periyotta ${prevCount} yorum toplanmışken, bu periyotta ${currCount} yoruma geriledi (yorum sayısı %${growthAbs} azaldı).`;
      } else {
        volumeSentence = `Önceki periyotla eşit sayıda (${currCount} adet) yorum kaydedildi.`;
      }
    } else {
      volumeSentence = `Önceki eşdeğer periyotta kayıtlı veri bulunmuyor; bu periyotta toplam ${currCount} yorum incelendi.`;
    }
  } else {
    volumeSentence = hasPrevCount
      ? `Önceki dönem ${prevCount} adetten bu dönem ${currCount} adede ulaştı.`
      : `Bu dönem toplam ${currCount} adet kayıt mevcut.`;
  }

  // 2. Cümle: Memnuniyet Skoru Karşılaştırması
  let scoreSentence = '';
  if (hasPrevScore && hasScoreDelta) {
    if (scoreDelta > 0) {
      scoreSentence = `Önceki dönem memnuniyet oranı %${prevScore} iken, bu dönem %${currScore} seviyesine çıkarak +${scoreDelta} puanlık net bir artış yakaladı.`;
    } else if (scoreDelta < 0) {
      scoreSentence = `Önceki dönem memnuniyet skoru %${prevScore} iken, bu dönem %${currScore} seviyesine inerek ${Math.abs(scoreDelta)} puanlık bir gerileme gösterdi.`;
    } else {
      scoreSentence = `Memnuniyet skoru önceki dönemle birebir aynı kalarak %${currScore} seviyesinde tam dengesini korudu (0 puan değişim).`;
    }
  } else {
    scoreSentence = `Bu dönem misafir memnuniyet skoru %${currScore} olarak gerçekleşti.`;
  }

  // 3. Cümle: Özet Teşhis & Yönetici Yorumu
  let verdictSentence = '';
  if (type === 'praisedTopic') {
    verdictSentence = '👑 Güçlü Misafir Takdiri: Otelin misafir memnuniyetinde öne çıkan en güçlü başarı alanlarındandır.';
  } else if (type === 'urgentTopic') {
    verdictSentence = (growthRate !== undefined && growthRate > 0)
      ? '🚨 Acil Müdahale: Şikayet hacmi yükselişte; operasyonel aksiyonlar ivedilikle devreye alınmalıdır.'
      : '⚠️ İnceleme & Takip: Kronikleşen şikayetlerin kök nedenleri incelenmeli ve kalıcı çözümler uygulanmalıdır.';
  } else if (type === 'topic') {
    verdictSentence = (scoreDelta !== undefined && scoreDelta >= 5)
      ? '🌟 Pozitif Gündem: Konu misafirler nezdinde belirgin şekilde değer kazanıyor.'
      : ((scoreDelta !== undefined && scoreDelta <= -5)
        ? '⚠️ Riskli Gündem: Konuda misafir algısı geriliyor, dikkat edilmeli.'
        : '⚖️ Dengeli Gündem: Konu misafir deneyiminde olağan seyrini koruyor.');
  } else if (status === 'new_data') {
    verdictSentence = `✨ Yeni Veri: Bu dönem misafir memnuniyeti %${currScore} düzeyinde giriş yaptı.`;
  } else if (status === 'strong_positive') {
    verdictSentence = `🚀 Güçlü İyileşme: Hem misafir algısı hem memnuniyet performansı çok yüksek ve pozitif ivmede seyrediyor.`;
  } else if (status === 'positive') {
    verdictSentence = `↗ Olumlu Gidişat: Misafirlerin memnuniyet puanında gözle görülür bir artış ve iyileşme kaydedildi.`;
  } else if (status === 'strong_negative') {
    verdictSentence = `⚠️ Acil İnceleme: Memnuniyet skorunda belirgin bir düşüş var; gelen olumsuz yorumların acilen teşhis edilmesi önerilir.`;
  } else if (status === 'negative') {
    verdictSentence = `↘ Dikkat: Memnuniyet seviyesinde hafif bir gerileme söz konusu; trendin izlenmesi tavsiye edilir.`;
  } else {
    verdictSentence = `⚖️ Stabil Denge: Performans önceki dönemin kalite standartlarını istikrarlı bir şekilde koruyor.`;
  }

  // Tooltip için biçimlendirilmiş zengin HTML
  const deltaBadgeColor = scoreDelta && scoreDelta > 0 
    ? 'background-color: rgba(16, 185, 129, 0.2); color: #34d399; border-color: rgba(16, 185, 129, 0.4);'
    : scoreDelta && scoreDelta < 0
    ? 'background-color: rgba(244, 63, 94, 0.2); color: #fb7185; border-color: rgba(244, 63, 94, 0.4);'
    : 'background-color: rgba(148, 163, 184, 0.2); color: #cbd5e1; border-color: rgba(148, 163, 184, 0.3);';

  const fullHtml = `
    <div style="font-family: inherit;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 6px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(99, 102, 241, 0.25); color: #a5b4fc; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(99, 102, 241, 0.4);">${typeLabel}</span>
          <span style="font-size: 13px; font-weight: 800; color: #ffffff;">${title}</span>
        </div>
        <span style="font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 9999px; border: 1px solid; ${deltaBadgeColor}">
          ${scoreDelta && scoreDelta > 0 ? `+${scoreDelta}` : (scoreDelta !== undefined ? `${scoreDelta}` : '0')} Puan
        </span>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; background: rgba(30, 41, 59, 0.7); border-radius: 8px; padding: 8px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.06); text-align: center;">
        <div>
          <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Bu Dönem</div>
          <div style="font-size: 13px; font-weight: 900; color: #ffffff;">%${currScore}</div>
          <div style="font-size: 10px; color: #cbd5e1; font-weight: 600;">${currCount} yorum</div>
        </div>
        <div>
          <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Önceki</div>
          <div style="font-size: 13px; font-weight: 900; color: #94a3b8;">${hasPrevScore ? `%${prevScore}` : '-'}</div>
          <div style="font-size: 10px; color: #94a3b8; font-weight: 600;">${hasPrevCount ? `${prevCount} yorum` : '-'}</div>
        </div>
        <div>
          <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Hacim Büyüme</div>
          <div style="font-size: 13px; font-weight: 900; color: ${growthRate !== undefined && growthRate >= 0 ? '#34d399' : '#fb7185'};">
            ${growthRate !== undefined ? (growthRate >= 0 ? `+${growthRate}%` : `${growthRate}%`) : '-'}
          </div>
          <div style="font-size: 10px; color: #94a3b8;">${extra || 'Trend'}</div>
        </div>
      </div>

      <div style="font-size: 11px; line-height: 1.55; color: #e2e8f0; margin-bottom: 6px;">
        <span style="display: block; margin-bottom: 4px;">• ${volumeSentence}</span>
        <span style="display: block;">• ${scoreSentence}</span>
      </div>

      <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.12); font-size: 11px; font-weight: 700; color: #cbd5e1; display: flex; align-items: flex-start; gap: 4px;">
        <span>${verdictSentence}</span>
      </div>
    </div>
  `;

  return {
    title,
    typeLabel,
    status,
    badgeText,
    badgeShort,
    badgeStyleClass,
    scoreDeltaText,
    volumeSentence,
    scoreSentence,
    verdictSentence,
    fullHtml
  };
}
