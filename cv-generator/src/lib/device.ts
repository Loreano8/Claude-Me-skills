import { Capacitor } from '@capacitor/core';

let cached: Promise<string> | null = null;

/**
 * Identifiant de l'appareil, envoyé à l'inscription pour n'offrir le crédit gratuit qu'une fois par appareil.
 * Android : identifiant du téléphone (stable même après réinstallation de l'appli).
 * Navigateur : identifiant aléatoire gardé dans le stockage local.
 */
export function deviceId(): Promise<string> {
  cached ??= (async () => {
    if (Capacitor.isNativePlatform()) {
      const { Device } = await import('@capacitor/device');
      return `android-${(await Device.getId()).identifier}`;
    }
    try {
      let id = localStorage.getItem('cv-studio-device');
      if (!id) {
        id = `web-${crypto.randomUUID()}`;
        localStorage.setItem('cv-studio-device', id);
      }
      return id;
    } catch {
      return '';
    }
  })();
  return cached;
}
