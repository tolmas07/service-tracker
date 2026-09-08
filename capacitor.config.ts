import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uzmulk.tracker',
  appName: 'UzmulkTracker',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;
