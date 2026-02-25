import 'dotenv/config';
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: process.env.CAPACITOR_APP_ID || 'ai.concertina.device',
  appName: process.env.CAPACITOR_APP_NAME || 'Sewer Agent Ai App',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
