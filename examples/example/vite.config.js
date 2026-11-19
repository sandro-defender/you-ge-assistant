import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const exampleRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(exampleRoot, '../..');
const sharedFiles = new Map([
  ['pwa.js', 'src/runtime/pwa.js'],
  ['pwa.css', 'src/runtime/pwa.css'],
  ['pwa-install.js', 'src/runtime/pwa-install.js'],
  ['you-ge-sw.js', 'src/runtime/you-ge-sw.js'],
  ['progressier.js', 'src/runtime/progressier.js'],
  ['qrcode.js', 'src/shared/qrcode.js'],
  ['domain-config.js', 'src/domain/domain-config.js'],
  ['domain-registry.js', 'src/domain/domain-registry.js'],
  ['dns-diagnostics.js', 'src/domain/dns-diagnostics.js'],
  ['assistant-state.js', 'src/assistant/assistant-state.js'],
  ['assistant-widget.js', 'src/assistant/assistant-widget.js'],
  ['assistant-widget.css', 'src/assistant/assistant-widget.css'],
  ['offline.html', 'src/offline/offline.html'],
  ['offline.css', 'src/offline/offline.css'],
  ['offline.js', 'src/offline/offline.js'],
  ['browserconfig.xml', 'public/browserconfig.xml'],
  ['favicon.ico', 'public/favicon.ico'],
]);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.xml': 'application/xml; charset=utf-8',
};

function sharedRuntimeDevFiles() {
  return {
    name: 'serve-shared-pwa-runtime-in-development',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        let pathname;
        try {
          pathname = decodeURIComponent(new URL(request.url, 'http://vite.local').pathname).replace(/^\/+/, '');
        } catch {
          return next();
        }
        const isIcon = pathname.startsWith('icons/');
        const mappedPath = sharedFiles.get(pathname);
        if (!mappedPath && !isIcon) return next();
        const filename = path.resolve(repositoryRoot, mappedPath || pathname);
        if (!filename.startsWith(repositoryRoot + path.sep) || !existsSync(filename)) return next();
        response.setHeader('Content-Type', mimeTypes[path.extname(filename)] || 'application/octet-stream');
        createReadStream(filename).pipe(response);
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [sharedRuntimeDevFiles()],
  server: { host: '0.0.0.0', allowedHosts: true, fs: { allow: [repositoryRoot] } },
  preview: { host: '0.0.0.0', allowedHosts: true },
  build: {
    outDir: 'dist',
    rollupOptions: { input: { index: path.join(exampleRoot, 'index.html'), workspace: path.join(exampleRoot, 'workspace.html') } },
    emptyOutDir: true,
  },
});
