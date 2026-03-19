import { test, expect } from '@playwright/test';
import { createApiClient, ApiClient } from './helpers/api';

const BASE_URL = 'http://localhost:3000';

// Default users from .env
const DEFAULT_USERS = {
  sheldon: 'Bazinga73',
  leonard: 'Physicist4Ever',
  penny: 'CheesecakeFactory',
  howard: 'Astronaut2012',
  raj: 'CinnamonDog',
  bernadette: 'HalleyAndNeil',
  amy: 'Shamy4Life',
};

const DEFAULT_USER_COUNT = 7;
const DEFAULT_FLAG_COUNT = 42;

test.describe('Authentication', () => {
  let client: ApiClient;

  test.afterEach(async () => {
    if (client) {
      await client.dispose();
    }
  });

  test('login with correct password succeeds', async () => {
    client = await createApiClient(BASE_URL);
    const result = await client.login('sheldon', DEFAULT_USERS.sheldon);
    expect(result).toBe(true);
  });

  test('login with wrong password fails', async () => {
    client = await createApiClient(BASE_URL);
    const result = await client.login('sheldon', 'WrongPassword123');
    expect(result).toBe(false);
  });

  test('login with non-existent user fails', async () => {
    client = await createApiClient(BASE_URL);
    const result = await client.login('nonexistentuser', 'SomePassword');
    expect(result).toBe(false);
  });

  test('login works for each default user', async () => {
    client = await createApiClient(BASE_URL);
    for (const [username, password] of Object.entries(DEFAULT_USERS)) {
      // Reset session between logins by logging out
      const result = await client.login(username, password);
      expect(result).toBe(true);
      await client.logout();
    }
  });
});

test.describe('Registration', () => {
  let client: ApiClient;

  test.afterEach(async () => {
    if (client) {
      await client.dispose();
    }
  });

  test('register a new user succeeds', async () => {
    client = await createApiClient(BASE_URL);
    const uniqueUser = `testuser_${Date.now()}`;
    const result = await client.register(uniqueUser, 'TestPass123');
    expect(result).toBe(true);

    // Verify we can log out and log back in with the new user
    await client.logout();
    const loginResult = await client.login(uniqueUser, 'TestPass123');
    expect(loginResult).toBe(true);
  });

  test('register with security question and answer', async () => {
    client = await createApiClient(BASE_URL);
    const uniqueUser = `secuser_${Date.now()}`;
    const result = await client.register(
      uniqueUser,
      'SecurePass456',
      'What is your favorite color?',
      'Blue'
    );
    expect(result).toBe(true);
  });

  test('register with duplicate username fails', async () => {
    client = await createApiClient(BASE_URL);
    // 'sheldon' is a default user that already exists
    const result = await client.register('sheldon', 'AnotherPassword1');
    expect(result).toBe(false);
  });

  test('register with duplicate custom username fails', async () => {
    client = await createApiClient(BASE_URL);
    const uniqueUser = `dupuser_${Date.now()}`;

    // First registration should succeed
    const first = await client.register(uniqueUser, 'FirstPass123');
    expect(first).toBe(true);

    // Log out so we can register again
    await client.logout();

    // Second registration with same username should fail
    const second = await client.register(uniqueUser, 'SecondPass456');
    expect(second).toBe(false);
  });
});

test.describe('Logout', () => {
  let client: ApiClient;

  test.afterEach(async () => {
    if (client) {
      await client.dispose();
    }
  });

  test('logout after login redirects to login page', async () => {
    client = await createApiClient(BASE_URL);

    // Login first
    const loginResult = await client.login('penny', DEFAULT_USERS.penny);
    expect(loginResult).toBe(true);

    // Logout
    await client.logout();

    // Verify we are logged out by trying to access a protected page
    // Creating a flag requires auth - should redirect to login
    const response = await client.ctx.get('/flags/new', { maxRedirects: 0 });
    expect(response.status()).toBe(302);
  });

  test('logout without login does not error', async () => {
    client = await createApiClient(BASE_URL);
    // Logging out without being logged in - should not throw
    // The POST /logout requires auth and will redirect, but GET /logout works
    const response = await client.ctx.get('/logout', { maxRedirects: 0 });
    expect(response.status()).toBe(302);
  });
});

test.describe('Instance Management', () => {
  let client: ApiClient;

  test.afterEach(async () => {
    if (client) {
      await client.dispose();
    }
  });

  test('instance reset restores default users', async () => {
    client = await createApiClient(BASE_URL);

    // Register a new user to change instance state
    const newUser = `resettest_${Date.now()}`;
    const regResult = await client.register(newUser, 'ResetPass123');
    expect(regResult).toBe(true);
    await client.logout();

    // Verify the new user can login (exists)
    const loginBefore = await client.login(newUser, 'ResetPass123');
    expect(loginBefore).toBe(true);
    await client.logout();

    // Reset the instance via the API
    const resetResponse = await client.ctx.post('/api/instance/reset');
    expect(resetResponse.ok()).toBe(true);
    const resetBody = await resetResponse.json();
    expect(resetBody.success).toBe(true);

    // After reset, the new user should no longer exist
    // Need to re-fetch cookies since session was destroyed
    const loginAfter = await client.login(newUser, 'ResetPass123');
    expect(loginAfter).toBe(false);

    // Default users should still work
    const defaultLogin = await client.login('sheldon', DEFAULT_USERS.sheldon);
    expect(defaultLogin).toBe(true);
  });

  test('instance reset restores default flag count', async () => {
    client = await createApiClient(BASE_URL);

    // Login and create a flag to change the state
    await client.login('sheldon', DEFAULT_USERS.sheldon);
    const createResponse = await client.ctx.post('/flags', {
      form: {
        title: 'Test Flag for Reset',
        description: 'This flag should be removed after reset',
        imageUrl: 'https://flagcdn.com/w320/us.png',
        country: 'TestCountry',
      },
      maxRedirects: 0,
    });
    expect(createResponse.status()).toBe(302);
    await client.logout();

    // Get instance info before reset
    const infoBefore = await client.ctx.get('/api/instance');
    const dataBefore = await infoBefore.json();
    expect(dataBefore.flagCount).toBeGreaterThan(DEFAULT_FLAG_COUNT);

    // Reset
    await client.ctx.post('/api/instance/reset');

    // Get instance info after reset
    const infoAfter = await client.ctx.get('/api/instance');
    const dataAfter = await infoAfter.json();
    expect(dataAfter.flagCount).toBe(DEFAULT_FLAG_COUNT);
    expect(dataAfter.userCount).toBe(DEFAULT_USER_COUNT);
  });

  test('create new instance returns fresh instance', async () => {
    client = await createApiClient(BASE_URL);
    const originalInstanceId = client.instanceId;

    // Create a new instance
    const newResponse = await client.ctx.post('/api/instance/new');
    expect(newResponse.ok()).toBe(true);
    const newBody = await newResponse.json();
    expect(newBody.success).toBe(true);
    expect(newBody.instanceId).toBeTruthy();
    expect(newBody.instanceId).not.toBe(originalInstanceId);

    // The new instance should have defaults
    const infoResponse = await client.ctx.get('/api/instance');
    const info = await infoResponse.json();
    expect(info.userCount).toBe(DEFAULT_USER_COUNT);
    expect(info.flagCount).toBe(DEFAULT_FLAG_COUNT);
  });

  test('delete instance creates a replacement', async () => {
    client = await createApiClient(BASE_URL);

    // Get the current instance ID from the instance API
    const infoResponse = await client.ctx.get('/api/instance');
    const info = await infoResponse.json();
    const originalInstanceId = info.id;
    expect(originalInstanceId).toBeTruthy();

    // Delete the instance via DELETE /api/instance
    const deleteResponse = await client.ctx.delete('/api/instance');
    expect(deleteResponse.ok()).toBe(true);
    const deleteBody = await deleteResponse.json();
    expect(deleteBody.success).toBe(true);
    expect(deleteBody.oldInstanceId).toBe(originalInstanceId);
    expect(deleteBody.newInstanceId).toBeTruthy();
    expect(deleteBody.newInstanceId).not.toBe(originalInstanceId);
  });
});

test.describe('Verifier Switching', () => {
  let client: ApiClient;

  test.afterEach(async () => {
    if (client) {
      await client.dispose();
    }
  });

  test('switch authentication verifier', async () => {
    client = await createApiClient(BASE_URL);

    // Switch to authentication verifier ID 1 (first demo verifier)
    await client.switchVerifier(1, 'authentication');

    // Verify via the verifiers list API
    const listResponse = await client.ctx.get('/verifiers/api/list');
    const listData = await listResponse.json();
    expect(listData.currentAuthVerifier).toBe(1);
  });

  test('switch registration verifier', async () => {
    client = await createApiClient(BASE_URL);

    // Switch to registration verifier ID 29 (a registration demo verifier)
    await client.switchVerifier(29, 'registration');

    // Verify via the verifiers list API
    const listResponse = await client.ctx.get('/verifiers/api/list');
    const listData = await listResponse.json();
    expect(listData.currentRegVerifier).toBe(29);
  });

  test('switch both authentication and registration verifiers', async () => {
    client = await createApiClient(BASE_URL);

    await client.switchVerifier(3, 'authentication');
    await client.switchVerifier(30, 'registration');

    const listResponse = await client.ctx.get('/verifiers/api/list');
    const listData = await listResponse.json();
    expect(listData.currentAuthVerifier).toBe(3);
    expect(listData.currentRegVerifier).toBe(30);
  });

  test('switch to invalid verifier target fails', async () => {
    client = await createApiClient(BASE_URL);

    // Verifier 1 is an authentication verifier, switching it as registration should fail
    const response = await client.ctx.post('/verifiers/api/switch', {
      data: { verifierId: 1, target: 'registration' },
    });
    expect(response.ok()).toBe(false);
    expect(response.status()).toBe(400);
  });

  test('switch to non-existent verifier fails', async () => {
    client = await createApiClient(BASE_URL);

    const response = await client.ctx.post('/verifiers/api/switch', {
      data: { verifierId: 9999, target: 'authentication' },
    });
    expect(response.ok()).toBe(false);
    expect(response.status()).toBe(404);
  });
});

test.describe('Flag Creation', () => {
  let client: ApiClient;

  test.afterEach(async () => {
    if (client) {
      await client.dispose();
    }
  });

  test('create a flag with valid data succeeds', async () => {
    client = await createApiClient(BASE_URL);

    // Must be logged in to create flags
    await client.login('sheldon', DEFAULT_USERS.sheldon);

    const flagData = {
      title: 'Flag of Antarctica',
      description: 'A proposed flag for the Antarctic continent featuring a white continent on a blue background.',
      imageUrl: 'https://flagcdn.com/w320/aq.png',
      country: 'Antarctica',
    };

    const response = await client.ctx.post('/flags', {
      form: flagData,
      maxRedirects: 0,
    });

    // Successful creation redirects to the new flag page
    expect(response.status()).toBe(302);
    const location = response.headers()['location'];
    expect(location).toMatch(/\/flags\/\d+/);
  });

  test('create a flag without authentication fails', async () => {
    client = await createApiClient(BASE_URL);

    const flagData = {
      title: 'Unauthorized Flag',
      description: 'This should not be created',
      imageUrl: 'https://flagcdn.com/w320/xx.png',
      country: 'Nowhere',
    };

    const response = await client.ctx.post('/flags', {
      form: flagData,
      maxRedirects: 0,
    });

    // Should redirect to login page (302) since not authenticated
    expect(response.status()).toBe(302);
    const location = response.headers()['location'];
    expect(location).toContain('/login');
  });

  test('create a flag with missing fields shows error', async () => {
    client = await createApiClient(BASE_URL);
    await client.login('leonard', DEFAULT_USERS.leonard);

    // Submit with missing description
    const response = await client.ctx.post('/flags', {
      form: {
        title: 'Incomplete Flag',
        description: '',
        imageUrl: 'https://flagcdn.com/w320/us.png',
        country: 'TestCountry',
      },
      maxRedirects: 0,
    });

    // Should return 200 with the form re-rendered (not a redirect)
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('All fields are required');
  });

  test('created flag appears in flag list', async () => {
    client = await createApiClient(BASE_URL);
    await client.login('penny', DEFAULT_USERS.penny);

    const uniqueTitle = `Penny Flag ${Date.now()}`;
    const createResponse = await client.ctx.post('/flags', {
      form: {
        title: uniqueTitle,
        description: 'A flag created by Penny for testing.',
        imageUrl: 'https://flagcdn.com/w320/gb.png',
        country: 'United Kingdom',
      },
      maxRedirects: 0,
    });
    expect(createResponse.status()).toBe(302);

    // Fetch the flags list and verify our new flag is there
    const listResponse = await client.ctx.get('/flags');
    const listBody = await listResponse.text();
    expect(listBody).toContain(uniqueTitle);
  });
});

test.describe('Flag Viewing', () => {
  let client: ApiClient;

  test.afterEach(async () => {
    if (client) {
      await client.dispose();
    }
  });

  test('view flag list returns default flags', async () => {
    client = await createApiClient(BASE_URL);

    const response = await client.ctx.get('/flags');
    expect(response.ok()).toBe(true);
    const body = await response.text();

    // Check for known default flag titles
    expect(body).toContain('Flag of Nepal');
    expect(body).toContain('Flag of Switzerland');
    expect(body).toContain('Flag of Japan');
  });

  test('view individual flag by id', async () => {
    client = await createApiClient(BASE_URL);

    // Flag ID 1 is "Flag of Nepal" in defaults
    const response = await client.ctx.get('/flags/1');
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toContain('Flag of Nepal');
    expect(body).toContain('Nepal');
  });

  test('view non-existent flag returns 404', async () => {
    client = await createApiClient(BASE_URL);

    const response = await client.ctx.get('/flags/99999');
    expect(response.status()).toBe(404);
  });

  test('view flag with invalid id returns 404', async () => {
    client = await createApiClient(BASE_URL);

    const response = await client.ctx.get('/flags/notanumber');
    expect(response.status()).toBe(404);
  });

  test('view a newly created flag shows correct details', async () => {
    client = await createApiClient(BASE_URL);
    await client.login('raj', DEFAULT_USERS.raj);

    const flagData = {
      title: `Raj Special Flag ${Date.now()}`,
      description: 'An elaborate flag designed by Raj for testing purposes.',
      imageUrl: 'https://flagcdn.com/w320/in.png',
      country: 'India',
    };

    const createResponse = await client.ctx.post('/flags', {
      form: flagData,
      maxRedirects: 0,
    });
    expect(createResponse.status()).toBe(302);

    // Extract the flag ID from the redirect location
    const location = createResponse.headers()['location'];
    const flagId = location.split('/').pop();

    // View the created flag
    const viewResponse = await client.ctx.get(`/flags/${flagId}`);
    expect(viewResponse.ok()).toBe(true);
    const body = await viewResponse.text();
    expect(body).toContain(flagData.title);
    expect(body).toContain(flagData.description);
    expect(body).toContain(flagData.country);
  });

  test('flag list is accessible without authentication', async () => {
    client = await createApiClient(BASE_URL);

    // Not logged in - should still be able to view flags
    const response = await client.ctx.get('/flags');
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toContain('Fun with Flags and Passkeys');
  });

  test('individual flag is accessible without authentication', async () => {
    client = await createApiClient(BASE_URL);

    const response = await client.ctx.get('/flags/2');
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toContain('Flag of Switzerland');
  });
});
