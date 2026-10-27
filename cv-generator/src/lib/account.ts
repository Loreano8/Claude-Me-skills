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

/** Offre de retour (4 crédits au prix de 3), ouverte par le serveur au retour après une absence. */
export interface ReturnOffer {
  active: { pack: Pack; expiresAt: string } | null;
  possible: boolean;
  notBefore: string | null;
}

interface AccountState {
  token: string | null;
  user: AccountUser | null;
  /** Le serveur gère-t-il des comptes ? (false en développement local sans base de données) */
  enabled: boolean;
  /** Fenêtre ouverte : connexion/inscription ou achat de crédits. */
  dialog: null | 'account' | 'credits';
  dialogReason: string | null;
  offer: ReturnOffer | null;

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
      offer: null,
      setSession: (token, user) => set({ token, user }),
      setCredits: (credits) => set((s) => (s.user ? { user: { ...s.user, credits } } : {})),
      logout: () => set({ token: null, user: null, offer: null }),
      open: (dialog, reason) => set({ dialog, dialogReason: reason ?? null }),
      close: () => set({ dialog: null, dialogReason: null }),
    }),
    { name: 'cv-studio-account', partialize: (s) => ({ token: s.token, user: s.user, offer: s.offer }) },
  ),
);
