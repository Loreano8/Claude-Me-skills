import { useEffect, useRef } from 'react';
import { LANG } from '../i18n.ts';

// Vérification anti-robot Cloudflare Turnstile : invisible pour une vraie personne (au pire une case à cocher).
// Le script n'est chargé que sur les formulaires qui en ont besoin, et seulement si le serveur l'a activée.

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;
function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')));
    s.onerror = () => {
      loading = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Affiche la vérification (si besoin) et remonte le jeton à envoyer avec le formulaire. `resetKey` : nouveau jeton après chaque envoi. */
export function Captcha({ siteKey, onToken, resetKey = 0 }: { siteKey: string; onToken: (token: string) => void; resetKey?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    let alive = true;
    void loadTurnstile()
      .then((ts) => {
        if (!alive || !box.current) return;
        widget.current = ts.render(box.current, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          language: LANG,
          callback: (token: string) => cb.current(token),
          'expired-callback': () => cb.current(''),
          'error-callback': () => cb.current(''),
        });
      })
      .catch(() => cb.current(''));
    return () => {
      alive = false;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey && widget.current) {
      cb.current('');
      window.turnstile?.reset(widget.current);
    }
  }, [resetKey]);

  return <div ref={box} className="empty:hidden" />;
}
