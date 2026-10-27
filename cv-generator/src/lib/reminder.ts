import { Capacitor } from '@capacitor/core';
import { useState } from 'react';
import { useStore } from '../store.ts';
import { useAccount, type ReturnOffer } from './account.ts';
import type { CvDocument } from '../types.ts';

// Rappel « Une nouvelle offre ? » pour faire revenir la personne à chaque candidature :
// une bannière dans l'appli au retour, et sur Android une notification après quelques jours sans visite.

export const REMINDER_TITLE = 'Une nouvelle offre d’emploi ?';
export const REMINDER_TEXT = 'Adaptez votre CV à l’annonce en 1 crédit, et la lettre suit si besoin.';
export const OFFER_TITLE = 'Une offre pour votre retour';
export const OFFER_TEXT = '4 crédits pour 500 F au lieu de 3, pendant 3 jours. Une seule fois.';

const LAST_VISIT_KEY = 'cv-studio-last-visit';
const SNOOZE_KEY = 'cv-studio-reminder-snooze';
const ASKED_KEY = 'cv-studio-notif-asked';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Bannière : au retour après au moins 20 h d'absence, puis pas avant 5 jours si elle a été fermée. */
const BANNER_AFTER = 20 * HOUR;
const BANNER_SNOOZE = 5 * DAY;
/** Notifications Android : 4 puis 11 jours après la dernière visite, à 10 h. */
const NOTIFY_AFTER_DAYS = [4, 11];
const NOTIFY_IDS = [4101, 4102];

function read(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Stockage indisponible (navigation privée) : le rappel ne s'affiche simplement pas.
  }
}

/** Un CV avec un vrai contenu (pas le CV vide de départ). */
export function hasRealCv(cvs: CvDocument[]): boolean {
  return cvs.some((cv) => Boolean(cv.personal.firstName.trim() || cv.personal.lastName.trim()) && (cv.experiences.length > 0 || cv.education.length > 0));
}

/** Faut-il montrer la bannière, d'après la visite précédente et la dernière fermeture ? */
export function shouldShowBanner(now: number, lastVisit: number, snoozedUntil: number, hasCv: boolean): boolean {
  return hasCv && lastVisit > 0 && now - lastVisit >= BANNER_AFTER && now >= snoozedUntil;
}

/** Décidé une seule fois par ouverture de l'appli, pour que la bannière suive la personne d'une page à l'autre. */
let bannerDecision: boolean | null = null;

export function decideBanner(): boolean {
  if (bannerDecision === null) {
    const now = Date.now();
    bannerDecision = shouldShowBanner(now, read(LAST_VISIT_KEY), read(SNOOZE_KEY), hasRealCv(useStore.getState().cvs));
    write(LAST_VISIT_KEY, now);
  }
  return bannerDecision;
}

/** Bannière de retour, jusqu'à ce qu'elle soit fermée ou utilisée. */
export function useReturnReminder(): { show: boolean; dismiss: () => void } {
  const [show, setShow] = useState(decideBanner);
  return {
    show,
    dismiss: () => {
      write(SNOOZE_KEY, Date.now() + BANNER_SNOOZE);
      bannerDecision = false;
      setShow(false);
    },
  };
}

/** Dates des notifications : N jours après maintenant, à 10 h (heure du téléphone). */
export function reminderDates(now: number): Date[] {
  return NOTIFY_AFTER_DAYS.map((days) => {
    const d = new Date(now + days * DAY);
    d.setHours(10, 0, 0, 0);
    return d;
  });
}

/** La 2ᵉ notification annonce l'offre de retour si le serveur pourra l'ouvrir à cette date. */
export function offerAt(offer: ReturnOffer | null, at: Date): boolean {
  return Boolean(offer?.possible && !offer.active && (!offer.notBefore || new Date(offer.notBefore) <= at));
}

/**
 * Android : reprogramme les notifications à chaque ouverture ou retour dans l'appli.
 * Elles ne sonnent donc que si la personne n'est pas revenue depuis 4 (puis 11) jours.
 * L'autorisation n'est demandée qu'une fois, et seulement quand un vrai CV existe.
 */
export async function scheduleReturnReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: NOTIFY_IDS.map((id) => ({ id })) });
    if (!hasRealCv(useStore.getState().cvs)) return;
    let { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') {
      if (display === 'denied' || read(ASKED_KEY)) return;
      write(ASKED_KEY, Date.now());
      ({ display } = await LocalNotifications.requestPermissions());
      if (display !== 'granted') return;
    }
    const { offer, token } = useAccount.getState();
    await LocalNotifications.schedule({
      notifications: reminderDates(Date.now()).map((at, i) => {
        const promo = i === 1 && Boolean(token) && offerAt(offer, at);
        return {
          id: NOTIFY_IDS[i],
          title: promo ? OFFER_TITLE : REMINDER_TITLE,
          body: promo ? OFFER_TEXT : REMINDER_TEXT,
          schedule: { at, allowWhileIdle: true },
          smallIcon: 'ic_stat_cvstudio',
          iconColor: '#2549eb',
          extra: promo ? { credits: true } : { tab: 'offre' },
        };
      }),
    });
  } catch {
    // Pas de notification possible (plugin absent, refus) : la bannière reste le rappel.
  }
}

/** Toucher la notification ouvre la page « Offre », ou la fenêtre des crédits pour l'offre de retour. */
export async function listenReminderTap(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const extra = action.notification.extra as { tab?: string; credits?: boolean } | undefined;
      if (extra?.credits) useAccount.getState().open('credits');
      else if (extra?.tab) window.location.hash = extra.tab;
    });
  } catch {
    // Rien à faire.
  }
}
