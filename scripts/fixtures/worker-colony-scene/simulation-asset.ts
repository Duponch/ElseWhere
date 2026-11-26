declare const FROZEN_PRESENTATION_ASSET: {url: string; sha: string};
let url: string | undefined;

export async function prepareWorkerAsset(): Promise<void> {
  if (url) return;
  const response = await fetch(FROZEN_PRESENTATION_ASSET.url);
  if (!response.ok) throw Error('Missing presentation Worker');
  const data = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256',data);
  const hex = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  if (hex !== FROZEN_PRESENTATION_ASSET.sha) throw Error('Presentation Worker content mismatch');
  url = URL.createObjectURL(new Blob([data],{type:'text/javascript'}));
}

export function workerURL(): string {
  if (!url) throw Error('Presentation Worker asset was not prepared');
  return url;
}
