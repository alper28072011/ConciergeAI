import React, { useState, useEffect } from 'react';
import { LetterTemplate } from '../types';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Save, Trash2, Plus, FileText, Copy, CheckCircle2, LayoutTemplate, Globe, X } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

export function TemplateModule() {
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<LetterTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [contents, setContents] = useState<Record<string, string>>({ 'ENG': '' });
  const [activeLang, setActiveLang] = useState<string>('ENG');
  const [newLangCode, setNewLangCode] = useState('');
  const [isAddingLang, setIsAddingLang] = useState(false);

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

  const handleSelectTemplate = (template: LetterTemplate) => {
    setSelectedTemplate(template);
    setName(template.name);
    // Ensure contents is an object, fallback to empty ENG if missing
    const templateContents = template.contents || { 'ENG': '' };
    setContents(templateContents);
    setActiveLang(Object.keys(templateContents)[0] || 'ENG');
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setName('');
    setContents({ 'ENG': '' });
    setActiveLang('ENG');
    setIsEditing(true);
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
        // Update
        const templateRef = doc(db, 'letter_templates', selectedTemplate.id);
        await updateDoc(templateRef, {
          name,
          contents,
          updatedAt: serverTimestamp()
        });
        alert("Şablon başarıyla güncellendi.");
      } else {
        // Create
        await addDoc(collection(db, 'letter_templates'), {
          name,
          contents,
          createdAt: serverTimestamp()
        });
        alert("Yeni şablon başarıyla oluşturuldu.");
      }
      fetchTemplates();
      setIsEditing(false);
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
    }
    setActiveLang(code);
    setNewLangCode('');
    setIsAddingLang(false);
  };

  const handleRemoveLanguage = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (Object.keys(contents).length <= 1) {
      alert("En az bir dil varyasyonu bulunmalıdır.");
      return;
    }
    if (!window.confirm(`${code} dil varyasyonunu silmek istediğinize emin misiniz?`)) return;
    
    const newContents = { ...contents };
    delete newContents[code];
    setContents(newContents);
    if (activeLang === code) {
      setActiveLang(Object.keys(newContents)[0]);
    }
  };

  const handleContentChange = (value: string) => {
    setContents(prev => ({ ...prev, [activeLang]: value }));
  };

  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const smartTags = ['{{GUESTNAMES}}', '{{ROOMNO}}', '{{CHECKIN}}', '{{CHECKOUT}}', '{{AGENCY}}'];

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full w-full">
      {/* Sidebar: Template List */}
      <div className="w-1/3 min-w-[320px] max-w-[400px] bg-white border-r border-slate-200 flex flex-col h-full">
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
              const langs = Object.keys(template.contents || {});
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
                    {langs.length > 0 ? template.contents[langs[0]] : 'İçerik yok'}
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
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800">
                  {selectedTemplate ? 'Şablonu Düzenle' : 'Yeni Şablon Oluştur'}
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    İptal
                  </button>
                  <button 
                    onClick={handleSave}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
                  >
                    <Save size={16} />
                    Kaydet
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Şablon Adı</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn: Çıkış Anketi"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-lg"
                  />
                </div>

                {/* Language Tabs */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200">
                    <div className="flex overflow-x-auto hide-scrollbar">
                      {Object.keys(contents).map(lang => (
                        <div 
                          key={lang}
                          className={`group flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium cursor-pointer transition-colors ${
                            activeLang === lang 
                              ? 'border-emerald-500 text-emerald-600' 
                              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                          }`}
                          onClick={() => setActiveLang(lang)}
                        >
                          <Globe size={16} className={activeLang === lang ? 'text-emerald-500' : 'text-slate-400'} />
                          {lang}
                          <button 
                            onClick={(e) => handleRemoveLanguage(lang, e)}
                            className={`p-0.5 rounded-full hover:bg-slate-200 ${activeLang === lang ? 'text-emerald-600 hover:text-emerald-800' : 'text-slate-400 hover:text-slate-600'} opacity-0 group-hover:opacity-100 transition-opacity`}
                            title="Dili Sil"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pl-4 py-2">
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

                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <label className="text-sm font-medium text-slate-700">
                        {activeLang} Şablon İçeriği
                      </label>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {smartTags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => handleCopyTag(tag)}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-xs font-mono transition-colors border border-slate-200"
                            title="Kopyala"
                          >
                            {copiedTag === tag ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                      <ReactQuill 
                        theme="snow"
                        value={contents[activeLang] || ''}
                        onChange={handleContentChange}
                        modules={quillModules}
                        placeholder={`Sayın {{GUESTNAMES}}, otelimize hoş geldiniz...\n\n(${activeLang} dilinde içerik girin)`}
                        className="h-[300px] font-sans"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      İpucu: Yukarıdaki akıllı etiketleri kopyalayıp metin içine yapıştırarak misafire özel alanlar oluşturabilirsiniz.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
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
