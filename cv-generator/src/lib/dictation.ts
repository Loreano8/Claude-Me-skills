import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition as NativeSpeech } from '@capacitor-community/speech-recognition';
import type { Lang } from '../../shared/schema.ts';

// Reconnaissance vocale gratuite, faite par l'appareil : celle d'Android dans l'application,
// celle du navigateur sur le site (Chrome, Edge, Safari sur iPhone…).

interface WebRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type WebRecognitionCtor = new () => WebRecognition;

function webCtor(): WebRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: WebRecognitionCtor; webkitSpeechRecognition?: WebRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type DictationMode = 'native' | 'web' | null;

export function dictationMode(): DictationMode {
  if (Capacitor.isNativePlatform()) return Capacitor.getPlatform() === 'android' ? 'native' : null;
  return webCtor() ? 'web' : null;
}

const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-US' };

function webError(code: string): string | null {
  switch (code) {
    case 'no-speech':
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Le micro est bloqué. Autorisez l’accès au micro pour ce site dans les réglages du navigateur, puis réessayez.';
    case 'network':
      return 'La dictée a besoin d’une connexion internet.';
    case 'audio-capture':
      return 'Aucun micro détecté sur cet appareil.';
    default:
      return 'La dictée s’est interrompue. Réessayez.';
  }
}

/**
 * Dictée vocale : `onFinal` reçoit chaque morceau de phrase reconnu ; `interim` est le texte
 * en cours de reconnaissance (affiché en gris). La dictée continue jusqu'à `stop()`, même après un silence.
 */
export function useDictation(onFinal: (text: string) => void, lang: Lang = 'fr') {
  const mode = dictationMode();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const wanted = useRef(false);
  const emit = useRef(onFinal);
  emit.current = onFinal;
  const web = useRef<WebRecognition | null>(null);
  const partial = useRef('');
  const handles = useRef<PluginListenerHandle[]>([]);

  const finish = useCallback(() => {
    wanted.current = false;
    setListening(false);
    setInterim('');
  }, []);

  const commitPartial = () => {
    const text = partial.current.trim();
    partial.current = '';
    setInterim('');
    if (text) emit.current(text);
  };

  const startNative = async () => {
    const perm = await NativeSpeech.requestPermissions();
    if (perm.speechRecognition !== 'granted') throw new Error('Autorisez l’accès au micro pour utiliser la dictée.');
    if (!(await NativeSpeech.available()).available) throw new Error('La reconnaissance vocale n’est pas disponible sur ce téléphone.');
    await NativeSpeech.removeAllListeners();
    handles.current = [
      await NativeSpeech.addListener('partialResults', (d) => {
        partial.current = d.matches?.[0] ?? '';
        setInterim(partial.current);
      }),
      await NativeSpeech.addListener('listeningState', (d) => {
        if (d.status !== 'stopped') return;
        commitPartial();
        // Android s'arrête après un silence : on relance tant que l'utilisateur n'a pas appuyé sur « Arrêter ».
        if (wanted.current) void NativeSpeech.start({ language: LOCALES[lang], partialResults: true, popup: false }).catch(finish);
        else finish();
      }),
    ];
    await NativeSpeech.start({ language: LOCALES[lang], partialResults: true, popup: false });
  };

  const startWeb = () => {
    const Ctor = webCtor()!;
    const rec = new Ctor();
    rec.lang = LOCALES[lang];
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let pending = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) emit.current(r[0].transcript.trim());
        else pending += r[0].transcript;
      }
      setInterim(pending);
    };
    rec.onerror = (e) => {
      const message = webError(e.error);
      if (message) {
        setError(message);
        wanted.current = false;
      }
    };
    rec.onend = () => {
      setInterim('');
      if (wanted.current) {
        try {
          rec.start();
          return;
        } catch {
          // ignoré : on termine ci-dessous
        }
      }
      finish();
    };
    web.current = rec;
    rec.start();
  };

  const start = async () => {
    if (!mode || wanted.current) return;
    setError(null);
    wanted.current = true;
    setListening(true);
    try {
      if (mode === 'native') await startNative();
      else startWeb();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de démarrer la dictée.');
      finish();
    }
  };

  const stop = () => {
    wanted.current = false;
    if (mode === 'native') {
      void NativeSpeech.stop().catch(() => {});
      commitPartial();
      finish();
    } else {
      web.current?.stop();
    }
  };

  useEffect(
    () => () => {
      wanted.current = false;
      web.current?.abort();
      if (handles.current.length) void NativeSpeech.stop().catch(() => {});
      handles.current.forEach((h) => void h.remove());
    },
    [],
  );

  return { supported: mode !== null, listening, interim, error, start, stop };
}
