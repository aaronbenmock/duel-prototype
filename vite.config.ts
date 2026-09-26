import { defineConfig, type Plugin } from 'vite';

/**
 * Writes version.json next to the page, so an open game can tell a newer build is live
 * (src/platform/update.ts). The version is APP_VERSION as compiled; the build fails if it
 * differs from package.json (when run through npm, which passes the package version).
 */
function versionFile(): Plugin {
  return {
    name: 'high-moon-version-file',
    apply: 'build',
    generateBundle() {
      let version: string | undefined;
      for (const id of this.getModuleIds()) {
        if (!id.replace(/\\/g, '/').endsWith('src/settings/settings.ts')) continue;
        version = /APP_VERSION\s*=\s*["']([^"']+)["']/.exec(this.getModuleInfo(id)?.code ?? '')?.[1];
      }
      if (!version) return; // Not the game build (for example the dev check scripts).
      const pkg = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.npm_package_version;
      if (pkg && pkg !== version) this.error(`APP_VERSION (${version}) and package.json (${pkg}) differ: bump both.`);
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) + '\n' });
    },
  };
}

// Relative base so the built site works under /duel-prototype/ on GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [versionFile()],
});
