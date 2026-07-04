import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// The displayed version comes from the latest git tag — the same source
// setuptools-scm uses for the CLI package — so releasing a tag updates
// both. Falls back to package.json when tags are unavailable (e.g. a
// shallow CI clone).
function appVersion(): string {
  try {
    return execSync("git describe --tags --abbrev=0", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
      .replace(/^v/, "");
  } catch {
    return pkg.version;
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
});
