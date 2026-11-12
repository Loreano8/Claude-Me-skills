import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cvstudio.app',
  appName: 'CVCasa',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Mises à jour gérées par l'appli elle-même (src/lib/appUpdate.ts), sans le service en ligne de Capgo
    // ni envoi de statistiques à un tiers.
    CapacitorUpdater: {
      autoUpdate: false,
      statsUrl: '',
      appReadyTimeout: 15000,
      autoDeletePrevious: true,
      autoDeleteFailed: true,
    },
  },
};

export default config;
