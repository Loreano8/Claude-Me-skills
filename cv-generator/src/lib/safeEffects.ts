import { useEffect as reactUseEffect, useLayoutEffect as reactUseLayoutEffect, type DependencyList, type EffectCallback } from 'react';

/**
 * Un effet qui renvoie autre chose qu'une fonction (ou rien) fait planter React au moment de quitter l'écran :
 * « y is not a function ». On garde seulement ce qui est une fonction : le nettoyage valide est conservé,
 * tout le reste est ignoré (et signalé dans la console) au lieu de faire tomber l'écran « Un souci est survenu ».
 */
export function safeEffect(effect: EffectCallback): EffectCallback {
  return () => {
    const cleanup = effect();
    if (cleanup === undefined || typeof cleanup === 'function') return cleanup;
    console.error('Effet invalide ignoré : il a renvoyé', typeof cleanup, String(effect).slice(0, 160));
    return undefined;
  };
}

export const useEffect = (effect: EffectCallback, deps?: DependencyList) => reactUseEffect(safeEffect(effect), deps);
export const useLayoutEffect = (effect: EffectCallback, deps?: DependencyList) => reactUseLayoutEffect(safeEffect(effect), deps);
