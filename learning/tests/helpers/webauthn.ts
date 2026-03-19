/**
 * WebAuthn response crafting helpers for Playwright tests.
 *
 * This module can:
 *  - Generate valid attestation responses (registration)
 *  - Generate valid assertion responses (authentication)
 *  - Manipulate individual fields to trigger specific exploits
 */

import crypto from 'crypto';

// ─── CBOR Encoding (minimal) ──────────────────────────────────────────────

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

function cborEncodeString(s: string): Buffer {
  const buf = Buffer.from(s, 'utf-8');
  const len = buf.length;
  let header: Buffer;
  if (len < 24) header = Buffer.from([0x60 | len]);
  else if (len < 256) header = Buffer.from([0x78, len]);
  else header = Buffer.from([0x79, (len >> 8) & 0xff, len & 0xff]);
  return Buffer.concat([header, buf]);
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
  if (typeof value === 'string') return cborEncodeString(value);
  if (value instanceof Uint8Array) return cborEncodeBytes(Buffer.from(value));
  throw new Error(`Unsupported CBOR type: ${typeof value}`);
}

// ─── Base64url helpers ────────────────────────────────────────────────────

export function b64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString('base64url');
}

export function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

// ─── COSE Key Encoding ───────────────────────────────────────────────────

function coseES256(x: Buffer, y: Buffer): Buffer {
  const map = new Map<number, unknown>();
  map.set(1, 2);   // kty: EC2
  map.set(3, -7);  // alg: ES256
  map.set(-1, 1);  // crv: P-256
  map.set(-2, x);  // x
  map.set(-3, y);  // y
  return cborEncodeMap([...map.entries()]);
}

function coseRS256(n: Buffer, e: Buffer): Buffer {
  const map = new Map<number, unknown>();
  map.set(1, 3);     // kty: RSA
  map.set(3, -257);  // alg: RS256
  map.set(-1, n);    // n
  map.set(-2, e);    // e
  return cborEncodeMap([...map.entries()]);
}

function coseEdDSA(x: Buffer): Buffer {
  const map = new Map<number, unknown>();
  map.set(1, 1);   // kty: OKP
  map.set(3, -8);  // alg: EdDSA
  map.set(-1, 6);  // crv: Ed25519
  map.set(-2, x);  // x
  return cborEncodeMap([...map.entries()]);
}

// ─── Key Pair Management ─────────────────────────────────────────────────

export interface KeyPair {
  algorithm: number;
  privateKey: crypto.KeyObject;
  publicKeyCose: Buffer;
  credentialId: string; // base64url
}

export function generateES256KeyPair(credentialId?: string): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  const jwk = publicKey.export({ format: 'jwk' });
  const x = Buffer.from(jwk.x!, 'base64url');
  const y = Buffer.from(jwk.y!, 'base64url');
  const cose = coseES256(x, y);
  return {
    algorithm: -7,
    privateKey,
    publicKeyCose: cose,
    credentialId: credentialId || b64url(crypto.randomBytes(32)),
  };
}

export function generateRS256KeyPair(credentialId?: string): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: 'jwk' });
  const n = Buffer.from(jwk.n!, 'base64url');
  const e = Buffer.from(jwk.e!, 'base64url');
  const cose = coseRS256(n, e);
  return {
    algorithm: -257,
    privateKey,
    publicKeyCose: cose,
    credentialId: credentialId || b64url(crypto.randomBytes(32)),
  };
}

export function generateEdDSAKeyPair(credentialId?: string): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' });
  const x = Buffer.from(jwk.x!, 'base64url');
  const cose = coseEdDSA(x);
  return {
    algorithm: -8,
    privateKey,
    publicKeyCose: cose,
    credentialId: credentialId || b64url(crypto.randomBytes(32)),
  };
}

// Load a key pair from the default JWK private keys in README
export function loadES256FromJWK(jwk: {
  x: string;
  y: string;
  d: string;
}, credentialId: string): KeyPair {
  const privateKey = crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d },
    format: 'jwk',
  });
  const x = Buffer.from(jwk.x, 'base64url');
  const y = Buffer.from(jwk.y, 'base64url');
  return {
    algorithm: -7,
    privateKey,
    publicKeyCose: coseES256(x, y),
    credentialId,
  };
}

export function loadRS256FromJWK(jwk: {
  n: string;
  e: string;
  d: string;
  p: string;
  q: string;
  dp: string;
  dq: string;
  qi: string;
}, credentialId: string): KeyPair {
  const privateKey = crypto.createPrivateKey({
    key: { kty: 'RSA', ...jwk },
    format: 'jwk',
  });
  const n = Buffer.from(jwk.n, 'base64url');
  const e = Buffer.from(jwk.e, 'base64url');
  return {
    algorithm: -257,
    privateKey,
    publicKeyCose: coseRS256(n, e),
    credentialId,
  };
}

export function loadEdDSAFromJWK(jwk: {
  x: string;
  d: string;
}, credentialId: string): KeyPair {
  const privateKey = crypto.createPrivateKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: jwk.x, d: jwk.d },
    format: 'jwk',
  });
  const x = Buffer.from(jwk.x, 'base64url');
  return {
    algorithm: -8,
    privateKey,
    publicKeyCose: coseEdDSA(x),
    credentialId,
  };
}

// ─── Default user keys from README ───────────────────────────────────────

export const DEFAULT_KEYS = {
  sheldon_es256: () => loadES256FromJWK(
    { x: 'LgXqG5n52e_-vPeXFszuYHAIymuJ2dzssHiZ1Unv-kw', y: 'KEIruNvIexnk5HQnS_H9QOGDf47J0BneGNgOYzJhDVg', d: 'ze-LcPCeInDzOwouNTy3i-HCd6DT5CBEDk8ZU2QlGUU' },
    'c2hlbGRvbi1jcmVkLTE'
  ),
  sheldon_rs256: () => loadRS256FromJWK(
    { n: '251ZOi6qFFWMfGTzZwLnVTmM7z2M01FXjvGQe0mm2KFIDSC53L83HtyFkI9VgOYntxvfAksFX_xVIg1SXUO1E8uYUBKf0nje-ZUgr4j0YMYt5Qr4qDNDVrVGYJqUTe3wMza44B2zT11J28C9AoJhwcKksHajyqsl6vRWLCScvTbgL5Cz17aEqRLaTiw4lPfcRysSiqI30K6IZQdXpLJqY0Xq55x7p3ybGqKTXisjFXcYr0n9XI-rDQV7hjWx97-61BIMLwh_CNwr9kv9Wu0H4fJE4Xq3VSNzC6QAUnkrWxIQ5XAB3l761Bnn_xFqnXSugErhOAn8GyGJA9OV5wmwMw', e: 'AQAB', d: 'Bf2PyS-BV4FR417EPkNtA1JzjrRoxVGLCDd8pRry4HvdwZs_6_k8oVc16Xs6GNmuVvyn-PcKPtOyOss5kO5fim-w8uuJzS2bihv67UQuGP8EPM2Ez4m-b3y4XmWOYBB6edsnRdhpjg5Rt8XVIgljw0DyScH4C8zerD8H-WJHnZL3BlpbBQGU96B1qWUi8gcRwLjRfZP-m5iR6-suHc3z0p95qe6vMEnbWTOKa3LwEjLGBM2OZsI_lMkAwGTXYiR9x7M58CQFXeB1vugXJN8hDSdvh8U4MRdCQ_qz7Bel58FcPHVbf_hgE7kg_3wEQv88tC0xeZFc642ZJsgUqpTmaQ', p: '7WijCGfla7hCFBzXqJ3U_ulQXMHxsNBot3hSzVt2Ep__C86wJLd_l7OlI2kX85QRwu58LD3iwUfsjP5ooRR3AvzsllmsrUwrPru4Sgn4yJ6W3V2mT0cjLPPJ0Kxl_vUoSQ89rHTrxtj5MBL5__N1rmoPXp6EWU5wQvK5JwJJJY0', q: '7M_9wCZEbX8NBYJpkIPChS7ltNH53l22G-Sr2PRm1Qf4yNerBYGepYARA9cYH4rq0TUZKQyiXOaSMik_5jcr5cgDejhdp--yRQH8wbzLfi8w6wqq7j1WPYO8mteKpzV48AHiVi0t4sVA-qmkmpZmuPNy4mOnK88-XxKxZqLYXL8', dp: 'DUE5UP_T_EamUc8mb0CYor7OAM_HObL5Fb0_Cj4gAnwyVittBC_GjOa3wplcf_n1X-fGwQWXgmkMmPafStcEqgMLBn3tOSO2imMar--Ml07bZ3KSFX0IRrs5uk_Vxf1UCXgzXkyM2WZFy1xT3ult2ZYMU6EQDJhnhiVdFwN2qAU', dq: 'MetaS0IF1KsenJW0GRGdVKPhKi_FI1nPxKt8ijxi3O9UQ0orM_rx7WNEsvGJlUScYUN3LU8Lftff45EMdkQVDdgO25m8LGV7x842cMSShOP_xNw30ga-AjOd82oSQVMlTjqncpENhiscmnpeR3QC7WPsSMrG95Y1SKdRHBih0VM', qi: 'HlFfqrcxerRhJPLclnTCkr2_1HavWlJ26GWqPi7Z_hYEOgI06k6V5dz9XxqdtRVIuZj0AzZbLVk-zmNlSLPs74KZxadGtyjShpqrphGhQJJjaBmphYmFgN8bEr6BL4n7xJJnTYSNxamx8sxXMWdJUpwC5olvSB_CLAPZauhXkRI' },
    'c2hlbGRvbi1jcmVkLTI'
  ),
  leonard_es256: () => loadES256FromJWK(
    { x: 'xR9wtCQbXzwUAJYamFkEY6Yb3-Mei43UOQytiLgv-VA', y: 'LO91gxbTJqz3BwjFKzYvoG4dVlmo3pFnnS6vcA1QAQY', d: '74nYZG3EwBo-o2QLRknXqPjRWcs84sLFp4ykDLefSs8' },
    'bGVvbmFyZC1jcmVkLTE'
  ),
  howard_ps384: () => {
    const jwk = { n: 'u6iUlq1JEjAlPiyGwAEjibQDOj9HECiutZ7T0s6AXXOHib1G3GPn7YCvZVIz0gk7Vbf53qCGxLJ8qbALgaCqaOcJB-9cbVohgwXefS5tIjPn2TnoI2KyaWBO1bxGLFChf_tde5KRL5dE2jpYwAPUHXljNdog9cLX8zbPucGKlGR88AwB-rHTM8gdGwwGfGstKeopZlw4TQHjujY2iIh1Ga-oiyCN5M0F2-E3bN4_JcVGGyRfjWKjpZ44fBifyNihRujc6G43Qo3lyFigRE26Y-3Jpk4nm1cpfMU-nn8t6WEl5UEXwPDJjYWxt3g9nNdh6XuBLNHi0CuBZ9P9USvNfw', e: 'AQAB', d: 'U9FATOypLo6Ck_qfVTMtBFx69JE-1GDXaBfA1O-XNiZb65G3DMky1kocDU1iB_ZHoknCOUXJ7CEsvT38ZbG1a5WF2x12UwFm5nbAoXkTFavJaqUKooN63MY_cAff7_szp05GuuMEJhWSk0ZsTZdoLqIBRhRflGWqvt9EeNuRYiWcC21wyPVX58HJrZqZgd3wRYrPCoCz5EUYsqqazcxl61I_-V_-HZE_LDVYX5wsAhLrK6sdlj0aT3tV0coean8KBMoxaYfbnjUDcaNBUZ4KdSjscT0_T6yVLHyV0V6_aba_o7VVWnEFZ_5Pcbys-JIPTiTCAxUNRfv_FfZ9ZbO8QQ', p: '5Q9S-_fGe5qad5AxfN7_Tc3hs2wuFaHp86o7yRtCDrah9s2x18A8zbkO-pt0EDeNxURAheCfUDc195T9vjtbn2eNZO88BHxZulI1K8G-sO1o34kLiuR9WPK7Uu0jTJyU9v1YdAQD76QqkbOQKxfIcmjQ7CC9Cwyb67BrsDlXsYs', q: '0bq4E70Kie2cUWFltGTlGitPkxsivskZgOQU5WmS6JfgDHPCmnVO1L0flAU3_LYdXFSPrAvSOTl2-DwcxK_c9YZ3MLeO7RtGaoLiJwRHSamQTgEwjnfrMYAoi4JxWjHOsKsi1zva3yZnBiDEDUvn5X7zn67lnRts1o5t8Fp-ql0', dp: 'WzuySseSl7KpaYvWGi1btKqXBfbFmDooS7P3Ig-oTOHzOrEM76kSzsGxtKFsJfVqkzKvHGOuMK384cLHGhjcUm5VQ-mBlyvMNUj_ApGlmSTGS5pzLXv6bQ4pDEuFbsNDFeksbPEYfD9_8Q57Ep7jaKZU6GfVw-vewo4_Ji6Avic', dq: 'VaFM4xI-KU6QklGX-u1u9R5V4RQlPYxSE2QMfBZ82uaXnb3t6K6YvxdwuzjeQRoCJt6HwpEZBjBGONgiTtQW_VAnfgaUHo8SUw6ZU6DVkmfe-VpW_vRLXOycoUljCpZnc46MLSDNHmtJiSD7qwog5nzM75ezPFAkQf3pOUdZjCk', qi: 'NgGYqLUAh9Qrwmldr0ZEgMTmEuA_W3UvYQGjo-UxfX2D9akq3GFLUf3NElEeKzxjWU7rzdRq97S5wvpiykceI4dvhITVEIWT0YiQadNd8PGjBBYYHEHwJwnvgNMXLchLx1jPe9VJb_oVlF57hSTmCJr_2jX4HJfE_puvzYn5n-4' };
    const privateKey = crypto.createPrivateKey({ key: { kty: 'RSA', ...jwk }, format: 'jwk' });
    const n = Buffer.from(jwk.n, 'base64url');
    const e = Buffer.from(jwk.e, 'base64url');
    // PS384 COSE: kty=3, alg=-38
    const map = new Map<number, unknown>();
    map.set(1, 3); map.set(3, -38); map.set(-1, n); map.set(-2, e);
    return {
      algorithm: -38,
      privateKey,
      publicKeyCose: cborEncodeMap([...map.entries()]),
      credentialId: 'aG93YXJkLWNyZWQtMQ',
    } as KeyPair;
  },
  bernadette_eddsa: () => loadEdDSAFromJWK(
    { x: 'z9y3n-lSSQNz5GOlAtFgFiepFPP93sX165FNsMsmrSY', d: 'DstImboPcqp2pTHWGUzSgZl2XS33r8phOSu9n_6VAC0' },
    'YmVybmFkZXR0ZS1jcmVkLTE'
  ),
  amy_es256_1: () => loadES256FromJWK(
    { x: 'UWwNyic8Vz5Kbbzh6wPgU0OxK558OHG0gRAj0Aq6N18', y: 'SKJefPMpnSRresyhlrQ4SPVppGK4OYIweNxGNh_aoqc', d: 'hSqyjWG4J2N99G1hBMh93t_KD3DwxhH_UbomFpQ2Ico' },
    'YW15LWNyZWQtMQ'
  ),
  amy_es256_2: () => loadES256FromJWK(
    { x: 'F3iyua1apQimS19-fTdeITJyPfflPJKuZTpcUC5Z-Lw', y: 'l_ZIy-OxX_xLrFYEakfDT22cBLhhjLnuDeRy_BuMe0Y', d: 'SYXuCp3zsWqlMgFcjjbfTPyt38Qkd5czyQki19NB7Ls' },
    'YW15LWNyZWQtMg'
  ),
  amy_rs256: () => loadRS256FromJWK(
    { n: '06Z2QSNZ0Xl5cDVYdgecXSxaXB1sdpxZ5PXQ2ZcI2kkmLUn7Jy9dZT-xOG85ORC8S40eUvX4Htfpagmv4ZZl_gu7W5LCeFehfLoltL_nHtV-xtA6WZJzO7gMF3Z3DNxIzRTof6wmlt91DTKxZlVGFhx3k_r-T5H0ssj8vmc7fbD0L59eOrwVl0n5oCjaM92-JFXQevoYMTD010Ol0zjYA5LCmIVwyth4lljdWMzs_DDBd2MKUHgdUCSH5Yi5Cabf1Yy6lmLdk1cg5VLO0FGMUXdPCNsSjYK-Q1ljMJJ_S9nn-_hdvhnAaGhVpxsMHxmLz6ad1utypGTK3V65tLbkfQ', e: 'AQAB', d: 'Gquu2i18u4ddtLScNZ9m5lzY9COnD9lLAK2zSEAelvdBztI0Sm9PCxu4Ft75LIY93B1n1Vd2kVhu6vRWjAxaROWwke0QAX81c9S3PKw0ETAhHieOOsxYJg3exDQi82Vs7R7132TPphJ5mxSowzb6sn2a2fR2iIthdQgbxViX6BIiPsMUINLziS-opYpYZupz2nq7btzWfkC9kW_oEP47F53Q7CgcYoGmnKW7Ae3u1Ln74prk39407dOePTBHVptEjKSRK5OMWkP6WskuARxUI5wqCcEEFK3eDLnBZEvyd_yAH3XnEpuTWe9W8G8RCy6lyUkeIhhOf9jyckOIVSWnFw', p: '7MkNCts9fJcz8GPge2JO_mMbSSXwD4rmwpq46-CKwAxRKWRvp8GnXIzBhlnbSzQveC9710s9SY_fSx7xAWtZlYW9uQXWJt4i64hbzr05ZIreFhZ8jj8LCrOz7jaZ7gS5bmlILVci4BK0wa50z07DFlxQbBZ5H1Y6Ag7e0J160K8', q: '5NNB33ExLv9GKo1zwR8umWl0QBRaSwOmUDzGcdFg66iN4lxGAID74bRtlInFmzBtwvZSgDK_lX1j2KQ6_BzhZUh5USIMmYNdI1hMbDwAevovl0b-Obvgv248ckMxsHLhyvXd4S-A8b1ydFBAJSeDw42QdVJTpkx2wJXltMaD8JM', dp: 'wfMYtMjJ_3CWgZQ9vrLSw3oIUo05qnF6_PHhAIxm-lHcdQwojP-Jh7xflB2sC1iOfWJfjQS7CbNIEm8gt6nnshrfQVtvg1y2u7hwgtHp3doFeZAnrBglgjmZ60hcI2NJRBAGp-TU0zdfSboNQfVgxMMOuMpbofhuAVuO1M_5Vk8', dq: 'RDNG5d7pxtUkx5gDUSMHE4hfsp2eT89VqYKDrva1yWciar4PyySmbh4FrwjlEZz8ieg6rKTzfw2xTaedQPkmoLZaGjlowfRqNRejJ3s2tXCN8KujJ_f8Q3IKqA-o5qtG6uQe7nfnGaXaUBp_E9PULNurm5we_Gi72CiVHy0vs-s', qi: 'T1Q-SrHrZI2UFr6Gjh1TFrRK1wKqL6VaIhrmInbdZsgsz7k-bN4Rw7-GT_hKtCWFDUI6QMak7aRfm1yj9WbKLrZKbE3tQCcXZKOTGEtE9K_5FIpa7_1gg7jqCESpAzYJ8xOpI649Q1CpLp7hpONWWfAdLd54Da1soP8upx-fBA' },
    'YW15LWNyZWQtMw'
  ),
};

// ─── AuthenticatorData construction ──────────────────────────────────────

export interface AuthDataOptions {
  rpIdHash?: Buffer;
  rpId?: string;
  flags?: {
    up?: boolean;    // User Present
    uv?: boolean;    // User Verified
    at?: boolean;    // Attested credential data
    ed?: boolean;    // Extension data
    be?: boolean;    // Backup Eligible
    bs?: boolean;    // Backup State
  };
  signCount?: number;
  // For registration (AT flag set)
  aaguid?: Buffer;
  credentialId?: Buffer;
  publicKeyCose?: Buffer;
}

export function buildAuthenticatorData(opts: AuthDataOptions): Buffer {
  const rpIdHash = opts.rpIdHash || crypto.createHash('sha256').update(opts.rpId || 'localhost').digest();

  let flagByte = 0;
  const flags = opts.flags || {};
  if (flags.up !== false) flagByte |= 0x01;       // UP
  if (flags.uv !== false) flagByte |= 0x04;       // UV
  if (flags.at) flagByte |= 0x40;                  // AT
  if (flags.ed) flagByte |= 0x80;                  // ED
  if (flags.be) flagByte |= 0x08;                  // BE
  if (flags.bs) flagByte |= 0x10;                  // BS

  const signCount = Buffer.alloc(4);
  signCount.writeUInt32BE(opts.signCount ?? 1, 0);

  const parts: Buffer[] = [rpIdHash, Buffer.from([flagByte]), signCount];

  if (flags.at && opts.aaguid && opts.credentialId && opts.publicKeyCose) {
    parts.push(opts.aaguid);
    const credIdLen = Buffer.alloc(2);
    credIdLen.writeUInt16BE(opts.credentialId.length, 0);
    parts.push(credIdLen);
    parts.push(opts.credentialId);
    parts.push(opts.publicKeyCose);
  }

  return Buffer.concat(parts);
}

// ─── ClientDataJSON construction ─────────────────────────────────────────

export interface ClientDataOptions {
  type?: string;
  challenge: string; // base64url
  origin?: string;
  crossOrigin?: boolean;
  topOrigin?: string;
}

export function buildClientDataJSON(opts: ClientDataOptions): Buffer {
  const obj: Record<string, unknown> = {
    type: opts.type || 'webauthn.create',
    challenge: opts.challenge,
    origin: opts.origin || 'http://localhost:3000',
  };
  if (opts.crossOrigin !== undefined) {
    obj.crossOrigin = opts.crossOrigin;
  }
  if (opts.topOrigin !== undefined) {
    obj.topOrigin = opts.topOrigin;
  }
  return Buffer.from(JSON.stringify(obj), 'utf-8');
}

// ─── Attestation Object (Registration) ──────────────────────────────────

export function buildAttestationObject(authData: Buffer): Buffer {
  // fmt: "none", attStmt: {}, authData: <bytes>
  const entries: [unknown, unknown][] = [
    ['fmt', 'none'],
    ['attStmt', new Map()],
    ['authData', authData],
  ];
  const parts: Buffer[] = [];
  // Map header for 3 entries
  parts.push(Buffer.from([0xa3]));
  for (const [k, v] of entries) {
    if (typeof k === 'string') {
      parts.push(cborEncodeString(k));
    }
    if (typeof v === 'string') {
      parts.push(cborEncodeString(v));
    } else if (v instanceof Map) {
      parts.push(cborEncodeMap([...v.entries()]));
    } else if (Buffer.isBuffer(v)) {
      parts.push(cborEncodeBytes(v));
    }
  }
  return Buffer.concat(parts);
}

// ─── Registration Response ───────────────────────────────────────────────

export interface RegistrationResponseOptions {
  keyPair: KeyPair;
  challenge: string;
  rpId?: string;
  origin?: string;
  type?: string;
  crossOrigin?: boolean;
  topOrigin?: string;
  flags?: AuthDataOptions['flags'];
  signCount?: number;
  aaguid?: string; // hex
  userHandle?: string;
  credentialIdOverride?: string; // base64url - override the credential ID in the response
}

export function buildRegistrationResponse(opts: RegistrationResponseOptions) {
  const credentialIdBuf = b64urlDecode(opts.credentialIdOverride || opts.keyPair.credentialId);

  const authData = buildAuthenticatorData({
    rpId: opts.rpId || 'localhost',
    flags: { up: true, uv: true, at: true, ...opts.flags },
    signCount: opts.signCount ?? 0,
    aaguid: opts.aaguid
      ? Buffer.from(opts.aaguid.replace(/-/g, ''), 'hex')
      : Buffer.alloc(16),
    credentialId: credentialIdBuf,
    publicKeyCose: opts.keyPair.publicKeyCose,
  });

  const attestationObject = buildAttestationObject(authData);

  const clientDataJSON = buildClientDataJSON({
    type: opts.type || 'webauthn.create',
    challenge: opts.challenge,
    origin: opts.origin || 'http://localhost:3000',
    crossOrigin: opts.crossOrigin,
    topOrigin: opts.topOrigin,
  });

  return {
    id: opts.credentialIdOverride || opts.keyPair.credentialId,
    rawId: opts.credentialIdOverride || opts.keyPair.credentialId,
    type: 'public-key',
    response: {
      clientDataJSON: b64url(clientDataJSON),
      attestationObject: b64url(attestationObject),
      transports: ['internal'],
    },
    clientExtensionResults: {},
    authenticatorAttachment: 'platform',
  };
}

// ─── Authentication Response ─────────────────────────────────────────────

export interface AuthenticationResponseOptions {
  keyPair: KeyPair;
  challenge: string;
  rpId?: string;
  origin?: string;
  type?: string;
  crossOrigin?: boolean;
  topOrigin?: string;
  flags?: AuthDataOptions['flags'];
  signCount?: number;
  userHandle?: string; // base64url
  credentialIdOverride?: string; // override credential ID in response
  invalidSignature?: boolean;
}

export function buildAuthenticationResponse(opts: AuthenticationResponseOptions) {
  const rpId = opts.rpId || 'localhost';

  const authData = buildAuthenticatorData({
    rpId,
    flags: { up: true, uv: true, ...opts.flags },
    signCount: opts.signCount ?? 1,
  });

  const clientDataJSON = buildClientDataJSON({
    type: opts.type || 'webauthn.get',
    challenge: opts.challenge,
    origin: opts.origin || 'http://localhost:3000',
    crossOrigin: opts.crossOrigin,
    topOrigin: opts.topOrigin,
  });

  // Compute signature over authData + SHA256(clientDataJSON)
  const clientDataHash = crypto.createHash('sha256').update(clientDataJSON).digest();
  const signatureInput = Buffer.concat([authData, clientDataHash]);

  let signature: Buffer;
  if (opts.invalidSignature) {
    // Generate a valid-format signature with wrong key to get "signature" error
    // Sign with a different (freshly generated) key
    const fakeKey = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    signature = crypto.sign('sha256', signatureInput, {
      key: fakeKey.privateKey,
      dsaEncoding: 'der',
    });
  } else {
    const alg = opts.keyPair.algorithm;
    if (alg === -7) {
      // ES256
      const sig = crypto.sign('sha256', signatureInput, {
        key: opts.keyPair.privateKey,
        dsaEncoding: 'der',
      });
      signature = sig;
    } else if (alg === -257) {
      // RS256
      signature = crypto.sign('sha256', signatureInput, {
        key: opts.keyPair.privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      });
    } else if (alg === -38) {
      // PS384
      signature = crypto.sign('sha384', signatureInput, {
        key: opts.keyPair.privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      });
    } else if (alg === -8) {
      // EdDSA
      signature = crypto.sign(null, signatureInput, opts.keyPair.privateKey);
    } else {
      throw new Error(`Unsupported algorithm: ${alg}`);
    }
  }

  const credId = opts.credentialIdOverride || opts.keyPair.credentialId;

  return {
    id: credId,
    rawId: credId,
    type: 'public-key',
    response: {
      clientDataJSON: b64url(clientDataJSON),
      authenticatorData: b64url(authData),
      signature: b64url(signature),
      userHandle: opts.userHandle || null,
    },
    clientExtensionResults: {},
    authenticatorAttachment: 'platform',
  };
}
