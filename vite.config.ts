import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@slu/web-shell": path.resolve(__dirname, "vendor/web-shell/dist"),
    },
  },
});
