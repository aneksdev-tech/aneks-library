
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      target: ["safari15", "ios15"],
    },
  },
  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});
