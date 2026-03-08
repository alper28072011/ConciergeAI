import React, { useState, useEffect } from 'react';
import { LetterTemplate } from '../types';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Save, Trash2, Plus, FileText, Copy, CheckCircle2, LayoutTemplate } from 'lucide-react';

export function TemplateModule() {
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<LetterTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [languageCode, setLanguageCode] = useState('ENG');
  const [content, setContent] = useState('');

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
    setLanguageCode(template.languageCode);
    setContent(template.content);
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setName('');
    setLanguageCode('ENG');
    setContent('');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!name || !content) {
      alert("Lütfen şablon adı ve içeriğini doldurun.");
      return;
    }

    try {
      if (selectedTemplate) {
        // Update
        const templateRef = doc(db, 'letter_templates', selectedTemplate.id);
        await updateDoc(templateRef, {
          name,
          languageCode,
          content,
          updatedAt: serverTimestamp()
        });
        alert("Şablon başarıyla güncellendi.");
      } else {
        // Create
        await addDoc(collection(db, 'letter_templates'), {
          name,
          languageCode,
          content,
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

  const smartTags = ['{{GUEST_NAME}}', '{{ROOM_NO}}', '{{CHECKIN}}', '{{CHECKOUT}}', '{{AGENCY}}'];

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
            templates.map((template) => (
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
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                    {template.languageCode}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">
                  {template.content}
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
            ))
          )}
        </div>
      </div>

      {/* Main Content: Edit Form */}
      <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden">
        {isEditing ? (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Şablon Adı</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Örn: Almanca Hoşgeldin Mektubu"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Uyruk / Dil Kodu</label>
                    <select 
                      value={languageCode}
                      onChange={(e) => setLanguageCode(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                    >
                      <option value="ENG">ENG (İngilizce)</option>
                      <option value="DEU">DEU (Almanca)</option>
                      <option value="TUR">TUR (Türkçe)</option>
                      <option value="RUS">RUS (Rusça)</option>
                      <option value="FRA">FRA (Fransızca)</option>
                      <option value="OTHER">Diğer</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <label className="text-sm font-medium text-slate-700">Şablon İçeriği</label>
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
                  <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={15}
                    placeholder="Sayın {{GUEST_NAME}}, otelimize hoş geldiniz..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans resize-y"
                  />
                  <p className="text-xs text-slate-500">
                    İpucu: Yukarıdaki akıllı etiketleri kopyalayıp metin içine yapıştırarak misafire özel alanlar oluşturabilirsiniz.
                  </p>
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
