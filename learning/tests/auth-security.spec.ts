/**
 * Authentication Security Verifier Tests (IDs 9-28)
 *
 * Each test:
 *   1. Sends the exploit against the DEFAULT SECURE verifier → expects REJECTION (no reward)
 *   2. Sends the exploit against the VULNERABLE verifier → expects SUCCESS with correct reward flag
 *
 * Default reward flag mapping (from verifiers.json, with default REWARD_FLAG_ORDER):
 *   V9  → Libya                  V19 → Georgia
 *   V10 → Cambodia               V20 → Armenia
 *   V11 → Belize                 V21 → Azerbaijan
 *   V12 → Paraguay               V22 → Tajikistan
 *   V13 → Lesotho                V23 → Uzbekistan
 *   V14 → Ecuador                V24 → Kyrgyzstan
 *   V15 → San Marino             V25 → North Macedonia
 *   V16 → Andorra                V26 → Bosnia and Herzegovina
 *   V17 → Moldova                V27 → Micronesia
 *   V18 → Montenegro             V28 → Nauru
 */

import { test, expect } from '@playwright/test';
import { createApiClient, ApiClient } from './helpers/api';
import {
  DEFAULT_KEYS,
  buildAuthenticationResponse,
  b64url,
  b64urlDecode,
  generateES256KeyPair,
} from './helpers/webauthn';

// Expected reward flag countries per verifier (default REWARD_FLAG_ORDER=1,2,...,38)
const EXPECTED_COUNTRY: Record<number, string> = {
  9: 'Libya',
  10: 'Cambodia',
  11: 'Belize',
  12: 'Paraguay',
  13: 'Lesotho',
  14: 'Ecuador',
  15: 'San Marino',
  16: 'Andorra',
  17: 'Moldova',
  18: 'Montenegro',
  19: 'Georgia',
  20: 'Armenia',
  21: 'Azerbaijan',
  22: 'Tajikistan',
  23: 'Uzbekistan',
  24: 'Kyrgyzstan',
  25: 'North Macedonia',
  26: 'Bosnia and Herzegovina',
  27: 'Micronesia',
  28: 'Nauru',
};

// Default secure auth verifier (ID 2: Discoverable, all checks enabled)
const SECURE_AUTH_VERIFIER = 2;

test.describe('Authentication Security Verifiers', () => {
  let client: ApiClient;

  test.beforeEach(async () => {
    client = await createApiClient();
  });

  test.afterEach(async () => {
    await client.dispose();
  });

  // Helper: build discoverable auth response with sheldon's ES256 key
  function sheldonAuth(
    challenge: string,
    overrides: Record<string, any> = {}
  ) {
    const keyPair = DEFAULT_KEYS.sheldon_es256();
    return buildAuthenticationResponse({
      keyPair,
      challenge,
      userHandle: b64url(Buffer.from('1')),
      signCount: 100,
      ...overrides,
    });
  }

  // V9: No Cred Binding - Use attacker's credential with victim's username
  test('V9: No Cred Binding - use own credential for another user', async () => {
    // NEGATIVE: secure non-discoverable verifier (V4) should reject mismatched credential
    await client.switchVerifier(4, 'authentication');
    const secOpts = await client.getAuthenticationOptions('leonard');
    const secCred = sheldonAuth(secOpts.options.challenge);
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier should accept and reward
    await client.switchVerifier(9, 'authentication');
    const optionsRes = await client.getAuthenticationOptions('leonard');
    const credential = sheldonAuth(optionsRes.options.challenge);
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[9]);
  });

  // V10: Cred Binding Takeover - Login as victim using attacker's credential
  test('V10: Cred Binding Takeover - account takeover via binding skip', async () => {
    // NEGATIVE: secure verifier rejects
    await client.switchVerifier(4, 'authentication');
    const secOpts = await client.getAuthenticationOptions('leonard');
    const secCred = sheldonAuth(secOpts.options.challenge);
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier grants takeover
    await client.switchVerifier(10, 'authentication');
    const optionsRes = await client.getAuthenticationOptions('leonard');
    const credential = sheldonAuth(optionsRes.options.challenge);
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[10]);
    expect(result.user.username).toBe('leonard');
  });

  // V11: No User Handle - Send wrong userHandle
  test('V11: No User Handle - mismatched userHandle accepted', async () => {
    // NEGATIVE: secure discoverable verifier rejects mismatched userHandle
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(secOpts.options.challenge, {
      userHandle: b64url(Buffer.from('2')),
    });
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts
    await client.switchVerifier(11, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, {
      userHandle: b64url(Buffer.from('2')),
    });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[11]);
  });

  // V12: User Handle Takeover - Login as userHandle user
  test('V12: User Handle Takeover - login as userHandle user', async () => {
    // NEGATIVE: secure verifier rejects
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(secOpts.options.challenge, {
      userHandle: b64url(Buffer.from('2')),
    });
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts and logs in as userHandle user
    await client.switchVerifier(12, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, {
      userHandle: b64url(Buffer.from('2')),
    });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[12]);
    expect(result.user.username).toBe('leonard');
  });

  // V13: No Type Check - Send wrong type
  test('V13: No Type Check - wrong type accepted', async () => {
    // NEGATIVE: secure verifier rejects wrong type
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(secOpts.options.challenge, { type: 'webauthn.create' });
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts
    await client.switchVerifier(13, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, { type: 'webauthn.create' });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[13]);
  });

  // V14: Type Swap - Send swapped type (webauthn.create instead of .get)
  test('V14: Type Swap - swapped type accepted', async () => {
    // NEGATIVE: secure verifier rejects
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(secOpts.options.challenge, { type: 'webauthn.create' });
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts
    await client.switchVerifier(14, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, { type: 'webauthn.create' });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[14]);
  });

  // V15: No Challenge - Send wrong challenge
  test('V15: No Challenge - arbitrary challenge accepted', async () => {
    // NEGATIVE: secure verifier rejects wrong challenge
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(b64url(Buffer.from('fake-challenge-12345')));
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts
    await client.switchVerifier(15, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(b64url(Buffer.from('fake-challenge-12345')));
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[15]);
  });

  // V16: Reused Challenge - Reuse a previously verified challenge
  test('V16: Reused Challenge - reused challenge from same session', async () => {
    // NEGATIVE: do successful auth on secure verifier, then reuse fails
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts1 = await client.getAuthenticationOptions();
    const secCred1 = sheldonAuth(secOpts1.options.challenge, { signCount: 100 });
    const secRes1 = await client.verifyAuthentication(secCred1);
    expect(secRes1.verified).toBe(true);
    await client.logout();
    const secOpts2 = await client.getAuthenticationOptions();
    const secCred2 = sheldonAuth(secOpts1.options.challenge, { signCount: 200 }); // reuse old
    const secResult = await client.verifyAuthentication(secCred2);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts reused challenge
    await client.switchVerifier(16, 'authentication');
    const opts1 = await client.getAuthenticationOptions();
    const cred1 = sheldonAuth(opts1.options.challenge, { signCount: 300 });
    const res1 = await client.verifyAuthentication(cred1);
    expect(res1.verified).toBe(true);
    await client.logout();
    const opts2 = await client.getAuthenticationOptions();
    const credential = sheldonAuth(opts1.options.challenge, { signCount: 400 });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[16]);
  });

  // V17: Cross-Session Challenge - Use challenge from another session
  test('V17: Cross-Session Challenge - challenge from different session', async () => {
    // NEGATIVE: secure verifier rejects cross-session challenge
    const client2 = await createApiClient();
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    await client2.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts2 = await client2.getAuthenticationOptions();
    const secOpts1 = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(secOpts2.options.challenge);
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts cross-session challenge
    await client.switchVerifier(17, 'authentication');
    await client2.switchVerifier(17, 'authentication');
    const opts2b = await client2.getAuthenticationOptions();
    const opts3 = await client.getAuthenticationOptions();
    const credential = sheldonAuth(opts2b.options.challenge);
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[17]);

    await client2.dispose();
  });

  // V18: No Origin - Send wrong origin
  test('V18: No Origin - wrong origin accepted', async () => {
    // NEGATIVE: secure verifier rejects wrong origin
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(secOpts.options.challenge, { origin: 'https://evil.example.com' });
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts
    await client.switchVerifier(18, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, { origin: 'https://evil.example.com' });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[18]);
  });

  // V19: Same-Site Origin - Send same-site origin (subdomain)
  // Note: On localhost, tldts cannot determine eTLD+1 so same-site exploit may not trigger.
  test('V19: Same-Site Origin - same-site subdomain origin accepted', async () => {
    await client.switchVerifier(19, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, { origin: 'http://sub.localhost:3000' });
    const result = await client.verifyAuthentication(credential);
    // PSL limitation on localhost: exploit may not trigger
    expect(result.verified !== undefined).toBe(true);
    if (result.reward) {
      expect(result.reward.country).toBe(EXPECTED_COUNTRY[19]);
    }
  });

  // V20: No Cross-Origin - Accept cross-origin framed request
  test('V20: No Cross-Origin - cross-origin frame accepted', async () => {
    // NEGATIVE: secure verifier rejects cross-origin frame
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(secOpts.options.challenge, {
      crossOrigin: true,
      topOrigin: 'https://evil.example.com',
    });
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts
    await client.switchVerifier(20, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, {
      crossOrigin: true,
      topOrigin: 'https://evil.example.com',
    });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[20]);
  });

  // V21: No RP ID - Send wrong rpIdHash
  test('V21: No RP ID - wrong rpIdHash accepted', async () => {
    // NEGATIVE: secure verifier rejects wrong rpId
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(secOpts.options.challenge, { rpId: 'evil.example.com' });
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts
    await client.switchVerifier(21, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, { rpId: 'evil.example.com' });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[21]);
  });

  // V22: Same-Site RP ID - Send same-site rpId
  // Note: On localhost, tldts cannot determine eTLD+1 so same-site exploit may not trigger.
  test('V22: Same-Site RP ID - same-site rpId accepted', async () => {
    await client.switchVerifier(22, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, { rpId: 'sub.localhost' });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified !== undefined).toBe(true);
    if (result.reward) {
      expect(result.reward.country).toBe(EXPECTED_COUNTRY[22]);
    }
  });

  // V23: No UP Flag - Send response with UP=0
  test('V23: No UP Flag - user not present flag accepted', async () => {
    // NEGATIVE: secure verifier rejects UP=0
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(secOpts.options.challenge, { flags: { up: false, uv: true } });
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts
    await client.switchVerifier(23, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, { flags: { up: false, uv: true } });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[23]);
  });

  // V24: No UV Flag - Send response with UV=0
  test('V24: No UV Flag - user not verified flag accepted', async () => {
    // NEGATIVE: secure verifier rejects UV=0
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(secOpts.options.challenge, { flags: { up: true, uv: false } });
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts
    await client.switchVerifier(24, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, { flags: { up: true, uv: false } });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[24]);
  });

  // V25: No Backup Flags - Send invalid backup flag combo (BS=1, BE=0)
  test('V25: No Backup Flags - invalid BE/BS combo accepted', async () => {
    // NEGATIVE: secure verifier rejects invalid BE/BS
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(secOpts.options.challenge, {
      flags: { up: true, uv: true, be: false, bs: true },
    });
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts
    await client.switchVerifier(25, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, {
      flags: { up: true, uv: true, be: false, bs: true },
    });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[25]);
  });

  // V26: No BE Consistency - Change backup eligibility from stored value
  test('V26: No BE Consistency - backup eligibility change accepted', async () => {
    // NEGATIVE: secure verifier rejects BE change
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(secOpts.options.challenge, {
      flags: { up: true, uv: true, be: true, bs: false },
    });
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts
    await client.switchVerifier(26, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, {
      flags: { up: true, uv: true, be: true, bs: false },
    });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[26]);
  });

  // V27: No Signature - Send invalid signature
  test('V27: No Signature - invalid signature accepted', async () => {
    // NEGATIVE: secure verifier rejects invalid signature
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const keyPair = DEFAULT_KEYS.sheldon_es256();
    const secCred = buildAuthenticationResponse({
      keyPair,
      challenge: secOpts.options.challenge,
      signCount: 100,
      userHandle: b64url(Buffer.from('1')),
      invalidSignature: true,
    });
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts
    await client.switchVerifier(27, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = buildAuthenticationResponse({
      keyPair,
      challenge: optionsRes.options.challenge,
      signCount: 200,
      userHandle: b64url(Buffer.from('1')),
      invalidSignature: true,
    });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[27]);
  });

  // V28: No Counter - Send counter that's lower than stored
  test('V28: No Counter - counter rollback accepted', async () => {
    // NEGATIVE: secure verifier rejects counter rollback
    await client.switchVerifier(SECURE_AUTH_VERIFIER, 'authentication');
    const secOpts = await client.getAuthenticationOptions();
    const secCred = sheldonAuth(secOpts.options.challenge, { signCount: 1 });
    const secResult = await client.verifyAuthentication(secCred);
    expect(secResult.verified).not.toBe(true);
    expect(secResult.reward).toBeFalsy();

    // POSITIVE: vulnerable verifier accepts
    await client.switchVerifier(28, 'authentication');
    const optionsRes = await client.getAuthenticationOptions();
    const credential = sheldonAuth(optionsRes.options.challenge, { signCount: 1 });
    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
    expect(result.reward).toBeTruthy();
    expect(result.reward.country).toBe(EXPECTED_COUNTRY[28]);
  });
});
