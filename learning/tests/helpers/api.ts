/**
 * API client helper for Playwright tests.
 * Manages sessions, cookies, and provides typed API methods.
 */

import { APIRequestContext, request } from '@playwright/test';

export interface ApiClient {
  ctx: APIRequestContext;
  instanceId: string;
  sessionCookie: string;
  dispose: () => Promise<void>;

  // Auth
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, securityQuestion?: string, securityAnswer?: string) => Promise<boolean>;
  logout: () => Promise<void>;

  // Verifiers
  switchVerifier: (verifierId: number, target: 'authentication' | 'registration') => Promise<void>;

  // Passkey Registration
  getRegistrationOptions: () => Promise<any>;
  verifyRegistration: (credential: any, name?: string) => Promise<any>;

  // Passkey Authentication
  getAuthenticationOptions: (username?: string) => Promise<any>;
  verifyAuthentication: (credential: any) => Promise<any>;

  // Instance
  resetInstance: () => Promise<void>;
  deleteInstance: () => Promise<void>;

  // Raw request
  post: (url: string, data?: any) => Promise<any>;
  get: (url: string) => Promise<any>;
}

export async function createApiClient(
  baseURL = 'http://localhost:3000'
): Promise<ApiClient> {
  const ctx = await request.newContext({
    baseURL,
  });

  // Create a new instance by visiting the site
  const initResponse = await ctx.get('/login');
  const cookies = (await ctx.storageState()).cookies;
  const instanceCookie = cookies.find((c) => c.name === 'instanceId');
  const instanceId = instanceCookie?.value || '';
  const connectSid = cookies.find((c) => c.name === 'connect.sid');
  const sessionCookie = connectSid?.value || '';

  const client: ApiClient = {
    ctx,
    instanceId,
    sessionCookie,

    dispose: async () => {
      // Delete instance to clean up
      try {
        await ctx.post('/instance/delete');
      } catch { /* ignore */ }
      await ctx.dispose();
    },

    login: async (username: string, password: string) => {
      const response = await ctx.post('/login', {
        form: { username, password },
        maxRedirects: 0,
      });
      // 302 redirect means success
      return response.status() === 302;
    },

    register: async (
      username: string,
      password: string,
      securityQuestion?: string,
      securityAnswer?: string
    ) => {
      const form: Record<string, string> = {
        username,
        password,
        confirmPassword: password,
      };
      if (securityQuestion) form.securityQuestion = securityQuestion;
      if (securityAnswer) form.securityAnswer = securityAnswer;

      const response = await ctx.post('/register', {
        form,
        maxRedirects: 0,
      });
      return response.status() === 302;
    },

    logout: async () => {
      await ctx.post('/logout');
    },

    switchVerifier: async (
      verifierId: number,
      target: 'authentication' | 'registration'
    ) => {
      const response = await ctx.post('/verifiers/api/switch', {
        data: { verifierId, target },
      });
      if (!response.ok()) {
        throw new Error(
          `Failed to switch verifier: ${response.status()} ${await response.text()}`
        );
      }
    },

    getRegistrationOptions: async () => {
      const response = await ctx.post('/api/passkey/registration/options');
      if (!response.ok()) {
        throw new Error(
          `Failed to get registration options: ${response.status()} ${await response.text()}`
        );
      }
      return response.json();
    },

    verifyRegistration: async (credential: any, name?: string) => {
      const response = await ctx.post('/api/passkey/registration/verify', {
        data: { credential, name: name || 'Test Passkey' },
      });
      return response.json();
    },

    getAuthenticationOptions: async (username?: string) => {
      const data: any = {};
      if (username) data.username = username;
      const response = await ctx.post('/api/passkey/authentication/options', {
        data,
      });
      if (!response.ok()) {
        throw new Error(
          `Failed to get auth options: ${response.status()} ${await response.text()}`
        );
      }
      return response.json();
    },

    verifyAuthentication: async (credential: any) => {
      const response = await ctx.post('/api/passkey/authentication/verify', {
        data: { credential },
      });
      return response.json();
    },

    resetInstance: async () => {
      await ctx.post('/instance/reset');
    },

    deleteInstance: async () => {
      await ctx.post('/instance/delete');
    },

    post: async (url: string, data?: any) => {
      const response = await ctx.post(url, { data });
      return response;
    },

    get: async (url: string) => {
      const response = await ctx.get(url);
      return response;
    },
  };

  return client;
}
