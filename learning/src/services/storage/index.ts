import { InstanceData } from '../../types/instance';
import { User } from '../../types/user';
import { Flag, Comment, Rating } from '../../types/flag';
import { Passkey } from '../../types/passkey';
import { config } from '../../config';

export interface Storage {
  // Instance operations
  instanceExists(instanceId: string): Promise<boolean>;
  createInstance(instanceId: string): Promise<void>;
  deleteInstance(instanceId: string): Promise<void>;
  resetInstance(instanceId: string): Promise<void>;
  getInstanceData(instanceId: string): Promise<InstanceData | null>;

  // User operations
  getUsers(instanceId: string): Promise<User[]>;
  getUserById(instanceId: string, userId: number): Promise<User | null>;
  getUserByUsername(instanceId: string, username: string): Promise<User | null>;
  createUser(instanceId: string, user: User): Promise<void>;
  updateUser(instanceId: string, user: User): Promise<void>;
  deleteUser(instanceId: string, userId: number): Promise<void>;
  getNextUserId(instanceId: string): Promise<number>;

  // Passkey operations
  getPasskeys(instanceId: string): Promise<Passkey[]>;
  getPasskeyById(instanceId: string, passkeyId: number): Promise<Passkey | null>;
  getPasskeysByUserId(instanceId: string, userId: number): Promise<Passkey[]>;
  getPasskeyByCredentialId(
    instanceId: string,
    credentialId: string
  ): Promise<{ user: User; passkey: Passkey } | null>;
  createPasskey(instanceId: string, passkey: Passkey): Promise<void>;
  updatePasskey(instanceId: string, passkey: Passkey): Promise<void>;
  deletePasskey(instanceId: string, passkeyId: number): Promise<void>;
  getNextPasskeyId(instanceId: string): Promise<number>;

  // Flag operations
  getFlags(instanceId: string): Promise<Flag[]>;
  getFlagById(instanceId: string, flagId: number): Promise<Flag | null>;
  getFlagsByUserId(instanceId: string, userId: number): Promise<Flag[]>;
  createFlag(instanceId: string, flag: Flag): Promise<void>;
  updateFlag(instanceId: string, flag: Flag): Promise<void>;
  deleteFlag(instanceId: string, flagId: number): Promise<void>;
  getNextFlagId(instanceId: string): Promise<number>;

  // Comment operations
  getCommentsByFlagId(instanceId: string, flagId: number): Promise<Comment[]>;
  createComment(instanceId: string, comment: Comment): Promise<void>;
  deleteComment(instanceId: string, commentId: number): Promise<void>;
  getNextCommentId(instanceId: string): Promise<number>;

  // Rating operations
  getRatingsByFlagId(instanceId: string, flagId: number): Promise<Rating[]>;
  getUserRating(instanceId: string, flagId: number, userId: number): Promise<Rating | null>;
  createOrUpdateRating(instanceId: string, rating: Rating): Promise<void>;
  deleteRating(instanceId: string, ratingId: number): Promise<void>;
  getNextRatingId(instanceId: string): Promise<number>;

  // Cleanup operations
  getExpiredInstanceIds(maxAgeMs: number): Promise<string[]>;
}

let storageInstance: Storage | null = null;

export function getStorage(): Storage {
  if (!storageInstance) {
    if (config.useMongoStorage) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MongoStorage } = require('./mongo-storage') as { MongoStorage: new () => Storage };
      storageInstance = new MongoStorage();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { JsonStorage } = require('./json-storage') as { JsonStorage: new () => Storage };
      storageInstance = new JsonStorage();
    }
  }
  return storageInstance;
}

export function setStorage(storage: Storage): void {
  storageInstance = storage;
}
