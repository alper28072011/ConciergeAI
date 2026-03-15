import React, { useState, useEffect, useRef } from 'react';
import { LetterTemplate } from '../types';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Save, Trash2, Plus, FileText, Copy, CheckCircle2, LayoutTemplate, Globe, X, ArrowLeft, ArrowRight, Eye, Edit2, AlertTriangle, Printer } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { generateAIContent } from '../services/aiService';

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
    if (source === 'user') {
      setContents(prev => ({ ...prev, [activeLang]: content }));
      setHasUnsavedChanges(true);
    }
  };

  const handleInsertTag = (tag: string) => {
    setContents(prev => {
      const currentContent = prev[activeLang] || '';
      // If content ends with </p>, insert before it, otherwise just append
      let newContent = currentContent;
      if (newContent.endsWith('</p>')) {
        newContent = newContent.slice(0, -4) + tag + '</p>';
      } else {
        newContent += tag;
      }
      return { ...prev, [activeLang]: newContent };
    });
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
                
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center print:p-0 print:bg-white">
                  {!showPreview ? (
                    <div className="w-full max-w-[210mm] bg-white shadow-xl border border-slate-200 flex flex-col relative a4-editor-container">
                      <ReactQuill 
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
