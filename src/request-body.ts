export const MAX_WEBHOOK_BYTES = 1024 * 1024;

export class RequestBodyTooLarge extends Error {}

/** Bound memory before buffering, including chunked requests without a size header. */
export async function readWebhookBody(request: Request): Promise<ArrayBuffer> {
  if (Number(request.headers.get('content-length')) > MAX_WEBHOOK_BYTES) {
    await request.body?.cancel();
    throw new RequestBodyTooLarge();
  }
  if (!request.body) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        throw new RequestBodyTooLarge();
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}
