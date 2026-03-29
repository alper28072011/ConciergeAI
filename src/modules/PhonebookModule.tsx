import React, { useState, useEffect } from 'react';
import { Phone, User, Building2, Plus, Trash2, Search, Loader2, PhoneCall } from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { PhonebookContact } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

export function PhonebookModule() {
  const [contacts, setContacts] = useState<PhonebookContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [newContact, setNewContact] = useState({
    fullName: '',
    department: '',
    phoneNumber: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'phonebook'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactList: PhonebookContact[] = [];
      snapshot.forEach((doc) => {
        contactList.push({ id: doc.id, ...doc.data() } as PhonebookContact);
      });
      setContacts(contactList);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.fullName || !newContact.department || !newContact.phoneNumber) return;

    setIsAdding(true);
    try {
      // Ensure phone number starts with 90 if it's a 10-digit number
      let formattedPhone = newContact.phoneNumber.replace(/\D/g, '');
      if (formattedPhone.length === 10) {
        formattedPhone = '90' + formattedPhone;
      } else if (formattedPhone.length === 11 && formattedPhone.startsWith('0')) {
        formattedPhone = '90' + formattedPhone.substring(1);
      }

      await addDoc(collection(db, 'phonebook'), {
        fullName: newContact.fullName,
        department: newContact.department,
        phoneNumber: formattedPhone,
        createdAt: new Date().toISOString()
      });

      setNewContact({ fullName: '', department: '', phoneNumber: '' });
    } catch (error) {
      console.error("Error adding contact:", error);
      alert("Kişi eklenirken bir hata oluştu.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!window.confirm("Bu kişiyi silmek istediğinize emin misiniz?")) return;

    try {
      await deleteDoc(doc(db, 'phonebook', id));
    } catch (error) {
      console.error("Error deleting contact:", error);
      alert("Kişi silinirken bir hata oluştu.");
    }
  };

  const filteredContacts = contacts.filter(contact => 
    contact.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phoneNumber.includes(searchTerm)
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden">
      <div className="max-w-5xl mx-auto w-full flex flex-col h-full">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Telefon Defteri & Departmanlar</h1>
            <p className="text-slate-500">Departman sorumlularını yönetin ve WhatsApp yönlendirmeleri için rehber oluşturun.</p>
          </div>
          <div className="bg-emerald-100 p-3 rounded-2xl">
            <PhoneCall className="text-emerald-600" size={24} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
          
          {/* Add Contact Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-0">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Plus size={18} className="text-emerald-500" />
                Yeni Kişi Ekle
              </h2>
              
              <form onSubmit={handleAddContact} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ad Soyad</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      required
                      value={newContact.fullName}
                      onChange={(e) => setNewContact({...newContact, fullName: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm"
                      placeholder="Örn: Mehmet Yılmaz"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Departman</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      required
                      value={newContact.department}
                      onChange={(e) => setNewContact({...newContact, department: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm"
                      placeholder="Örn: F&B Müdürü"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">WhatsApp Numarası</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="tel"
                      required
                      value={newContact.phoneNumber}
                      onChange={(e) => setNewContact({...newContact, phoneNumber: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm"
                      placeholder="Örn: 532XXXXXXX"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Ülke kodu otomatik eklenir (Varsayılan: 90)</p>
                </div>

                <button
                  type="submit"
                  disabled={isAdding}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isAdding ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                  Rehbere Kaydet
                </button>
              </form>
            </div>
          </div>

          {/* Contact List */}
          <div className="lg:col-span-2 flex flex-col h-full overflow-hidden">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
              
              {/* Search Bar */}
              <div className="p-4 border-bottom border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-sm"
                    placeholder="İsim veya departman ara..."
                  />
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <Loader2 className="animate-spin mb-2" size={32} />
                    <p>Rehber yükleniyor...</p>
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <Search size={48} className="mb-4 opacity-20" />
                    <p>Kişi bulunamadı.</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredContacts.map((contact) => (
                      <motion.div
                        key={contact.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group flex items-center justify-between p-4 bg-slate-50 hover:bg-white hover:shadow-md border border-transparent hover:border-slate-200 rounded-2xl transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 font-bold text-lg">
                            {contact.fullName.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">{contact.fullName}</h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-wider">
                                <Building2 size={10} />
                                {contact.department}
                              </span>
                              <span className="inline-flex items-center gap-1 text-slate-500 text-xs">
                                <Phone size={10} />
                                +{contact.phoneNumber}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
