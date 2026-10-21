import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AccountUser {
  identifier: string;
  name: string;
  credits: number;
}

export interface Pack {
  id: string;
  name: string;
  credits: number;
  price: number;
}

interface AccountState {
  token: string | null;
  user: AccountUser | null;
  /** Le serveur gère-t-il des comptes ? (false en développement local sans base de données) */
  enabled: boolean;
  /** Fenêtre ouverte : connexion/inscription ou achat de crédits. */
  dialog: null | 'account' | 'credits';
  dialogReason: string | null;

  setSession: (token: string, user: AccountUser) => void;
  setCredits: (credits: number) => void;
  logout: () => void;
  open: (dialog: 'account' | 'credits', reason?: string) => void;
  close: () => void;
}

export const useAccount = create<AccountState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      enabled: false,
      dialog: null,
      dialogReason: null,
      setSession: (token, user) => set({ token, user }),
      setCredits: (credits) => set((s) => (s.user ? { user: { ...s.user, credits } } : {})),
      logout: () => set({ token: null, user: null }),
      open: (dialog, reason) => set({ dialog, dialogReason: reason ?? null }),
      close: () => set({ dialog: null, dialogReason: null }),
    }),
    { name: 'cv-studio-account', partialize: (s) => ({ token: s.token, user: s.user }) },
  ),
);
