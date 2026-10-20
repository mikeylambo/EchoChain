import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Echo Chain consumes only DeterministicRng from @slu/web-shell at runtime. Pointing the bare import at that one
// module keeps the bundle lean (the shell's root barrel also re-exports the three/babylon/phaser adapters).
// Remove this alias the day the game consumes more of the shell.
const shellRng = fileURLToPath(new URL("./vendor/web-shell/src/core/DeterministicRNG.ts", import.meta.url));

export default defineConfig({
  base: "./",
  resolve: { alias: [{ find: /^@slu\/web-shell$/, replacement: shellRng }] },
  build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 800 },
  server: { host: true },
});
