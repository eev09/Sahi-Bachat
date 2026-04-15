import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './hooks/useAuth';
import { Auth } from './components/Auth';
import { VoiceAssistant } from './components/VoiceAssistant';
import { Forum } from './components/Forum';
import { Workshops } from './components/Workshops';
import { Profile } from './components/Profile';
import { ApplicationTracker } from './components/ApplicationTracker';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MessageSquare, Calendar, User, LayoutDashboard, ClipboardList } from 'lucide-react';
import { cn } from './lib/utils';
import { TrackedScheme } from './types/schemes';
import { db } from './firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firebaseUtils';
import './i18n';

type Tab = 'voice' | 'forum' | 'workshops' | 'tracker' | 'profile';

export default function App() {
  const { t, i18n } = useTranslation();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (profile?.language && !i18n.language.startsWith(profile.language)) {
      i18n.changeLanguage(profile.language);
    }
  }, [profile?.language, i18n]);
  console.log("App render state:", { hasUser: !!user, hasProfile: !!profile, loading });
  const [activeTab, setActiveTab] = useState<Tab>('voice');
  const [trackedSchemes, setTrackedSchemes] = useState<TrackedScheme[]>([]);
  const [conversationHistory, setConversationHistory] = useState<{speaker: 'user' | 'assistant', text: string}[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'ApplicationTracker'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const schemes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TrackedScheme[];
      setTrackedSchemes(schemes);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'ApplicationTracker');
    });

    return () => unsubscribe();
  }, [user]);

  const addSchemeToTracker = async (scheme: Omit<TrackedScheme, 'id'>) => {
    if (!user) {
      console.error("No user logged in, cannot add scheme to tracker");
      return;
    }
    
    try {
      console.log("Attempting to add scheme to tracker:", scheme.schemeName);
      // Check if already exists in local state to avoid duplicates before Firestore syncs
      const exists = trackedSchemes.find(s => s.schemeName === scheme.schemeName);
      if (exists) {
        console.log(`Scheme "${scheme.schemeName}" already exists in tracker, skipping.`);
        return;
      }

      const docRef = await addDoc(collection(db, 'ApplicationTracker'), {
        ...scheme,
        userId: user.uid,
        createdAt: serverTimestamp(),
        lastUpdated: new Date().toLocaleDateString()
      });
      console.log("Scheme added successfully with ID:", docRef.id);
    } catch (error) {
      console.error("Error in addSchemeToTracker:", error);
      handleFirestoreError(error, OperationType.CREATE, 'ApplicationTracker');
      throw error; // Re-throw to be caught by VoiceAssistant
    }
  };

  const updateSchemeStatus = async (schemeId: string, newStatus: TrackedScheme['status']) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'ApplicationTracker', schemeId);
      await updateDoc(docRef, {
        status: newStatus,
        lastUpdated: new Date().toLocaleDateString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'ApplicationTracker');
    }
  };

  const updateDocumentStatus = async (schemeId: string, docIndex: number, newStatus: 'done' | 'pending') => {
    if (!user) return;
    try {
      const scheme = trackedSchemes.find(s => s.id === schemeId);
      if (!scheme) return;

      const newDocuments = [...scheme.documents];
      newDocuments[docIndex] = { ...newDocuments[docIndex], status: newStatus };

      const docRef = doc(db, 'ApplicationTracker', schemeId);
      await updateDoc(docRef, {
        documents: newDocuments,
        lastUpdated: new Date().toLocaleDateString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'ApplicationTracker');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user || !profile) {
    return <Auth onComplete={() => setActiveTab('voice')} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'voice': return (
        <VoiceAssistant 
          onAddScheme={addSchemeToTracker} 
          conversationHistory={conversationHistory}
          setConversationHistory={setConversationHistory}
        />
      );
      case 'forum': return <Forum />;
      case 'workshops': return <Workshops />;
      case 'tracker': return (
        <ApplicationTracker 
          trackedSchemes={trackedSchemes} 
          onUpdateStatus={updateSchemeStatus}
          onUpdateDocStatus={updateDocumentStatus}
        />
      );
      case 'profile': return <Profile />;
      default: return (
        <VoiceAssistant 
          onAddScheme={addSchemeToTracker} 
          conversationHistory={conversationHistory}
          setConversationHistory={setConversationHistory}
        />
      );
    }
  };

  const navItems = [
    { id: 'voice', icon: Mic, label: t('nav_voice', 'Voice') },
    { id: 'forum', icon: MessageSquare, label: t('nav_forum', 'Forum') },
    { id: 'workshops', icon: Calendar, label: t('nav_workshops', 'Events') },
    { id: 'tracker', icon: ClipboardList, label: t('nav_tracker', 'Tracker') },
    { id: 'profile', icon: User, label: t('nav_profile', 'Profile') },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">Sahi Bachat</h1>
          </div>
          <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">Live</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-lg mx-auto flex justify-between items-center px-1 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-1 rounded-xl transition-all duration-300 relative min-w-0",
                  isActive ? "text-orange-600" : "text-gray-400 hover:text-gray-600"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-x-1 inset-y-0 bg-orange-50 rounded-xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={cn("w-5 h-5 md:w-6 md:h-6", isActive && "scale-110")} />
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider truncate w-full text-center px-1">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
