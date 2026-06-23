import React, { useState, useEffect, useRef } from 'react';
import { LetterTemplate } from '../types';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Save, Trash2, Plus, FileText, Copy, CheckCircle2, LayoutTemplate, Globe, X, ArrowLeft, ArrowRight, Eye, Edit2, AlertTriangle, Printer, Sparkles, Sliders, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { generateAIContent } from '../services/aiService';

const QuillComponent = ReactQuill as any;

if (ReactQuill && (ReactQuill as any).Quill) {
  const Quill = (ReactQuill as any).Quill;
  
  try {
    // Style-based size attributor override (registers arbitrary pixel font-sizes)
    const SizeStyle = Quill.import('attributors/style/size');
    // Generate sizes from 6px to 120px to support any font size choices
    const sizes = Array.from({ length: 115 }, (_, i) => `${i + 6}px`);
    SizeStyle.whitelist = sizes;
    Quill.register(SizeStyle, true);

    // Style-based color attributor (already standard, but ensure registered as Style)
    const ColorStyle = Quill.import('attributors/style/color');
    Quill.register(ColorStyle, true);

    const BackgroundStyle = Quill.import('attributors/style/background');
    Quill.register(BackgroundStyle, true);

    // Register generic styling attributes to prevent Quill from stripping block layout styles inside span
    const Parchment = Quill.import('parchment');
    if (Parchment && Parchment.Attributor && Parchment.Attributor.Style) {
      const displayAttributor = new Parchment.Attributor.Style('display', 'display', {
        scope: Parchment.Scope.INLINE
      });
      const widthAttributor = new Parchment.Attributor.Style('width', 'width', {
        scope: Parchment.Scope.INLINE
      });
      const heightAttributor = new Parchment.Attributor.Style('height', 'height', {
        scope: Parchment.Scope.INLINE
      });
      const borderAttributor = new Parchment.Attributor.Style('border', 'border', {
        scope: Parchment.Scope.INLINE
      });
      const borderRadiusAttributor = new Parchment.Attributor.Style('border-radius', 'border-radius', {
        scope: Parchment.Scope.INLINE
      });
      const lineHeightAttributor = new Parchment.Attributor.Style('line-height', 'line-height', {
        scope: Parchment.Scope.INLINE
      });
      const verticalAlignAttributor = new Parchment.Attributor.Style('vertical-align', 'vertical-align', {
        scope: Parchment.Scope.INLINE
      });
      const paddingAttributor = new Parchment.Attributor.Style('padding', 'padding', {
        scope: Parchment.Scope.INLINE
      });
      const boxSizingAttributor = new Parchment.Attributor.Style('box-sizing', 'box-sizing', {
        scope: Parchment.Scope.INLINE
      });

      Quill.register(displayAttributor, true);
      Quill.register(widthAttributor, true);
      Quill.register(heightAttributor, true);
      Quill.register(borderAttributor, true);
      Quill.register(borderRadiusAttributor, true);
      Quill.register(lineHeightAttributor, true);
      Quill.register(verticalAlignAttributor, true);
      Quill.register(paddingAttributor, true);
      Quill.register(boxSizingAttributor, true);
    }
  } catch (err) {
    console.error('Failed to configure Quill attributors:', err);
  }
}

const SYMBOL_CATEGORIES = [
  {
    name: 'Kare Simgeleri',
    symbols: [
      { char: '■', label: 'Dolu Kare' },
      { char: '□', label: 'Boş Kare' },
      { char: '☐', label: 'Boş Kutucuk' },
      { char: '☑', label: 'Onaylı Kutucuk' },
      { char: '☒', label: 'Çarpılı Kutucuk' },
    ]
  },
  {
    name: 'Daire Simgeleri',
    symbols: [
      { char: '●', label: 'Dolu Daire' },
      { char: '○', label: 'Boş Daire' },
      { char: '◎', label: 'Çift Halkalı Daire' },
      { char: '◯', label: 'Büyük Halka' },
      { char: '🔘', label: 'Radyo Butonu' },
    ]
  },
  {
    name: 'Diğer Şekiller',
    symbols: [
      { char: '▲', label: 'Dolu Üçgen Yukarı' },
      { char: '△', label: 'Boş Üçgen Yukarı' },
      { char: '▼', label: 'Dolu Üçgen Aşağı' },
      { char: '▽', label: 'Boş Üçgen Aşağı' },
      { char: '◆', label: 'Dolu Elmas' },
      { char: '◇', label: 'Boş Elmas' },
      { char: '★', label: 'Dolu Yıldız' },
      { char: '☆', label: 'Boş Yıldız' },
      { char: '♥', label: 'Dolu Kalp' },
      { char: '♡', label: 'Boş Kalp' },
    ]
  },
  {
    name: 'İşaretler & Parıltılar',
    symbols: [
      { char: '✓', label: 'Onay İşareti' },
      { char: '✔', label: 'Kalın Onay' },
      { char: '✗', label: 'Çarpı İşareti' },
      { char: '✘', label: 'Kalın Çarpı' },
      { char: '✦', label: 'Dolu Kıvılcım' },
      { char: '✧', label: 'Boş Kıvılcım' },
    ]
  },
  {
    name: 'Sayı Simgeleri',
    symbols: [
      { char: '①', label: 'Numara 1 (Çemberli)' },
      { char: '②', label: 'Numara 2 (Çemberli)' },
      { char: '③', label: 'Numara 3 (Çemberli)' },
      { char: '④', label: 'Numara 4 (Çemberli)' },
      { char: '⑤', label: 'Numara 5 (Çemberli)' },
      { char: '❶', label: 'Numara 1 (Koyu Çember)' },
      { char: '❷', label: 'Numara 2 (Koyu Çember)' },
      { char: '❸', label: 'Numara 3 (Koyu Çember)' },
      { char: '❹', label: 'Numara 4 (Koyu Çember)' },
      { char: '❺', label: 'Numara 5 (Koyu Çember)' },
    ]
  }
];

export function TemplateModule() {
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<LetterTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [contents, setContents] = useState<Record<string, string>>({ 'TUR': '' });
  const [activeLang, setActiveLang] = useState<string>('TUR');
  const [languageOrder, setLanguageOrder] = useState<string[]>(['TUR']);
  const [isTranslating, setIsTranslating] = useState(false);
  const [newLangCode, setNewLangCode] = useState('');
  const [isAddingLang, setIsAddingLang] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Ref for ReactQuill
  const quillRef = useRef<any>(null);

  // Shapes & Character Assistant states
  const [isShapePanelOpen, setIsShapePanelOpen] = useState(false);

  // Unified character-based shapes states
  const [selectedChar, setSelectedChar] = useState<string>('●');
  const [charSize, setCharSize] = useState<number>(20);
  const [charColor, setCharColor] = useState('#475569');

  // Custom text within a box state
  const [customBoxCharText, setCustomBoxCharText] = useState('1');
  const [customBoxCharShape, setCustomBoxCharShape] = useState<'square' | 'circle'>('square');
  const [activeTabSub, setActiveTabSub] = useState<'symbol' | 'customBox'>('symbol');

  const insertHtmlAtCursor = (html: string) => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const range = editor.getSelection();
      if (range) {
        editor.clipboard.dangerouslyPasteHTML(range.index, html);
        // Move cursor to immediately after the inserted element
        editor.setSelection(range.index + 1);
      } else {
        // Fallback to paste at caret or end
        const length = editor.getLength();
        editor.clipboard.dangerouslyPasteHTML(length, html);
        editor.setSelection(length + 1);
      }
    } else {
      // Fallback to appending if quill isn't loaded
      setContents(prev => {
        const currentContent = prev[activeLang] || '';
        let newContent = currentContent;
        if (newContent.endsWith('</p>')) {
          newContent = newContent.slice(0, -4) + html + '</p>';
        } else {
          newContent += html;
        }
        return { ...prev, [activeLang]: newContent };
      });
    }
    setHasUnsavedChanges(true);
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'letter_templates'));
      const fetchedTemplates: LetterTemplate[] = [];
      querySnapshot.forEach((doc) => {
        fetchedTemplates.push({ id: doc.id, ...doc.data() } as LetterTemplate);
      });
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      alert("Şablonlar yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const checkUnsaved = () => {
    if (hasUnsavedChanges) {
      return window.confirm("Kaydedilmemiş değişiklikleriniz var. Devam ederseniz bu değişiklikler kaybolacak. Onaylıyor musunuz?");
    }
    return true;
  };

  const handleSelectTemplate = (template: LetterTemplate) => {
    if (!checkUnsaved()) return;
    setSelectedTemplate(template);
    setName(template.name);
    const templateContents = template.contents || { 'TUR': '' };
    setContents(templateContents);
    
    const order = template.languageOrder || ['TUR', ...Object.keys(templateContents).filter(k => k !== 'TUR')];
    setLanguageOrder(order);
    setActiveLang(order[0] || 'TUR');
    
    setIsEditing(true);
    setHasUnsavedChanges(false);
    setShowPreview(false);
  };

  const handleCreateNew = () => {
    if (!checkUnsaved()) return;
    setSelectedTemplate(null);
    setName('');
    setContents({ 'TUR': '', 'ENG': '' });
    setLanguageOrder(['TUR', 'ENG']);
    setActiveLang('TUR');
    setIsEditing(true);
    setHasUnsavedChanges(false);
    setShowPreview(false);
  };

  const handleSave = async () => {
    if (!name) {
      alert("Lütfen şablon adını doldurun.");
      return;
    }

    if (Object.keys(contents).length === 0) {
      alert("Lütfen en az bir dil varyasyonu ekleyin.");
      return;
    }

    try {
      if (selectedTemplate) {
        const templateRef = doc(db, 'letter_templates', selectedTemplate.id);
        await updateDoc(templateRef, {
          name,
          contents,
          languageOrder,
          updatedAt: serverTimestamp()
        });
        setSelectedTemplate({ ...selectedTemplate, name, contents, languageOrder });
        alert("Şablon başarıyla güncellendi.");
      } else {
        const docRef = await addDoc(collection(db, 'letter_templates'), {
          name,
          contents,
          languageOrder,
          createdAt: serverTimestamp()
        });
        setSelectedTemplate({ id: docRef.id, name, contents, languageOrder, createdAt: new Date().toISOString() } as LetterTemplate);
        alert("Yeni şablon başarıyla oluşturuldu.");
      }
      setHasUnsavedChanges(false);
      fetchTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Şablon kaydedilirken bir hata oluştu.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bu şablonu silmek istediğinize emin misiniz?")) return;

    try {
      await deleteDoc(doc(db, 'letter_templates', id));
      alert("Şablon başarıyla silindi.");
      if (selectedTemplate?.id === id) {
        setIsEditing(false);
        setSelectedTemplate(null);
        setHasUnsavedChanges(false);
      }
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Şablon silinirken bir hata oluştu.");
    }
  };

  const handleAddLanguage = () => {
    if (!newLangCode.trim()) return;
    const code = newLangCode.trim().toUpperCase();
    if (!contents[code]) {
      setContents(prev => ({ ...prev, [code]: '' }));
      setLanguageOrder(prev => [...prev, code]);
      setHasUnsavedChanges(true);
    }
    setActiveLang(code);
    setNewLangCode('');
    setIsAddingLang(false);
  };

  const handleRemoveLanguage = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (code === 'TUR') {
      alert("Ana dil (TUR) silinemez.");
      return;
    }
    if (Object.keys(contents).length <= 1) {
      alert("En az bir dil varyasyonu bulunmalıdır.");
      return;
    }
    if (!window.confirm(`${code} dil varyasyonunu silmek istediğinize emin misiniz?`)) return;
    
    const newContents = { ...contents };
    delete newContents[code];
    setContents(newContents);
    
    const newOrder = languageOrder.filter(l => l !== code);
    setLanguageOrder(newOrder);
    
    if (activeLang === code) {
      setActiveLang(newOrder[0] || 'TUR');
    }
    setHasUnsavedChanges(true);
  };

  const moveLanguage = (direction: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = languageOrder.indexOf(activeLang);
    if (currentIndex === -1 || activeLang === 'TUR') return;

    const newOrder = [...languageOrder];
    if (direction === 'left' && currentIndex > 1) {
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
      setLanguageOrder(newOrder);
      setHasUnsavedChanges(true);
    } else if (direction === 'right' && currentIndex < newOrder.length - 1) {
      [newOrder[currentIndex + 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex + 1]];
      setLanguageOrder(newOrder);
      setHasUnsavedChanges(true);
    }
  };

  const handleContentChange = (content: string, delta: any, source: string) => {
    // Sync state regardless of source (user or api) to capture shape builder insertions
    setContents(prev => ({ ...prev, [activeLang]: content }));
    setHasUnsavedChanges(true);
  };

  const handleInsertTag = (tag: string) => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const range = editor.getSelection();
      if (range) {
        editor.insertText(range.index, tag);
        editor.setSelection(range.index + tag.length);
      } else {
        const length = editor.getLength();
        const insertPos = Math.max(0, length - 1);
        editor.insertText(insertPos, tag);
        editor.setSelection(insertPos + tag.length);
      }
    } else {
      setContents(prev => {
        const currentContent = prev[activeLang] || '';
        let newContent = currentContent;
        if (newContent.endsWith('</p>')) {
          newContent = newContent.slice(0, -4) + tag + '</p>';
        } else {
          newContent += tag;
        }
        return { ...prev, [activeLang]: newContent };
      });
    }
    setHasUnsavedChanges(true);
  };

  const handleTranslate = async () => {
    if (!contents['TUR'] || contents['TUR'].trim() === '' || contents['TUR'] === '<p><br></p>') {
      alert("Lütfen önce Türkçe (TUR) içeriği doldurun. Boş içerik çevrilemez.");
      return;
    }
    
    setIsTranslating(true);
    try {
      const prompt = `Aşağıdaki otel şablon metnini ${activeLang} diline çevir. 
      {{GUESTNAMES}}, {{ROOMNO}}, {{CHECKIN}}, {{CHECKOUT}}, {{AGENCY}} gibi etiketleri kesinlikle değiştirme, oldukları gibi bırak. HTML etiketlerini koru.
      
      Metin:
      ${contents['TUR']}`;

      const translatedText = await generateAIContent(prompt, 'Şablon Çevirisi', 'templateTranslation');
      if (translatedText) {
        setContents(prev => ({ ...prev, [activeLang]: translatedText }));
        setHasUnsavedChanges(true);
      }
    } catch (error) {
      console.error("Translation error:", error);
      alert("Çeviri sırasında bir hata oluştu.");
    } finally {
      setIsTranslating(false);
    }
  };

  const quillModules = {
    toolbar: {
      container: '#custom-toolbar',
    }
  };

  const smartTags = ['{{GUESTNAMES}}', '{{ROOMNO}}', '{{CHECKIN}}', '{{CHECKOUT}}', '{{AGENCY}}'];

  return (
    <div className="flex-1 flex overflow-hidden h-full w-full">
      {/* Sidebar: Template List */}
      <div className="w-1/3 min-w-[320px] max-w-[400px] bg-white border-r border-slate-200 flex flex-col h-full print:hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FileText size={20} className="text-slate-500" />
            Şablonlar
          </h2>
          <button 
            onClick={handleCreateNew}
            className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
            title="Yeni Şablon Ekle"
          >
            <Plus size={18} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-8">
              Henüz şablon bulunmuyor.
            </div>
          ) : (
            templates.map((template) => {
              const langs = template.languageOrder || Object.keys(template.contents || {});
              return (
                <div
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 group ${
                    selectedTemplate?.id === template.id
                      ? 'bg-slate-50 border-slate-900 shadow-sm'
                      : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-slate-900 truncate pr-2">{template.name}</h3>
                    <div className="flex gap-1">
                      {langs.slice(0, 3).map(lang => (
                        <span key={lang} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {lang}
                        </span>
                      ))}
                      {langs.length > 3 && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          +{langs.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {langs.length > 0 ? template.contents[langs[0]]?.replace(/<[^>]*>?/gm, '') : 'İçerik yok'}
                  </p>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      title="Sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content: Edit Form */}
      <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden">
        {isEditing ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0 print:hidden">
              <div className="flex-1 max-w-xl">
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => { setName(e.target.value); setHasUnsavedChanges(true); }}
                  placeholder="Şablon Adı (Örn: Çıkış Anketi)"
                  className="w-full px-3 py-2 border-b-2 border-transparent hover:border-slate-200 focus:border-emerald-500 bg-transparent focus:outline-none transition-all font-semibold text-xl text-slate-800 placeholder:text-slate-400"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm mr-2">
                  <button
                    onClick={() => setShowPreview(false)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${!showPreview ? 'bg-slate-100 text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <Edit2 size={14} />
                    Düzenle
                  </button>
                  <button
                    onClick={() => setShowPreview(true)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${showPreview ? 'bg-slate-100 text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <Eye size={14} />
                    A4 Önizleme
                  </button>
                </div>
                {hasUnsavedChanges && (
                  <span className="flex items-center gap-1.5 text-amber-600 text-sm font-medium bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                    <AlertTriangle size={16} />
                    Kaydedilmemiş Değişiklikler
                  </span>
                )}
                <button 
                  onClick={() => {
                    if (checkUnsaved()) {
                      setIsEditing(false);
                      setHasUnsavedChanges(false);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Kapat
                </button>
                <button 
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges && !!selectedTemplate}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
                >
                  <Save size={16} />
                  Kaydet
                </button>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Language Tabs */}
              <div className="bg-white border-b border-slate-200 shrink-0 print:hidden">
                <div className="flex items-center justify-between px-6">
                  <div className="flex overflow-x-auto hide-scrollbar">
                    {languageOrder.map((lang, index) => (
                      <div 
                        key={lang}
                        className={`group flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium cursor-pointer transition-colors ${
                          activeLang === lang 
                            ? 'border-emerald-500 text-emerald-700 bg-emerald-50/30' 
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                        onClick={() => setActiveLang(lang)}
                      >
                        <Globe size={16} className={activeLang === lang ? 'text-emerald-500' : 'text-slate-400'} />
                        {lang}
                        {lang === 'TUR' && activeLang === 'TUR' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded ml-1 font-bold">ANA DİL</span>}
                        
                        {/* Reorder buttons */}
                        {activeLang === lang && lang !== 'TUR' && (
                          <div className="flex items-center ml-2 bg-white rounded shadow-sm border border-slate-200">
                            <button 
                              onClick={(e) => moveLanguage('left', e)}
                              disabled={index === 1}
                              className="p-0.5 hover:bg-slate-100 disabled:opacity-30 text-slate-600"
                            >
                              <ArrowLeft size={14} />
                            </button>
                            <button 
                              onClick={(e) => moveLanguage('right', e)}
                              disabled={index === languageOrder.length - 1}
                              className="p-0.5 hover:bg-slate-100 disabled:opacity-30 text-slate-600 border-l border-slate-200"
                            >
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        )}

                        {lang !== 'TUR' && (
                          <button 
                            onClick={(e) => handleRemoveLanguage(lang, e)}
                            className={`ml-2 p-0.5 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity`}
                            title="Dili Sil"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="pl-4 py-2 flex items-center">
                    {isAddingLang ? (
                      <div className="flex items-center gap-2">
                        <input 
                          type="text"
                          value={newLangCode}
                          onChange={(e) => setNewLangCode(e.target.value.toUpperCase())}
                          placeholder="Örn: RUS"
                          maxLength={3}
                          className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-emerald-500 uppercase"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleAddLanguage()}
                        />
                        <button onClick={handleAddLanguage} className="text-emerald-600 hover:text-emerald-700 p-1">
                          <CheckCircle2 size={18} />
                        </button>
                        <button onClick={() => setIsAddingLang(false)} className="text-slate-400 hover:text-slate-600 p-1">
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setIsAddingLang(true)}
                        className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                      >
                        <Plus size={16} />
                        Dil Ekle
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
                <div className="px-6 py-3 flex justify-between items-center shrink-0 print:hidden bg-white border-b border-slate-200 z-10">
                  <div className="flex items-center gap-4">
                    <div id="custom-toolbar" className={`ql-toolbar ql-snow flex items-center gap-1 border-slate-200 ${showPreview ? 'hidden' : ''}`} style={{ border: 'none', padding: 0 }}>
                      <span className="ql-formats">
                        <button className="ql-bold" />
                        <button className="ql-italic" />
                        <button className="ql-underline" />
                      </span>
                      <span className="ql-formats">
                        <button className="ql-list" value="ordered" />
                        <button className="ql-list" value="bullet" />
                      </span>
                      <span className="ql-formats">
                        <select className="ql-align" />
                      </span>
                      <span className="ql-formats">
                        <button className="ql-link" />
                        <button className="ql-image" />
                      </span>
                      <span className="ql-formats">
                        <button className="ql-clean" />
                      </span>
                    </div>
                    {!showPreview && (
                      <button
                        onClick={() => setIsShapePanelOpen(!isShapePanelOpen)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-sm transition-all focus:outline-none cursor-pointer ${
                          isShapePanelOpen
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-inner'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                        title="Karakter & Şekil Yardımcısını Göster/Gizle"
                      >
                        <Sparkles size={13} className={isShapePanelOpen ? 'text-emerald-600 fill-emerald-100' : 'text-slate-400'} />
                        Karakter & Şekil Yardımcısı
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button
                        onClick={handleTranslate}
                        disabled={isTranslating}
                        className={`flex items-center gap-2 text-sm font-medium text-emerald-700 px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-50 ${!showPreview && activeLang !== 'TUR' ? '' : 'invisible'}`}
                      >
                        <Globe size={16} />
                        {isTranslating ? 'Çevriliyor...' : 'Türkçe\'den Çevir'}
                      </button>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {smartTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => handleInsertTag(tag)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 rounded-md text-xs font-mono transition-colors border border-slate-200 shadow-sm"
                          title="İçeriğe Ekle"
                        >
                          <Plus size={12} className="text-emerald-500" />
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 flex overflow-hidden relative">
                  {/* Left: Editor A4 Canvas Container */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-100 print:p-0 print:bg-white">
                    {!showPreview ? (
                      <div className="w-full max-w-[210mm] bg-white shadow-xl border border-slate-200 flex flex-col relative a4-editor-container h-fit min-h-[297mm]">
                        <QuillComponent 
                          ref={quillRef}
                          theme="snow"
                          value={contents[activeLang] || ''}
                          onChange={handleContentChange}
                          modules={quillModules}
                          placeholder={`Sayın {{GUESTNAMES}}, otelimize hoş geldiniz...\n\n(${activeLang} dilinde içerik girin)`}
                          className="font-sans flex-1 flex flex-col a4-editor"
                        />
                      </div>
                    ) : (
                      <div className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-xl border border-slate-200 p-[20mm] relative group print:shadow-none print:border-none print:p-0">
                        <button 
                          onClick={() => window.print()}
                          className="absolute top-4 right-4 bg-slate-800 text-white p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-lg print:hidden hover:bg-slate-700"
                          title="Yazdır / PDF Olarak Kaydet"
                        >
                          <Printer size={20} />
                        </button>
                        <div 
                          dangerouslySetInnerHTML={{ __html: contents[activeLang] || '<p class="text-slate-400 italic">İçerik boş...</p>' }} 
                          className="prose max-w-none prose-slate"
                        />
                      </div>
                    )}
                  </div>

                  {/* Right: Shape Assistant Panel (Slick Collapsible Side Panel) */}
                  {!showPreview && (
                    <div className={`border-l border-slate-200 bg-white flex flex-col h-full transition-all duration-300 print:hidden relative shrink-0 ${isShapePanelOpen ? 'w-80' : 'w-12'}`}>
                      {/* Control Toggle Button */}
                      <button
                        onClick={() => setIsShapePanelOpen(!isShapePanelOpen)}
                        className="absolute top-1/2 -left-3.5 -translate-y-1/2 w-7 h-7 bg-white hover:bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center shadow-md z-10 hover:text-emerald-600 transition-colors"
                        title={isShapePanelOpen ? "Paneli Kapat" : "Şekil Yardımcısını Aç"}
                      >
                        {isShapePanelOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                      </button>

                      {isShapePanelOpen ? (
                        <div className="flex flex-col h-full overflow-hidden">
                          {/* Panel Header */}
                          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 font-sans">
                                <Sparkles size={16} className="text-emerald-500" />
                                Karakter & Şekil Yardımcısı
                              </h3>
                              <p className="text-[11px] text-slate-500 mt-0.5 font-sans">Otomatik ve tam entegre karakter kontrolü</p>
                            </div>
                          </div>

                          {/* Navigation Tabs */}
                          <div className="flex p-1 bg-slate-100 m-3 rounded-lg text-xs font-semibold shrink-0 font-sans">
                            <button
                              onClick={() => setActiveTabSub('symbol')}
                              className={`flex-1 py-1.5 rounded-md text-center transition-all cursor-pointer ${activeTabSub === 'symbol' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                              Semboller
                            </button>
                            <button
                              onClick={() => {
                                setActiveTabSub('customBox');
                                // Select a sensible default if switching
                              }}
                              className={`flex-1 py-1.5 rounded-md text-center transition-all cursor-pointer ${activeTabSub === 'customBox' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                              Özel Kutu
                            </button>
                          </div>

                          {/* Scrollable Contents */}
                          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
                            
                            {/* TAB 1: SYMBOL SELECTOR */}
                            {activeTabSub === 'symbol' && (
                              <div className="space-y-4">
                                {SYMBOL_CATEGORIES.map((cat, idx) => (
                                  <div key={idx} className="space-y-1.5">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block font-sans">{cat.name}</span>
                                    <div className="grid grid-cols-5 gap-1">
                                      {cat.symbols.map((sym) => (
                                        <button
                                          key={sym.char}
                                          type="button"
                                          onClick={() => setSelectedChar(sym.char)}
                                          className={`aspect-square p-0 rounded-lg border text-center transition-all flex flex-col items-center justify-center cursor-pointer ${selectedChar === sym.char ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50 bg-white text-slate-700'}`}
                                          title={sym.label}
                                        >
                                          <span className="text-lg leading-none font-sans" style={{ color: selectedChar === sym.char ? '#047857' : 'inherit' }}>
                                            {sym.char}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* TAB 2: CUSTOM BOX BUILDER */}
                            {activeTabSub === 'customBox' && (
                              <div className="space-y-3.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                <div>
                                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1 font-sans">Kutu İçi Karakter / Metin</span>
                                  <input
                                    type="text"
                                    value={customBoxCharText}
                                    onChange={(e) => setCustomBoxCharText(e.target.value)}
                                    placeholder="Metin girin (Örn: A, B, X, 10, ✔)"
                                    maxLength={8}
                                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-emerald-500 font-sans shadow-sm"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block font-sans">Kutu Tasarımı</span>
                                  <div className="flex bg-slate-200/60 p-0.5 rounded-lg text-xs font-semibold font-sans">
                                    <button
                                      type="button"
                                      onClick={() => setCustomBoxCharShape('square')}
                                      className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${customBoxCharShape === 'square' ? 'bg-white text-slate-850 font-bold shadow-xs' : 'text-slate-500 bg-transparent border-0'}`}
                                    >
                                      Kare Çerçeveli
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCustomBoxCharShape('circle')}
                                      className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${customBoxCharShape === 'circle' ? 'bg-white text-slate-850 font-bold shadow-xs' : 'text-slate-500 bg-transparent border-0'}`}
                                    >
                                      Daire Çerçeveli
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* UNIFIED CONTROLS: COLOR & SIZE */}
                            <div className="border-t border-slate-150 pt-4 space-y-4">
                              {/* Unified Color Picker */}
                              <div className="space-y-1.5">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block font-sans">Renk Tonu</span>
                                <div className="flex flex-wrap gap-1.5 justify-between">
                                  {[
                                    { name: 'Siyah', value: '#000000' },
                                    { name: 'Koyu Gri', value: '#475569' },
                                    { name: 'Mavi', value: '#2563eb' },
                                    { name: 'Zümrüt Yeşil', value: '#059669' },
                                    { name: 'Kırmızı', value: '#dc2626' },
                                    { name: 'Turuncu', value: '#d97706' },
                                    { name: 'Kraliyet Moru', value: '#7c3aed' },
                                    { name: 'Pembe', value: '#db2777' }
                                  ].map(item => (
                                    <button
                                      key={item.value}
                                      type="button"
                                      onClick={() => setCharColor(item.value)}
                                      className={`w-6.5 h-6.5 rounded-full border border-white shadow-xs transition-all relative cursor-pointer ${charColor === item.value ? 'scale-115 ring-2 ring-emerald-500' : 'hover:scale-105'}`}
                                      style={{ backgroundColor: item.value }}
                                      title={item.name}
                                    />
                                  ))}
                                </div>
                                <div className="flex items-center gap-2 mt-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                  <input 
                                    type="color" 
                                    value={charColor} 
                                    onChange={(e) => setCharColor(e.target.value)}
                                    className="w-5 h-5 rounded border-0 cursor-pointer p-0 bg-transparent"
                                  />
                                  <input 
                                    type="text" 
                                    value={charColor} 
                                    onChange={(e) => setCharColor(e.target.value)}
                                    placeholder="#475569"
                                    className="flex-1 bg-transparent text-[11px] font-mono border-0 focus:outline-none p-0 text-slate-605"
                                  />
                                </div>
                              </div>

                              {/* Unified Size Picker */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center font-sans">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-sans">Boyut (Font Size)</span>
                                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md font-mono">{charSize}px</span>
                                </div>
                                <div className="flex gap-1 mb-1.5 font-sans">
                                  {[14, 18, 22, 28, 36, 46].map(s => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => setCharSize(s)}
                                      className={`flex-1 py-1 border text-[10px] rounded-md transition-all cursor-pointer ${charSize === s ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold bg-white' : 'border-slate-200 text-slate-500 bg-white'}`}
                                    >
                                      {s}px
                                    </button>
                                  ))}
                                </div>
                                <input
                                  type="range"
                                  min={12}
                                  max={60}
                                  value={charSize}
                                  onChange={(e) => setCharSize(parseInt(e.target.value))}
                                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                              </div>
                            </div>

                            {/* DYNAMIC COMPONENT PREVIEW & ACTION BOX */}
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex flex-col items-center">
                              <span className="text-[10px] font-semibold text-slate-400 mb-1.5 self-start font-sans">Önizleme (Editöre Eklenecek):</span>
                              
                              <div className="min-h-16 flex items-center justify-center p-3 border border-dashed border-slate-200 rounded-lg w-full bg-white/70 overflow-hidden">
                                {activeTabSub === 'symbol' && (
                                  <span style={{
                                    fontSize: `${charSize}px`,
                                    color: charColor,
                                    lineHeight: 1,
                                    display: 'inline-block',
                                    fontFamily: 'sans-serif'
                                  }}>
                                    {selectedChar}
                                  </span>
                                )}

                                {activeTabSub === 'customBox' && (
                                  (() => {
                                    const isLong = customBoxCharText.length > 1;
                                    const pad = isLong ? '2px 8px' : '0px';
                                    const sizeVal = `${charSize + 4}px`;
                                    const lHeight = `${charSize + 2}px`;
                                    const bRadius = customBoxCharShape === 'circle' ? '50%' : '4px';
                                    return (
                                      <span style={{
                                        display: 'inline-block',
                                        padding: pad,
                                        width: isLong ? 'auto' : sizeVal,
                                        height: sizeVal,
                                        lineHeight: lHeight,
                                        textAlign: 'center',
                                        border: `1.5px solid ${charColor}`,
                                        borderRadius: bRadius,
                                        fontFamily: 'sans-serif',
                                        fontSize: `${charSize - 4}px`,
                                        fontWeight: 'bold',
                                        color: charColor,
                                        boxSizing: 'border-box'
                                      }}>
                                        {customBoxCharText || ' '}
                                      </span>
                                    );
                                  })()
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (activeTabSub === 'symbol') {
                                    const shapeHtml = `<span style="font-size:${charSize}px;color:${charColor};font-family:sans-serif;vertical-align:middle;margin:0 4px;line-height:1;display:inline-block;">${selectedChar}</span>`;
                                    insertHtmlAtCursor(shapeHtml);
                                  } else if (activeTabSub === 'customBox') {
                                    const isLong = customBoxCharText.length > 1;
                                    const pad = isLong ? '2px 8px' : '0px';
                                    const sizeVal = `${charSize + 4}px`;
                                    const lHeight = `${charSize + 2}px`;
                                    const bRadius = customBoxCharShape === 'circle' ? '50%' : '4px';
                                    const shapeHtml = `<span style="display:inline-block;padding:${pad};width:${isLong ? 'auto' : sizeVal};height:${sizeVal};line-height:${lHeight};text-align:center;border:1.5px solid ${charColor};border-radius:${bRadius};font-family:sans-serif;font-size:${charSize - 4}px;font-weight:bold;color:${charColor};vertical-align:middle;margin:0 4px;background-color:#ffffff;box-sizing:border-box;">${customBoxCharText || '&nbsp;'}</span>`;
                                    insertHtmlAtCursor(shapeHtml);
                                  }
                                }}
                                className="w-full mt-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer font-sans border-0 text-center"
                              >
                                İmleç Konumuna Ekle
                              </button>
                            </div>

                          </div>
                        </div>
                      ) : (
                        /* Closed panel mode indicator */
                        <div className="flex flex-col items-center py-4 space-y-6 h-full font-sans cursor-pointer justify-center" onClick={() => setIsShapePanelOpen(true)}>
                          <button
                            type="button"
                            onClick={() => setIsShapePanelOpen(true)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-emerald-600 transition-colors bg-transparent border-0"
                            title="Şekil Yardımcısını Aç"
                          >
                            <Sparkles size={18} />
                          </button>
                          <div className="flex-grow flex flex-col items-center justify-center space-y-4">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest select-none [writing-mode:vertical-lr] font-sans">
                              ŞEKİL YARDIMCISI
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center print:hidden">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <LayoutTemplate size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-medium text-slate-600 mb-2">Şablon Yöneticisi</h3>
            <p className="max-w-md text-sm">
              Sol taraftaki listeden bir şablon seçin veya yeni bir şablon oluşturarak misafirlerinize özel otomatik anket ve mektuplar hazırlayın.
            </p>
            <button 
              onClick={handleCreateNew}
              className="mt-6 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              Yeni Şablon Oluştur
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
