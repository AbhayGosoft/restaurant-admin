import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.darshan.pms",
  appName: "Darshan",
  webDir: "dist",
  server: { androidScheme: "https" },
  android: { backgroundColor: "#F5F7F3" },
};

export default config;
