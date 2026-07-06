import { describe, it, expect } from 'bun:test';
import { coseEc2P256ToRawPublicKey, derEcdsaSignatureToRaw } from '../src/webauthn';

function fromHex(s: string): Uint8Array {
  const bytes = new Uint8Array(s.length / 2);
  for (let i = 0; i < s.length; i += 2) {
    bytes[i / 2] = parseInt(s.substring(i, i + 2), 16);
  }
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Deterministic ES256 test fixtures derived from a seeded P-256 key.
const COSE_EC2_KEY_HEX =
  'a5010203262001215820ff7b3644da90271e97952468851f5a8b9defc56606f95831e2007d5cdc26c991225820c526a4a8b8e99bd51a4b79258eae15b59f9f5e3a769672e46b3333e6be29ff18';
const RAW_PUBLIC_KEY_HEX =
  '04ff7b3644da90271e97952468851f5a8b9defc56606f95831e2007d5cdc26c991c526a4a8b8e99bd51a4b79258eae15b59f9f5e3a769672e46b3333e6be29ff18';
const DER_SIGNATURE_HEX =
  '3046022100b828890dc83beb69dc0a030576e910c178dce95ccde8e8fd18810f57c38c3a5b022100a64096fc7ff6b32612868b60ac92c3abfea8063d614e8c5f58d6bd09ab9c1e31';
const RAW_SIGNATURE_HEX =
  'b828890dc83beb69dc0a030576e910c178dce95ccde8e8fd18810f57c38c3a5ba64096fc7ff6b32612868b60ac92c3abfea8063d614e8c5f58d6bd09ab9c1e31';
const SIGNED_MESSAGE = new TextEncoder().encode('airdesk-frontier-test-message');

describe('coseEc2P256ToRawPublicKey', () => {
  it('parses a known EC2/ES256/P-256 COSE key into a raw uncompressed point', () => {
    const raw = coseEc2P256ToRawPublicKey(fromHex(COSE_EC2_KEY_HEX));
    expect(raw.length).toBe(65);
    expect(raw[0]).toBe(0x04);
    expect(toHex(raw)).toBe(RAW_PUBLIC_KEY_HEX);
  });

  it('rejects a non-EC2 COSE key', () => {
    // OKP key: kty=1, crv=6 (Ed25519), x=32 bytes. Same structure, wrong kty.
    const okpKeyHex =
      'a4010103262006215820ff7b3644da90271e97952468851f5a8b9defc56606f95831e2007d5cdc26c991';
    expect(() => coseEc2P256ToRawPublicKey(fromHex(okpKeyHex))).toThrow('only EC2 COSE keys are supported');
  });

  it('rejects an EC2 key with the wrong curve', () => {
    // kty=2, alg=-7, crv=2 (P-384), x/y=48 bytes.
    const p384KeyHex =
      'a5010203262002215830ff7b3644da90271e97952468851f5a8b9defc56606f95831e2007d5cdc26c991c526a4a8b8e99bd51a4b79258eae0001225834c526a4a8b8e99bd51a4b79258eae15b59f9f5e3a769672e46b3333e6be29ff18cafebabe00000000000000000000000000000000';
    expect(() => coseEc2P256ToRawPublicKey(fromHex(p384KeyHex))).toThrow('only P-256 curve is supported');
  });

  it('rejects malformed CBOR', () => {
    expect(() => coseEc2P256ToRawPublicKey(fromHex('a50102'))).toThrow();
  });
});

describe('derEcdsaSignatureToRaw', () => {
  it('converts a known DER signature into raw 64-byte r||s', () => {
    const raw = derEcdsaSignatureToRaw(fromHex(DER_SIGNATURE_HEX));
    expect(raw.length).toBe(64);
    expect(toHex(raw)).toBe(RAW_SIGNATURE_HEX);
  });

  it('rejects a signature with the wrong top-level tag', () => {
    const bad = fromHex(DER_SIGNATURE_HEX);
    bad[0] = 0x31;
    expect(() => derEcdsaSignatureToRaw(bad)).toThrow('expected DER SEQUENCE');
  });

  it('rejects a truncated DER signature', () => {
    const truncated = fromHex(DER_SIGNATURE_HEX).slice(0, 10);
    expect(() => derEcdsaSignatureToRaw(truncated)).toThrow();
  });

  it('rejects trailing data in DER signature', () => {
    // SEQUENCE length 71 with one extra trailing byte inside the declared length.
    const trailing =
      '3047022100b828890dc83beb69dc0a030576e910c178dce95ccde8e8fd18810f57c38c3a5b022100a64096fc7ff6b32612868b60ac92c3abfea8063d614e8c5f58d6bd09ab9c1e3100';
    expect(() => derEcdsaSignatureToRaw(fromHex(trailing))).toThrow('trailing data in DER signature');
  });

  it('rejects an integer that is too large for P-256', () => {
    // r = 34 bytes: leading zero + 33 0xff bytes; stripped length is 33 > 32.
    const oversizedR =
      '3047022200ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff022100a64096fc7ff6b32612868b60ac92c3abfea8063d614e8c5f58d6bd09ab9c1e31';
    expect(() => derEcdsaSignatureToRaw(fromHex(oversizedR))).toThrow('DER INTEGER too large for P-256');
  });
});

describe('WebAuthn conversions together', () => {
  it('produces a public key and signature that WebCrypto can verify', async () => {
    const rawKey = coseEc2P256ToRawPublicKey(fromHex(COSE_EC2_KEY_HEX));
    const rawSig = derEcdsaSignatureToRaw(fromHex(DER_SIGNATURE_HEX));

    const key = await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      rawSig,
      SIGNED_MESSAGE,
    );
    expect(valid).toBe(true);
  });
});
