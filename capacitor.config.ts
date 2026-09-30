import type { CapacitorConfig } from '@capacitor/cli';

// Android app: a small launcher (mobile-shell/) that opens the POLARIS server inside the app,
// so every page, login, upload and download works exactly as on the web.
const config: CapacitorConfig = {
  appId: 'in.teampehchaan.polaris',
  appName: 'POLARIS',
  webDir: 'mobile-shell',
  server: {
    androidScheme: 'http',
    allowNavigation: ['*'],
    // Shown when the server can't be reached, so the user can reconnect or change address.
    errorPath: 'index.html?error=1',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
