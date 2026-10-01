import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

export default defineConfig({
  root: "site",
  base: "/growing-panes/",
  resolve: {
    alias: [
      {
        find: "growing-panes/react",
        replacement: fileURLToPath(new URL("./src/react.ts", import.meta.url)),
      },
      {
        find: "growing-panes",
        replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      },
    ],
  },
  build: {
    outDir: "../site-dist",
    emptyOutDir: true,
  },
});
