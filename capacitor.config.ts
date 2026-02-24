import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.concertina.device',
  appName: 'Concertina Device',
  webDir: 'www',
  server: {
    // Allow opening https?://your-concertina.com/device-connect?deviceId=...&secret=...
    androidScheme: 'https',
  },
};

export default config;
