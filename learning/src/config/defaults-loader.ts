import bcrypt from 'bcrypt';
import defaultsJson from '../../data/defaults.json';
import { User } from '../types/user';
import { Passkey } from '../types/passkey';
import { Flag, Comment, Rating } from '../types/flag';
import { InstanceData } from '../types/instance';

// User configuration from environment variables
interface UserEnvConfig {
  username: string;
  envPrefix: string; // e.g., 'SHELDON' for USER_SHELDON_PASSWORD
}

const USER_ENV_MAP: UserEnvConfig[] = [
  { username: 'sheldon', envPrefix: 'SHELDON' },
  { username: 'leonard', envPrefix: 'LEONARD' },
  { username: 'penny', envPrefix: 'PENNY' },
  { username: 'howard', envPrefix: 'HOWARD' },
  { username: 'raj', envPrefix: 'RAJ' },
  { username: 'bernadette', envPrefix: 'BERNADETTE' },
  { username: 'amy', envPrefix: 'AMY' },
];

// Cached effective defaults (computed once at startup)
let cachedDefaults: Omit<InstanceData, 'id' | 'createdAt'> | null = null;

function applyUserOverrides(users: User[]): User[] {
  return users.map((user) => {
    const config = USER_ENV_MAP.find(
      (c) => c.username === user.username.toLowerCase()
    );
    if (!config) return user;

    const updatedUser = { ...user };

    // Override password if env var is set
    const passwordEnv = process.env[`USER_${config.envPrefix}_PASSWORD`];
    if (passwordEnv) {
      updatedUser.passwordHash = bcrypt.hashSync(passwordEnv, 10);
    }

    // Override security question if env var is set
    const questionEnv =
      process.env[`USER_${config.envPrefix}_SECURITY_QUESTION`];
    if (questionEnv) {
      updatedUser.securityQuestion = questionEnv;
    }

    // Override security answer if env var is set
    const answerEnv = process.env[`USER_${config.envPrefix}_SECURITY_ANSWER`];
    if (answerEnv) {
      updatedUser.securityAnswer = answerEnv;
    }

    return updatedUser;
  });
}

function applyPasskeyOverrides(passkeys: Passkey[]): Passkey[] {
  const passkeysJson = process.env.PASSKEY_KEYS;
  if (!passkeysJson) return passkeys;

  try {
    // PASSKEY_KEYS is a base64-encoded JSON array of passkey overrides
    // Only publicKey and credentialId are replaced — metadata (signCount,
    // aaguid, transports, name, etc.) stays identical to defaults.json
    const decoded = Buffer.from(passkeysJson, 'base64').toString('utf-8');
    const overrides = JSON.parse(decoded) as Array<{
      id: number;
      publicKey: string; // base64url-encoded COSE key
      credentialId?: string;
    }>;

    return passkeys.map((passkey) => {
      const override = overrides.find((o) => o.id === passkey.id);
      if (!override) return passkey;

      const updated = { ...passkey };
      if (override.publicKey) {
        updated.publicKey = override.publicKey;
      }
      if (override.credentialId) {
        updated.credentialId = override.credentialId;
      }
      return updated;
    });
  } catch (error) {
    console.error('[Config] Failed to parse PASSKEY_KEYS:', error);
    return passkeys;
  }
}

export function getEffectiveDefaults(): Omit<
  InstanceData,
  'id' | 'createdAt'
> {
  if (cachedDefaults) return cachedDefaults;

  const users = applyUserOverrides(defaultsJson.users as User[]);
  const passkeys = applyPasskeyOverrides(defaultsJson.passkeys as Passkey[]);

  cachedDefaults = {
    users,
    passkeys,
    flags: defaultsJson.flags as Flag[],
    comments: defaultsJson.comments as Comment[],
    ratings: defaultsJson.ratings as Rating[],
  };

  return cachedDefaults;
}

// Reset cache (for testing)
export function resetDefaultsCache(): void {
  cachedDefaults = null;
}
