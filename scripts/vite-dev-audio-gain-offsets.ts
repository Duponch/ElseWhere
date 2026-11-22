import { rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import {
  GAIN_OFFSETS_ENDPOINT, GAIN_OFFSETS_ENDPOINT_HEADER, GAIN_OFFSETS_FILE, countGainOffsets, serializeGainOffsets, validateGainOffsets,
} from '../src/audio/gain-offsets.ts';

const MAX_BODY_BYTES = 256 * 1024;

/** Dev server only (`npm run dev`): « Enregistrer » on sounds-review.html posts
 * the gain offsets here and this writes the one repository file
 * public/assets/audio/gain-offsets.json, after the strict reader. No other
 * path can be written; a request from another site is refused. The published
 * build has no such endpoint: the page then downloads the file instead. */
export function devAudioGainOffsets(): Plugin {
  return {
    name: 'elsewhere-dev-audio-gain-offsets',
    apply: 'serve',
    configureServer(server) {
      const target = resolve(server.config.root, GAIN_OFFSETS_FILE);
      server.middlewares.use(GAIN_OFFSETS_ENDPOINT, (request, response) => {
        const reply = (status: number, body: Record<string, unknown>): void => {
          response.statusCode = status;
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.setHeader(GAIN_OFFSETS_ENDPOINT_HEADER, '1');
          response.end(JSON.stringify(body));
        };
        if (request.method !== 'POST') { reply(405, { ok: false, error: 'Seule la méthode POST est acceptée.' }); return; }
        // Same origin only: a page of another site cannot write in the repository.
        const origin = request.headers.origin, host = request.headers.host;
        let sameOrigin = false;
        try { sameOrigin = !!origin && !!host && new URL(origin).host === host; } catch { sameOrigin = false; }
        const site = request.headers['sec-fetch-site'];
        if (!sameOrigin || (site !== undefined && site !== 'same-origin')) { reply(403, { ok: false, error: 'Requête refusée : elle doit venir de la page des sons de ce serveur.' }); return; }
        if (!String(request.headers['content-type'] ?? '').startsWith('application/json')) { reply(415, { ok: false, error: 'Contenu JSON attendu.' }); return; }
        const chunks: Buffer[] = [];
        let size = 0, refused = false;
        request.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) { refused = true; reply(413, { ok: false, error: 'Réglage trop volumineux.' }); request.destroy(); }
          else chunks.push(chunk);
        });
        request.on('end', () => {
          if (refused) return;
          void (async () => {
            try {
              const offsets = validateGainOffsets(JSON.parse(Buffer.concat(chunks).toString('utf8')));
              const text = serializeGainOffsets(offsets), temporary = `${target}.tmp`;
              await writeFile(temporary, text, 'utf8');
              await rename(temporary, target);
              reply(200, { ok: true, file: GAIN_OFFSETS_FILE, entries: countGainOffsets(offsets) });
            } catch (error) {
              reply(400, { ok: false, error: error instanceof Error ? error.message : String(error) });
            }
          })();
        });
      });
    },
  };
}
