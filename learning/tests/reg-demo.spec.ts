/**
 * Registration demo verifier tests (IDs 29-43).
 *
 * Each test switches to the target registration verifier, generates the
 * appropriate key pair, builds a registration response, and verifies it
 * succeeds (result.verified === true).
 */

import { test, expect } from '@playwright/test';
import { createApiClient } from './helpers/api';
import {
  generateES256KeyPair,
  generateRS256KeyPair,
  generateEdDSAKeyPair,
  buildRegistrationResponse,
  b64url,
  KeyPair,
} from './helpers/webauthn';
import crypto from 'crypto';

// ─── CBOR helpers (duplicated minimally for custom COSE key construction) ────

function cborEncodeMap(entries: [unknown, unknown][]): Buffer {
  const parts: Buffer[] = [cborMapHeader(entries.length)];
  for (const [k, v] of entries) {
    parts.push(cborEncode(k));
    parts.push(cborEncode(v));
  }
  return Buffer.concat(parts);
}

function cborMapHeader(length: number): Buffer {
  if (length < 24) return Buffer.from([0xa0 | length]);
  if (length < 256) return Buffer.from([0xb8, length]);
  throw new Error('Map too large');
}

function cborEncodeBytes(buf: Buffer): Buffer {
  const len = buf.length;
  let header: Buffer;
  if (len < 24) header = Buffer.from([0x40 | len]);
  else if (len < 256) header = Buffer.from([0x58, len]);
  else header = Buffer.from([0x59, (len >> 8) & 0xff, len & 0xff]);
  return Buffer.concat([header, buf]);
}

function cborEncodeInt(n: number): Buffer {
  if (n >= 0) {
    if (n < 24) return Buffer.from([n]);
    if (n < 256) return Buffer.from([0x18, n]);
    if (n < 65536) return Buffer.from([0x19, (n >> 8) & 0xff, n & 0xff]);
    throw new Error('Integer too large');
  }
  const val = -1 - n;
  if (val < 24) return Buffer.from([0x20 | val]);
  if (val < 256) return Buffer.from([0x38, val]);
  if (val < 65536) return Buffer.from([0x39, (val >> 8) & 0xff, val & 0xff]);
  throw new Error('Negative integer too small');
}

function cborEncode(value: unknown): Buffer {
  if (value instanceof Map) {
    return cborEncodeMap([...value.entries()]);
  }
  if (Buffer.isBuffer(value)) return cborEncodeBytes(value);
  if (typeof value === 'number') return cborEncodeInt(value);
  if (value instanceof Uint8Array) return cborEncodeBytes(Buffer.from(value));
  throw new Error(`Unsupported CBOR type: ${typeof value}`);
}

// ─── Key pair generators for all algorithms ──────────────────────────────────

/** Generate an EC key pair with a specific curve and COSE algorithm ID. */
function generateECKeyPair(
  namedCurve: string,
  coseAlg: number,
  coseCrv: number,
): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve,
  });
  const jwk = publicKey.export({ format: 'jwk' });
  const x = Buffer.from(jwk.x!, 'base64url');
  const y = Buffer.from(jwk.y!, 'base64url');
  const map = new Map<number, unknown>();
  map.set(1, 2);        // kty: EC2
  map.set(3, coseAlg);  // alg
  map.set(-1, coseCrv);  // crv
  map.set(-2, x);        // x
  map.set(-3, y);        // y
  return {
    algorithm: coseAlg,
    privateKey,
    publicKeyCose: cborEncodeMap([...map.entries()]),
    credentialId: b64url(crypto.randomBytes(32)),
  };
}

/** Generate an RSA key pair with a specific COSE algorithm ID. */
function generateRSAKeyPair(coseAlg: number): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: 'jwk' });
  const n = Buffer.from(jwk.n!, 'base64url');
  const e = Buffer.from(jwk.e!, 'base64url');
  const map = new Map<number, unknown>();
  map.set(1, 3);        // kty: RSA
  map.set(3, coseAlg);  // alg
  map.set(-1, n);        // n
  map.set(-2, e);        // e
  return {
    algorithm: coseAlg,
    privateKey,
    publicKeyCose: cborEncodeMap([...map.entries()]),
    credentialId: b64url(crypto.randomBytes(32)),
  };
}

/**
 * Return a freshly generated KeyPair matching the requested algorithm name.
 *
 * COSE algorithm IDs:
 *   ES256 = -7   (EC P-256, crv=1)
 *   ES384 = -35  (EC P-384, crv=2)
 *   ES512 = -36  (EC P-521, crv=3)
 *   PS256 = -37  (RSA-PSS)
 *   PS384 = -38  (RSA-PSS)
 *   PS512 = -39  (RSA-PSS)
 *   RS256 = -257 (RSA PKCS#1)
 *   RS384 = -258 (RSA PKCS#1)
 *   RS512 = -259 (RSA PKCS#1)
 *   EdDSA = -8   (Ed25519)
 */
function generateKeyPairForAlgorithm(algorithm: string): KeyPair {
  switch (algorithm) {
    case 'ES256':
      return generateES256KeyPair();
    case 'ES384':
      return generateECKeyPair('P-384', -35, 2);
    case 'ES512':
      return generateECKeyPair('P-521', -36, 3);
    case 'PS256':
      return generateRSAKeyPair(-37);
    case 'PS384':
      return generateRSAKeyPair(-38);
    case 'PS512':
      return generateRSAKeyPair(-39);
    case 'RS256':
      return generateRS256KeyPair();
    case 'RS384':
      return generateRSAKeyPair(-258);
    case 'RS512':
      return generateRSAKeyPair(-259);
    case 'EdDSA':
      return generateEdDSAKeyPair();
    default:
      return generateES256KeyPair();
  }
}

// ─── Verifier definitions (IDs 29-43) ────────────────────────────────────────

interface VerifierDef {
  id: number;
  name: string;
  algorithm: string;       // algorithm option from verifiers.json
  keyAlgorithm: string;    // which key type to generate for the test
  description: string;
}

const VERIFIERS: VerifierDef[] = [
  { id: 29, name: 'All Algorithms',  algorithm: 'all',   keyAlgorithm: 'ES256', description: 'Supports all common algorithms' },
  { id: 30, name: 'ES256',           algorithm: 'ES256', keyAlgorithm: 'ES256', description: 'ECDSA P-256 curve' },
  { id: 31, name: 'ES384',           algorithm: 'ES384', keyAlgorithm: 'ES384', description: 'ECDSA P-384 curve' },
  { id: 32, name: 'ES512',           algorithm: 'ES512', keyAlgorithm: 'ES512', description: 'ECDSA P-521 curve' },
  { id: 33, name: 'PS256',           algorithm: 'PS256', keyAlgorithm: 'PS256', description: 'RSA-PSS SHA-256' },
  { id: 34, name: 'PS384',           algorithm: 'PS384', keyAlgorithm: 'PS384', description: 'RSA-PSS SHA-384' },
  { id: 35, name: 'PS512',           algorithm: 'PS512', keyAlgorithm: 'PS512', description: 'RSA-PSS SHA-512' },
  { id: 36, name: 'RS256',           algorithm: 'RS256', keyAlgorithm: 'RS256', description: 'RSA PKCS#1 SHA-256' },
  { id: 37, name: 'RS384',           algorithm: 'RS384', keyAlgorithm: 'RS384', description: 'RSA PKCS#1 SHA-384' },
  { id: 38, name: 'RS512',           algorithm: 'RS512', keyAlgorithm: 'RS512', description: 'RSA PKCS#1 SHA-512' },
  { id: 39, name: 'EdDSA',           algorithm: 'EdDSA', keyAlgorithm: 'EdDSA', description: 'Edwards-curve (Ed25519)' },
  { id: 40, name: 'RP ID Upscope',   algorithm: 'ES256', keyAlgorithm: 'ES256', description: 'rpId set to parent domain' },
  { id: 41, name: 'Platform',        algorithm: 'ES256', keyAlgorithm: 'ES256', description: 'Platform authenticator attachment' },
  { id: 42, name: 'Cross-Platform',  algorithm: 'ES256', keyAlgorithm: 'ES256', description: 'Cross-platform authenticator attachment' },
  { id: 43, name: 'Attestation',     algorithm: 'ES256', keyAlgorithm: 'ES256', description: 'Direct attestation request' },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Registration Demo Verifiers (IDs 29-43)', () => {
  for (const v of VERIFIERS) {
    test(`Verifier ${v.id}: ${v.name} — ${v.description}`, async () => {
      const client = await createApiClient();
      try {
        // 1. Login as sheldon
        const loggedIn = await client.login('sheldon', 'Bazinga73');
        expect(loggedIn).toBe(true);

        // 2. Switch to the target registration verifier
        await client.switchVerifier(v.id, 'registration');

        // 3. Get registration options
        const optionsRes = await client.getRegistrationOptions();
        expect(optionsRes).toBeDefined();
        expect(optionsRes.options).toBeDefined();
        const challenge = optionsRes.options.challenge;
        expect(challenge).toBeTruthy();

        // 4. Generate a key pair of the correct type
        const keyPair = generateKeyPairForAlgorithm(v.keyAlgorithm);

        // 5. Build registration response
        const credential = buildRegistrationResponse({
          keyPair,
          challenge,
        });

        // 6. Verify registration
        const result = await client.verifyRegistration(credential, `Test ${v.name} Key`);
        expect(result.verified).toBe(true);
      } finally {
        await client.dispose();
      }
    });
  }
});
