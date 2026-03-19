#!/usr/bin/env node

/**
 * Generate random .env values for production deployment.
 *
 * Usage:
 *   node scripts/generate-env.js           # generates .env with random values
 *   node scripts/generate-env.js --stdout  # prints to stdout instead of writing file
 *
 * This script generates:
 *   - Random passwords for all default users
 *   - Random security questions and answers
 *   - New passkey key pairs (with COSE-encoded public keys)
 *   - Shuffled reward flag order
 *   - Random session secret
 *
 * It also writes a passkey-private-keys.json file with the JWK private keys
 * needed for testing authentication flows.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// COSE key encoding helpers (minimal CBOR for our key types)
function encodeCBOR(value) {
  if (value instanceof Map) {
    const entries = [...value.entries()];
    const parts = [encodeMapHeader(entries.length)];
    for (const [k, v] of entries) {
      parts.push(encodeCBOR(k));
      parts.push(encodeCBOR(v));
    }
    return Buffer.concat(parts);
  }
  if (typeof value === 'number') {
    return encodeInteger(value);
  }
  if (Buffer.isBuffer(value)) {
    return encodeBytes(value);
  }
  throw new Error(`Unsupported CBOR type: ${typeof value}`);
}

function encodeMapHeader(length) {
  if (length < 24) return Buffer.from([0xa0 | length]);
  if (length < 256) return Buffer.from([0xb8, length]);
  throw new Error('Map too large');
}

function encodeInteger(n) {
  if (n >= 0) {
    if (n < 24) return Buffer.from([n]);
    if (n < 256) return Buffer.from([0x18, n]);
    if (n < 65536) return Buffer.from([0x19, (n >> 8) & 0xff, n & 0xff]);
    throw new Error('Integer too large');
  }
  // Negative: CBOR major type 1, value = -1 - n
  const val = -1 - n;
  if (val < 24) return Buffer.from([0x20 | val]);
  if (val < 256) return Buffer.from([0x38, val]);
  if (val < 65536) return Buffer.from([0x39, (val >> 8) & 0xff, val & 0xff]);
  throw new Error('Negative integer too small');
}

function encodeBytes(buf) {
  const len = buf.length;
  let header;
  if (len < 24) header = Buffer.from([0x40 | len]);
  else if (len < 256) header = Buffer.from([0x58, len]);
  else if (len < 65536) header = Buffer.from([0x59, (len >> 8) & 0xff, len & 0xff]);
  else throw new Error('Bytes too large');
  return Buffer.concat([header, buf]);
}

// COSE key type constants
const COSE_KTY = 1;
const COSE_ALG = 3;
const COSE_CRV = -1;
const COSE_X = -2;
const COSE_Y = -3;
const COSE_N = -1;
const COSE_E = -2;

// Encode EC key to COSE
function encodeEC_COSE(alg, crv, x, y) {
  const map = new Map();
  map.set(COSE_KTY, 2); // EC2
  map.set(COSE_ALG, alg);
  map.set(COSE_CRV, crv);
  map.set(COSE_X, x);
  map.set(COSE_Y, y);
  return encodeCBOR(map);
}

// Encode RSA key to COSE
function encodeRSA_COSE(alg, n, e) {
  const map = new Map();
  map.set(COSE_KTY, 3); // RSA
  map.set(COSE_ALG, alg);
  map.set(COSE_N, n);
  map.set(COSE_E, e);
  return encodeCBOR(map);
}

// Encode OKP key to COSE
function encodeOKP_COSE(alg, crv, x) {
  const map = new Map();
  map.set(COSE_KTY, 1); // OKP
  map.set(COSE_ALG, alg);
  map.set(COSE_CRV, crv);
  map.set(COSE_X, x);
  return encodeCBOR(map);
}

function base64urlEncode(buf) {
  return buf.toString('base64url');
}

function base64urlDecode(str) {
  return Buffer.from(str, 'base64url');
}

// Generate a random password
function generatePassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// Generate a random security answer
function generateSecurityAnswer() {
  const words = crypto.randomBytes(12).toString('hex');
  return words.substring(0, 16);
}

// Security question pool
const SECURITY_QUESTIONS = [
  'What is the name of your first pet?',
  'What city were you born in?',
  'What is your favorite color?',
  'What was the name of your elementary school?',
  'What is your mother\'s maiden name?',
  'What was your childhood nickname?',
  'What is the name of the street you grew up on?',
  'What is your favorite movie?',
  'What was the make of your first car?',
  'What is your favorite food?',
  'What is the name of your best friend?',
  'What was the first concert you attended?',
  'What is your favorite sports team?',
  'What is the middle name of your oldest sibling?',
];

function randomQuestion() {
  return SECURITY_QUESTIONS[crypto.randomInt(SECURITY_QUESTIONS.length)];
}

// Generate EC P-256 key pair
function generateES256Key(credentialId) {
  const keyPair = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });

  const publicJwk = keyPair.publicKey.export({ format: 'jwk' });
  const privateJwk = keyPair.privateKey.export({ format: 'jwk' });

  const x = base64urlDecode(publicJwk.x);
  const y = base64urlDecode(publicJwk.y);
  const coseKey = encodeEC_COSE(-7, 1, x, y); // ES256, P-256

  return {
    credentialId,
    algorithm: -7,
    publicKeyCose: base64urlEncode(coseKey),
    privateKey: { kty: 'EC', crv: 'P-256', alg: 'ES256', ...privateJwk },
    publicKey: { kty: 'EC', crv: 'P-256', alg: 'ES256', x: publicJwk.x, y: publicJwk.y },
  };
}

// Generate RSA key pair (for RS256 or PS384)
function generateRSAKey(credentialId, alg, algName) {
  const keyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 65537,
  });

  const publicJwk = keyPair.publicKey.export({ format: 'jwk' });
  const privateJwk = keyPair.privateKey.export({ format: 'jwk' });

  const n = base64urlDecode(publicJwk.n);
  const e = base64urlDecode(publicJwk.e);
  const coseKey = encodeRSA_COSE(alg, n, e);

  return {
    credentialId,
    algorithm: alg,
    publicKeyCose: base64urlEncode(coseKey),
    privateKey: { kty: 'RSA', alg: algName, ...privateJwk },
    publicKey: { kty: 'RSA', alg: algName, n: publicJwk.n, e: publicJwk.e },
  };
}

// Generate Ed25519 key pair
function generateEdDSAKey(credentialId) {
  const keyPair = crypto.generateKeyPairSync('ed25519');

  const publicJwk = keyPair.publicKey.export({ format: 'jwk' });
  const privateJwk = keyPair.privateKey.export({ format: 'jwk' });

  const x = base64urlDecode(publicJwk.x);
  const coseKey = encodeOKP_COSE(-8, 6, x); // EdDSA, Ed25519

  return {
    credentialId,
    algorithm: -8,
    publicKeyCose: base64urlEncode(coseKey),
    privateKey: { kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA', ...privateJwk },
    publicKey: { kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA', x: publicJwk.x },
  };
}

// Shuffle array using Fisher-Yates
function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Users and their passkey configurations (matching defaults.json structure)
const USERS = [
  { username: 'sheldon', envPrefix: 'SHELDON' },
  { username: 'leonard', envPrefix: 'LEONARD' },
  { username: 'penny', envPrefix: 'PENNY' },
  { username: 'howard', envPrefix: 'HOWARD' },
  { username: 'raj', envPrefix: 'RAJ' },
  { username: 'bernadette', envPrefix: 'BERNADETTE' },
  { username: 'amy', envPrefix: 'AMY' },
];

// Passkey definitions matching defaults.json structure
const PASSKEY_DEFS = [
  { id: 1, userId: 1, name: 'MacBook Touch ID', type: 'ES256', credIdBase: 'sheldon-cred-1' },
  { id: 2, userId: 1, name: 'YubiKey 5', type: 'RS256', credIdBase: 'sheldon-cred-2' },
  { id: 3, userId: 2, name: 'iPhone Passkey', type: 'ES256', credIdBase: 'leonard-cred-1' },
  { id: 4, userId: 4, name: 'Security Key', type: 'PS384', credIdBase: 'howard-cred-1' },
  { id: 5, userId: 6, name: 'Windows Hello', type: 'EdDSA', credIdBase: 'bernadette-cred-1' },
  { id: 6, userId: 7, name: 'MacBook Touch ID', type: 'ES256', credIdBase: 'amy-cred-1' },
  { id: 7, userId: 7, name: 'iPhone Passkey', type: 'ES256', credIdBase: 'amy-cred-2' },
  { id: 8, userId: 7, name: 'YubiKey Backup', type: 'RS256', credIdBase: 'amy-cred-3' },
];

function main() {
  const toStdout = process.argv.includes('--stdout');
  const projectRoot = path.resolve(__dirname, '..');

  // Read existing .env.example as base
  const envExamplePath = path.join(projectRoot, '.env.example');
  let envContent = fs.readFileSync(envExamplePath, 'utf-8');

  // Generate session secret
  const sessionSecret = crypto.randomBytes(32).toString('base64');
  envContent = envContent.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${sessionSecret}`);

  // Generate random passwords
  for (const user of USERS) {
    const password = generatePassword();
    envContent = envContent.replace(
      new RegExp(`^USER_${user.envPrefix}_PASSWORD=.*$`, 'm'),
      `USER_${user.envPrefix}_PASSWORD=${password}`
    );
  }

  // Generate random security questions and answers
  for (const user of USERS) {
    const question = randomQuestion();
    const answer = generateSecurityAnswer();
    envContent = envContent.replace(
      new RegExp(`^USER_${user.envPrefix}_SECURITY_QUESTION=.*$`, 'm'),
      `USER_${user.envPrefix}_SECURITY_QUESTION=${question}`
    );
    envContent = envContent.replace(
      new RegExp(`^USER_${user.envPrefix}_SECURITY_ANSWER=.*$`, 'm'),
      `USER_${user.envPrefix}_SECURITY_ANSWER=${answer}`
    );
  }

  // Generate new passkey key pairs
  const passkeyOverrides = [];
  const privateKeys = [];

  for (const def of PASSKEY_DEFS) {
    const credentialId = base64urlEncode(Buffer.from(def.credIdBase + '-' + crypto.randomBytes(8).toString('hex')));
    let keyData;

    switch (def.type) {
      case 'ES256':
        keyData = generateES256Key(credentialId);
        break;
      case 'RS256':
        keyData = generateRSAKey(credentialId, -257, 'RS256');
        break;
      case 'PS384':
        keyData = generateRSAKey(credentialId, -38, 'PS384');
        break;
      case 'EdDSA':
        keyData = generateEdDSAKey(credentialId);
        break;
      default:
        throw new Error(`Unknown key type: ${def.type}`);
    }

    passkeyOverrides.push({
      id: def.id,
      publicKey: keyData.publicKeyCose,
      credentialId: keyData.credentialId,
    });

    privateKeys.push({
      passkeyId: def.id,
      credentialId: keyData.credentialId,
      userId: def.userId,
      name: def.name,
      algorithm: keyData.algorithm,
      privateKey: keyData.privateKey,
      publicKey: keyData.publicKey,
    });
  }

  // Encode passkey overrides as base64 JSON
  const passkeyKeysB64 = Buffer.from(JSON.stringify(passkeyOverrides)).toString('base64');
  envContent = envContent.replace(
    /^# PASSKEY_KEYS=.*$/m,
    `PASSKEY_KEYS=${passkeyKeysB64}`
  );

  // Generate shuffled reward flag order (1-38)
  const flagIndices = Array.from({ length: 38 }, (_, i) => i + 1);
  const shuffledOrder = shuffle(flagIndices);
  envContent = envContent.replace(
    /^REWARD_FLAG_ORDER=.*$/m,
    `REWARD_FLAG_ORDER=${shuffledOrder.join(',')}`
  );

  if (toStdout) {
    process.stdout.write(envContent);
  } else {
    const envPath = path.join(projectRoot, '.env');
    fs.writeFileSync(envPath, envContent);
    console.log(`Generated .env at ${envPath}`);

    // Write private keys file
    const privateKeysPath = path.join(projectRoot, 'passkey-private-keys.json');
    fs.writeFileSync(
      privateKeysPath,
      JSON.stringify({ keys: privateKeys }, null, 2)
    );
    console.log(`Generated passkey private keys at ${privateKeysPath}`);
    console.log('');
    console.log('Summary of generated values:');
    console.log('  - Session secret: (random)');
    for (const user of USERS) {
      const re = new RegExp(`USER_${user.envPrefix}_PASSWORD=(.+)`);
      const match = envContent.match(re);
      console.log(`  - ${user.username} password: ${match ? match[1] : '?'}`);
    }
    console.log(`  - Reward flag order: ${shuffledOrder.join(',')}`);
    console.log(`  - Passkey keys: ${PASSKEY_DEFS.length} key pairs regenerated`);
    console.log('');
    console.log('IMPORTANT: Keep .env and passkey-private-keys.json secret!');
    console.log('  Add both to .gitignore (already done for .env).');
  }
}

main();
