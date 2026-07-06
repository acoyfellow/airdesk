// Minimal WebAuthn COSE / DER helpers for ES256 (ECDSA over P-256).
// These are pure byte-munging utilities with no Cloudflare runtime imports.

class CborReader {
  private data: Uint8Array;
  private pos: number = 0;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  read(): unknown {
    if (this.pos >= this.data.length) {
      throw new Error('unexpected end of CBOR data');
    }
    const b = this.data[this.pos++];
    const major = b >>> 5;
    const info = b & 0x1f;
    const arg = this.readArg(info);

    switch (major) {
      case 0:
        return arg;
      case 1:
        return -1 - arg;
      case 2:
        return this.readBytes(arg);
      case 5:
        return this.readMap(arg);
      default:
        throw new Error(`unsupported CBOR major type ${major}`);
    }
  }

  private readArg(info: number): number {
    if (info < 24) return info;
    if (info === 24) return this.readUint(1);
    if (info === 25) return this.readUint(2);
    if (info === 26) return this.readUint(4);
    if (info === 27) return this.readUint(8);
    throw new Error(`unsupported CBOR additional info ${info}`);
  }

  private readUint(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (this.pos >= this.data.length) {
        throw new Error('truncated CBOR integer');
      }
      v = (v << 8) | this.data[this.pos++];
    }
    return v;
  }

  private readBytes(len: number): Uint8Array {
    if (this.pos + len > this.data.length) {
      throw new Error('truncated CBOR byte string');
    }
    const slice = this.data.slice(this.pos, this.pos + len);
    this.pos += len;
    return slice;
  }

  private readMap(len: number): Map<unknown, unknown> {
    const map = new Map<unknown, unknown>();
    for (let i = 0; i < len; i++) {
      const key = this.read();
      const value = this.read();
      map.set(key, value);
    }
    return map;
  }
}

function readDerLength(data: Uint8Array, pos: { value: number }): number {
  if (pos.value >= data.length) {
    throw new Error('truncated DER length');
  }
  const first = data[pos.value++];
  if ((first & 0x80) === 0) {
    return first;
  }
  const numBytes = first & 0x7f;
  if (numBytes === 0 || numBytes > 4) {
    throw new Error('unsupported DER length encoding');
  }
  let len = 0;
  for (let i = 0; i < numBytes; i++) {
    if (pos.value >= data.length) {
      throw new Error('truncated DER length bytes');
    }
    len = (len << 8) | data[pos.value++];
  }
  return len;
}

function readDerInteger(data: Uint8Array, pos: { value: number }): Uint8Array {
  if (pos.value >= data.length || data[pos.value++] !== 0x02) {
    throw new Error('expected DER INTEGER');
  }
  const len = readDerLength(data, pos);
  if (pos.value + len > data.length) {
    throw new Error('truncated DER INTEGER');
  }
  const intBytes = data.slice(pos.value, pos.value + len);
  pos.value += len;

  // Strip leading zero padding added by ASN.1 when the high bit is set.
  let start = 0;
  while (start < intBytes.length - 1 && intBytes[start] === 0) {
    start++;
  }
  const stripped = intBytes.slice(start);
  if (stripped.length > 32) {
    throw new Error('DER INTEGER too large for P-256');
  }

  const padded = new Uint8Array(32);
  padded.set(stripped, 32 - stripped.length);
  return padded;
}

/**
 * Convert a COSE_Key (EC2, alg ES256, crv P-256) into a 65-byte uncompressed
 * EC point: 0x04 || x || y. Rejects other key types or missing fields.
 */
export function coseEc2P256ToRawPublicKey(cose: Uint8Array): Uint8Array {
  const reader = new CborReader(cose);
  const map = reader.read();
  if (!(map instanceof Map)) {
    throw new Error('COSE key must be a CBOR map');
  }

  const kty = map.get(1);
  if (kty !== 2) {
    throw new Error('only EC2 COSE keys are supported');
  }
  const alg = map.get(3);
  if (alg !== -7) {
    throw new Error('only ES256 algorithm is supported');
  }
  const crv = map.get(-1);
  if (crv !== 1) {
    throw new Error('only P-256 curve is supported');
  }

  const x = map.get(-2);
  const y = map.get(-3);
  if (!(x instanceof Uint8Array) || x.length !== 32) {
    throw new Error('invalid P-256 x coordinate');
  }
  if (!(y instanceof Uint8Array) || y.length !== 32) {
    throw new Error('invalid P-256 y coordinate');
  }

  const raw = new Uint8Array(65);
  raw[0] = 0x04;
  raw.set(x, 1);
  raw.set(y, 33);
  return raw;
}

/**
 * Convert an ASN.1 DER-encoded ECDSA signature (SEQUENCE of two INTEGERs r, s)
 * into the raw 64-byte r || s form required by WebCrypto ECDSA verify.
 */
export function derEcdsaSignatureToRaw(der: Uint8Array): Uint8Array {
  const pos = { value: 0 };
  if (pos.value >= der.length || der[pos.value++] !== 0x30) {
    throw new Error('expected DER SEQUENCE');
  }
  const seqLen = readDerLength(der, pos);
  if (pos.value + seqLen !== der.length) {
    throw new Error('DER SEQUENCE length mismatch');
  }

  const r = readDerInteger(der, pos);
  const s = readDerInteger(der, pos);
  if (pos.value !== der.length) {
    throw new Error('trailing data in DER signature');
  }

  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}
