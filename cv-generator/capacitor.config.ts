import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cvstudio.app',
  appName: 'CVCasa',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
