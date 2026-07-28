import type { Plugin } from 'vite';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Plugin Vite DEV-ONLY : collecteur de télémétrie.
 *
 * Le client (perfTelemetry.ts) POST des paquets JSON sur /__perf ; chaque paquet est
 * append en une ligne dans perf-logs/perf-<date>.jsonl (gitignoré) — lisible/analysable
 * par Claude sans rien copier depuis le téléphone. Aucun impact prod : configureServer
 * n'existe que pour le dev-server (`pnpm dev`), le build n'embarque rien.
 */
export function perfCollectorPlugin(): Plugin {
  return {
    name: 'perf-collector',
    apply: 'serve',
    configureServer(server) {
      const dir = join(server.config.root, 'perf-logs');
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `perf-${new Date().toISOString().slice(0, 10)}.jsonl`);

      server.middlewares.use('/__perf', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            // Le client envoie un TABLEAU d'events (buffer flushé) → 1 ligne jsonl chacun.
            const events = JSON.parse(body);
            const stamp = new Date().toISOString();
            for (const ev of Array.isArray(events) ? events : [events]) {
              appendFileSync(file, JSON.stringify({ srv: stamp, ...ev }) + '\n');
            }
          } catch { /* paquet illisible : tant pis, on ne casse pas le serveur */ }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}
