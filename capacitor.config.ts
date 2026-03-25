import type { CapacitorConfig } from "@capacitor/cli";

const appUrl =
  process.env.CAPACITOR_SERVER_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://soundcloudy.onrender.com";

const config: CapacitorConfig = {
  appId: "com.soundcloudy.app",
  appName: "Soundcloudy",
  webDir: "out",
  server: {
    url: appUrl,
    cleartext: false,
  },
};

export default config;
