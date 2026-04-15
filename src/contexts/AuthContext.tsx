import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  name: string;
  phoneNumber: string;
  language: string;
  role?: 'admin' | 'user';
  createdAt: any;
}

interface AuthContextType {
  user: { uid: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (name: string, phoneNumber: string, language: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUid = localStorage.getItem('demo_uid');
    const storedProfile = localStorage.getItem('demo_profile');
    
    if (storedUid) {
      setUser({ uid: storedUid });
      if (storedProfile) {
        try {
          setProfile(JSON.parse(storedProfile));
        } catch (e) {
          console.error("Error parsing stored profile", e);
        }
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) {
          const data = { uid: user.uid, ...doc.data() } as UserProfile;
          setProfile(data);
          localStorage.setItem('demo_profile', JSON.stringify(data));
        }
        setLoading(false);
      }, (error) => {
        console.error("Profile snapshot error:", error);
        setLoading(false);
      });
      return unsubscribe;
    }
  }, [user]);

  const signUp = async (name: string, phoneNumber: string, language: string) => {
    console.log("signUp called with:", { name, phoneNumber, language });
    const uid = 'demo_' + Math.random().toString(36).substr(2, 9);
    const userProfile: UserProfile = {
      uid,
      name,
      phoneNumber,
      language,
      createdAt: new Date().toISOString(),
    };

    console.log("Setting local storage and state for UID:", uid);
    localStorage.setItem('demo_uid', uid);
    localStorage.setItem('demo_profile', JSON.stringify(userProfile));
    setUser({ uid });
    setProfile(userProfile);
    setLoading(false);

    try {
      console.log("Syncing to Firestore in background...");
      await setDoc(doc(db, 'users', uid), {
        ...userProfile,
        createdAt: serverTimestamp()
      });
      console.log("Firestore sync complete.");
    } catch (error) {
      console.error("Background sync error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
