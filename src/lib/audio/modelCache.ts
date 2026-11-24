export const MODEL_METADATA = {
  URL: 'https://huggingface.co/timcsy/demucs-web-onnx/resolve/92e33df/htdemucs_embedded.onnx',
  SHA256: 'e5e425c17683f163a472462eb5f5a4ffcd11c31858d57fbd0833b012d8b88077',
  SIZE: 180_534_758,
  CACHE: 'vocalremover-model-sha256-v1',
};

export async function getVerifiedModel(onProgress: (percent: number) => void): Promise<ArrayBuffer> {
  const url = import.meta.env.VITE_DEMUCS_MODEL_URL || MODEL_METADATA.URL;
  const cacheKey = new Request(new URL('/models/' + MODEL_METADATA.SHA256, self.location.origin));
  const cache = await self.caches?.open(MODEL_METADATA.CACHE).catch(() => undefined);
  const cached = await cache?.match(cacheKey).catch(() => undefined);
  if (cached) {
    const bytes = await cached.arrayBuffer().catch(() => undefined);
    if (bytes && await isVerified(bytes)) return bytes;
    await cache?.delete(cacheKey).catch(() => {});
  }

  for (let attempt = 0; ; attempt++) {
    try {
      const source = attempt === 0 ? url : MODEL_METADATA.URL;
      const response = await fetch(source, { credentials: 'omit' });
      if (!response.ok || !response.body) throw new Error('Could not download the separation model.');
      const reader = response.body.getReader();
      const model = new Uint8Array(MODEL_METADATA.SIZE);
      let received = 0;
      let reported = -1;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (received + value.length > model.length) throw new Error('The model download has an unexpected size.');
          model.set(value, received);
          received += value.length;
          const percent = Math.floor(received / model.length * 100);
          if (percent !== reported) {
            onProgress(percent);
            reported = percent;
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      if (received !== model.length || !await isVerified(model.buffer)) {
        throw new Error('The model download failed its integrity check.');
      }
      if (cache) await cache.put(cacheKey, new Response(model.buffer)).catch(() => {});
      return model.buffer;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}

async function isVerified(bytes: ArrayBuffer) {
  if (bytes.byteLength !== MODEL_METADATA.SIZE) return false;
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('') === MODEL_METADATA.SHA256;
}
