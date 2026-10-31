import { defineConfig } from "tsup";

// Bundle the workspace package (@home-kit/shared ships TypeScript source) into the
// server build so `node dist/index.js` works without a TS runtime.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  sourcemap: true,
  noExternal: ["@home-kit/shared"],
});
