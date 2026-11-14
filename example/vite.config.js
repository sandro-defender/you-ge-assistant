import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const exampleRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(exampleRoot, '..');
const sharedFiles = new Set([
  'pwa.js', 'pwa.css', 'you-ge-sw.js', 'progressier.js', 'qrcode.js',
  'domain-config.js', 'domain-registry.js', 'dns-diagnostics.js',
  'assistant-state.js', 'assistant-widget.js', 'assistant-widget.css',
  'offline.html', 'offline.css', 'offline.js', 'browserconfig.xml', 'favicon.ico',
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
        if (!sharedFiles.has(pathname) && !isIcon) return next();
        const filename = path.resolve(repositoryRoot, pathname);
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
    emptyOutDir: true,
  },
});
