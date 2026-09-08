import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.service.tracker',
  appName: 'ServiceTracker',
  webDir: 'dist',
  server: {
    // Приложение загружает сайт с Vercel — обновления сразу видны
    // ЗАМЕНИТЕ на ваш реальный URL Vercel
    url: 'https://service-tracker-xxx.vercel.app',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
