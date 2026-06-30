// Encode/decode a project into a URL-safe string for share links. The payload
// lives in the URL hash (#s=…) which browsers never send to the server, so
// sharing needs no backend. We gzip-deflate when the browser supports it (links
// stay short — SQL compresses well) and fall back to raw base64 otherwise.
// A 1-char flag prefix records which path was used.

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlFromBytes(bytes) {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesFromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(stream, bytes) {
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function encodeShare(obj) {
  const bytes = enc.encode(JSON.stringify(obj));
  if (typeof CompressionStream !== 'undefined') {
    try {
      const z = await pipe(new CompressionStream('deflate-raw'), bytes);
      // only keep the compressed form if it actually wins
      if (z.length < bytes.length) return 'z' + b64urlFromBytes(z);
    } catch { /* fall through */ }
  }
  return 'r' + b64urlFromBytes(bytes);
}

export async function decodeShare(payload) {
  const flag = payload[0];
  let bytes = bytesFromB64url(payload.slice(1));
  if (flag === 'z') bytes = await pipe(new DecompressionStream('deflate-raw'), bytes);
  return JSON.parse(dec.decode(bytes));
}
