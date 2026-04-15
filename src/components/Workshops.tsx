import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'motion/react';
import { Calendar, MapPin, ExternalLink, Plus, Clock } from 'lucide-react';

interface Workshop {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  formLink?: string;
  createdAt: any;
}

export function Workshops() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form state for adding workshop
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [formLink, setFormLink] = useState('');
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    const dummyWorkshops: Workshop[] = [
      {
        id: 'dummy_workshop_1',
        title: t('dummy_workshop_1_title'),
        description: t('dummy_workshop_1_desc'),
        date: t('dummy_workshop_1_date'),
        location: t('dummy_workshop_1_loc'),
        createdAt: { toDate: () => new Date() }
      },
      {
        id: 'dummy_workshop_2',
        title: t('dummy_workshop_2_title'),
        description: t('dummy_workshop_2_desc'),
        date: t('dummy_workshop_2_date'),
        location: t('dummy_workshop_2_loc'),
        createdAt: { toDate: () => new Date(Date.now() - 86400000) }
      },
      {
        id: 'dummy_workshop_3',
        title: t('dummy_workshop_3_title'),
        description: t('dummy_workshop_3_desc'),
        date: t('dummy_workshop_3_date'),
        location: t('dummy_workshop_3_loc'),
        createdAt: { toDate: () => new Date(Date.now() - 172800000) }
      },
      {
        id: 'dummy_workshop_4',
        title: t('dummy_workshop_4_title'),
        description: t('dummy_workshop_4_desc'),
        date: t('dummy_workshop_4_date'),
        location: t('dummy_workshop_4_loc'),
        createdAt: { toDate: () => new Date(Date.now() - 259200000) }
      },
      {
        id: 'dummy_workshop_5',
        title: t('dummy_workshop_5_title'),
        description: t('dummy_workshop_5_desc'),
        date: t('dummy_workshop_5_date'),
        location: t('dummy_workshop_5_loc'),
        createdAt: { toDate: () => new Date(Date.now() - 345600000) }
      }
    ];

    // Set initial dummy workshops
    setWorkshops(dummyWorkshops);

    const q = query(collection(db, 'workshops'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedWorkshops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workshop));
      setWorkshops([...dummyWorkshops, ...fetchedWorkshops]);
    }, (error) => {
      console.error("Workshops onSnapshot error:", error);
      // Keep dummy workshops on error
      handleFirestoreError(error, OperationType.LIST, 'workshops');
    });
    return unsubscribe;
  }, [user, i18n.language]);

  const handleRegister = (id: string) => {
    setRegisteredIds(prev => [...prev, id]);
  };

  const handleAddWorkshop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'workshops'), {
        title,
        description,
        date,
        location,
        formLink,
        createdAt: serverTimestamp(),
      });
      setIsAdding(false);
      setTitle('');
      setDescription('');
      setDate('');
      setLocation('');
      setFormLink('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'workshops');
    }
  };

  const isAdmin = profile?.role === 'admin' || profile?.uid === 'admin-uid' || profile?.phoneNumber === 'admin'; // Simplified for demo

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">{t('workshops')}</h2>
          <p className="text-gray-500">{t('recent_updates')}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="bg-orange-600 text-white px-4 py-2 rounded-xl flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {t('add_workshop')}
          </button>
        )}
      </div>

      {isAdding && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleAddWorkshop}
          className="bg-white p-6 rounded-3xl border border-orange-100 shadow-xl space-y-4"
        >
          <input
            type="text"
            placeholder={t('workshop_title')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
            required
          />
          <textarea
            placeholder={t('description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder={t('date_placeholder')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-4 py-2 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
            <input
              type="text"
              placeholder={t('location_placeholder')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="px-4 py-2 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <input
            type="url"
            placeholder={t('form_link_optional')}
            value={formLink}
            onChange={(e) => setFormLink(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button type="submit" className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold">
            {t('publish_workshop')}
          </button>
        </motion.form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {workshops.map((workshop) => (
          <motion.div
            key={workshop.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
          >
            <div className="h-32 bg-orange-100 flex items-center justify-center">
              <Calendar className="w-12 h-12 text-orange-600 opacity-50" />
            </div>
            <div className="p-6 flex-1 flex flex-col space-y-4">
              <h3 className="text-xl font-bold text-gray-800">{workshop.title}</h3>
              <p className="text-gray-600 text-sm flex-1">{workshop.description}</p>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span>{workshop.date}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  <span>{workshop.location}</span>
                </div>
              </div>

              {registeredIds.includes(workshop.id) ? (
                <div className="mt-4 w-full bg-green-50 text-green-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                  {t('registered_successfully')}
                </div>
              ) : (
                <button
                  onClick={() => handleRegister(workshop.id)}
                  className="mt-4 w-full bg-orange-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-700 transition-colors"
                >
                  {t('register_now')}
                </button>
              )}
              
              {workshop.formLink && (
                <a
                  href={workshop.formLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 w-full bg-orange-50 text-orange-700 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors"
                >
                  {t('official_website')}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {workshops.length === 0 && (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{t('no_workshops')}</p>
        </div>
      )}
    </div>
  );
}
