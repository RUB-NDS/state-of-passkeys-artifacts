import { test, expect } from '@playwright/test';
import { createApiClient, ApiClient } from './helpers/api';
import { DEFAULT_KEYS, buildAuthenticationResponse, b64url } from './helpers/webauthn';

/**
 * Sheldon's ES256 credential has a stored signCount of 42 in the default data.
 * The authenticator response must include a counter value higher than the stored
 * one to pass the signature counter check (section 7.2.22).
 */
const SHELDON_SIGN_COUNT = 43;

test.describe('Authentication Demo Verifiers (IDs 1-8)', () => {
  let client: ApiClient;

  test.afterEach(async () => {
    if (client) {
      await client.dispose();
    }
  });

  // ─── ID 1: Password ────────────────────────────────────────────────────
  test('Verifier 1 (Password) - password-only login, no passkey', async () => {
    client = await createApiClient();
    await client.switchVerifier(1, 'authentication');

    const success = await client.login('sheldon', 'Bazinga73');
    expect(success).toBe(true);
  });

  // ─── ID 2: Discoverable ────────────────────────────────────────────────
  test('Verifier 2 (Discoverable) - discoverable credential flow', async () => {
    client = await createApiClient();
    await client.switchVerifier(2, 'authentication');

    const keyPair = DEFAULT_KEYS.sheldon_es256();
    const optionsRes = await client.getAuthenticationOptions();
    const challenge = optionsRes.options.challenge;

    const credential = buildAuthenticationResponse({
      keyPair,
      challenge,
      userHandle: b64url(Buffer.from('1')),
      signCount: SHELDON_SIGN_COUNT,
    });

    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
  });

  // ─── ID 3: Discoverable (No UH) ───────────────────────────────────────
  test('Verifier 3 (Discoverable No UH) - discoverable flow, skips userHandle check', async () => {
    client = await createApiClient();
    await client.switchVerifier(3, 'authentication');

    const keyPair = DEFAULT_KEYS.sheldon_es256();
    const optionsRes = await client.getAuthenticationOptions();
    const challenge = optionsRes.options.challenge;

    // userHandle is not required for this verifier since it skips the check,
    // but we still provide it to complete the flow
    const credential = buildAuthenticationResponse({
      keyPair,
      challenge,
      userHandle: b64url(Buffer.from('1')),
      signCount: SHELDON_SIGN_COUNT,
    });

    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
  });

  // ─── ID 4: Non-Discoverable ───────────────────────────────────────────
  test('Verifier 4 (Non-Discoverable) - username-first flow with allowCredentials', async () => {
    client = await createApiClient();
    await client.switchVerifier(4, 'authentication');

    const keyPair = DEFAULT_KEYS.sheldon_es256();
    const optionsRes = await client.getAuthenticationOptions('sheldon');
    const challenge = optionsRes.options.challenge;

    // Non-discoverable flow: server provides allowCredentials list
    expect(optionsRes.options.allowCredentials).toBeDefined();
    expect(optionsRes.options.allowCredentials.length).toBeGreaterThan(0);

    const credential = buildAuthenticationResponse({
      keyPair,
      challenge,
      userHandle: b64url(Buffer.from('1')),
      signCount: SHELDON_SIGN_COUNT,
    });

    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
  });

  // ─── ID 5: Conditional UI ─────────────────────────────────────────────
  test('Verifier 5 (Conditional UI) - discoverable flow with conditional mediation', async () => {
    client = await createApiClient();
    await client.switchVerifier(5, 'authentication');

    // Conditional UI is still a discoverable flow at the API level
    const keyPair = DEFAULT_KEYS.sheldon_es256();
    const optionsRes = await client.getAuthenticationOptions();
    const challenge = optionsRes.options.challenge;

    // Verify the verifier reports conditional UI
    expect(optionsRes.verifier.conditionalUI).toBe(true);

    const credential = buildAuthenticationResponse({
      keyPair,
      challenge,
      userHandle: b64url(Buffer.from('1')),
      signCount: SHELDON_SIGN_COUNT,
    });

    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
  });

  // ─── ID 6: 2FA ────────────────────────────────────────────────────────
  test('Verifier 6 (2FA) - password + passkey second factor', async () => {
    client = await createApiClient();
    await client.switchVerifier(6, 'authentication');

    // Step 1: Login with password (sets passkeyUserId in session, redirects to /login/2fa)
    const loginSuccess = await client.login('sheldon', 'Bazinga73');
    // 2FA verifier redirects to /login/2fa instead of /flags, so login returns true (302)
    expect(loginSuccess).toBe(true);

    // Step 2: Get authentication options (uses passkeyUserId from session)
    const keyPair = DEFAULT_KEYS.sheldon_es256();
    const optionsRes = await client.getAuthenticationOptions();
    const challenge = optionsRes.options.challenge;

    // 2FA flow provides allowCredentials for the logged-in user
    expect(optionsRes.verifier.passkeyFlow).toBe('2fa');

    // Step 3: Build and verify passkey response
    const credential = buildAuthenticationResponse({
      keyPair,
      challenge,
      userHandle: b64url(Buffer.from('1')),
      signCount: SHELDON_SIGN_COUNT,
    });

    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
  });

  // ─── ID 7: 2FA (No UV) ────────────────────────────────────────────────
  test('Verifier 7 (2FA No UV) - 2FA flow with user verification discouraged', async () => {
    client = await createApiClient();
    await client.switchVerifier(7, 'authentication');

    // Step 1: Login with password
    const loginSuccess = await client.login('sheldon', 'Bazinga73');
    expect(loginSuccess).toBe(true);

    // Step 2: Get authentication options
    const keyPair = DEFAULT_KEYS.sheldon_es256();
    const optionsRes = await client.getAuthenticationOptions();
    const challenge = optionsRes.options.challenge;

    // UV should be discouraged for this verifier
    expect(optionsRes.verifier.userVerification).toBe('discouraged');
    expect(optionsRes.verifier.passkeyFlow).toBe('2fa');

    // Step 3: Build passkey response (UV flag can be false since discouraged)
    const credential = buildAuthenticationResponse({
      keyPair,
      challenge,
      userHandle: b64url(Buffer.from('1')),
      signCount: SHELDON_SIGN_COUNT,
      flags: { up: true, uv: false },
    });

    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
  });

  // ─── ID 8: Discoverable (No UV) ───────────────────────────────────────
  test('Verifier 8 (Discoverable No UV) - discoverable flow with UV discouraged', async () => {
    client = await createApiClient();
    await client.switchVerifier(8, 'authentication');

    const keyPair = DEFAULT_KEYS.sheldon_es256();
    const optionsRes = await client.getAuthenticationOptions();
    const challenge = optionsRes.options.challenge;

    // UV should be discouraged for this verifier
    expect(optionsRes.verifier.userVerification).toBe('discouraged');
    expect(optionsRes.verifier.passkeyFlow).toBe('discoverable');

    // Build passkey response with UV flag off since discouraged
    const credential = buildAuthenticationResponse({
      keyPair,
      challenge,
      userHandle: b64url(Buffer.from('1')),
      signCount: SHELDON_SIGN_COUNT,
      flags: { up: true, uv: false },
    });

    const result = await client.verifyAuthentication(credential);
    expect(result.verified).toBe(true);
  });
});
