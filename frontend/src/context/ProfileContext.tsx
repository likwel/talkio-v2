import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import ProfileModal from '@/components/ProfileModal';

interface ProfileApi {
  openProfile: (userId: string) => void;
}

const Ctx = createContext<ProfileApi | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const openProfile = useCallback((id: string) => setUserId(id), []);

  return (
    <Ctx.Provider value={{ openProfile }}>
      {children}
      <ProfileModal userId={userId} onClose={() => setUserId(null)} />
    </Ctx.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProfile hors ProfileProvider');
  return ctx;
}
