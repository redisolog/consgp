import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ru.polya.a5notes",
  appName: "Поля A5",
  webDir: "desktop-dist",
  android: {
    backgroundColor: "#f8f3ee",
    allowMixedContent: false,
  },
};

export default config;
