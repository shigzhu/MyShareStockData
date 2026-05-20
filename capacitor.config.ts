import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.gushen.stockpicker",
  appName: "股神选股",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};

export default config;
