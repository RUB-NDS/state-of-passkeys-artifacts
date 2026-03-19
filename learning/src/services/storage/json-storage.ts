import fs from 'fs';
import path from 'path';
import { Storage } from './index';
import { InstanceData } from '../../types/instance';
import { User } from '../../types/user';
import { Passkey } from '../../types/passkey';
import { Flag, Comment, Rating } from '../../types/flag';
import { getEffectiveDefaults } from '../../config/defaults-loader';

const DATA_DIR = path.join(__dirname, '../../../data/instances');

export class JsonStorage implements Storage {
  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private getFilePath(instanceId: string): string {
    return path.join(DATA_DIR, `${instanceId}.json`);
  }

  private async readInstance(instanceId: string): Promise<InstanceData | null> {
    const filePath = this.getFilePath(instanceId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as InstanceData;
  }

  private async writeInstance(instanceId: string, data: InstanceData): Promise<void> {
    const filePath = this.getFilePath(instanceId);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  private getDefaults(): Omit<InstanceData, 'id' | 'createdAt'> {
    return getEffectiveDefaults();
  }

  // Instance operations
  async instanceExists(instanceId: string): Promise<boolean> {
    return fs.existsSync(this.getFilePath(instanceId));
  }

  async createInstance(instanceId: string): Promise<void> {
    const defaults = this.getDefaults();
    const data: InstanceData = {
      id: instanceId,
      createdAt: new Date().toISOString(),
      ...defaults,
    };
    await this.writeInstance(instanceId, data);
  }

  async deleteInstance(instanceId: string): Promise<void> {
    const filePath = this.getFilePath(instanceId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async resetInstance(instanceId: string): Promise<void> {
    await this.deleteInstance(instanceId);
    await this.createInstance(instanceId);
  }

  async getInstanceData(instanceId: string): Promise<InstanceData | null> {
    return this.readInstance(instanceId);
  }

  // User operations
  async getUsers(instanceId: string): Promise<User[]> {
    const data = await this.readInstance(instanceId);
    return data?.users || [];
  }

  async getUserById(instanceId: string, userId: number): Promise<User | null> {
    const users = await this.getUsers(instanceId);
    return users.find((u) => u.id === userId) || null;
  }

  async getUserByUsername(instanceId: string, username: string): Promise<User | null> {
    const users = await this.getUsers(instanceId);
    return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  async createUser(instanceId: string, user: User): Promise<void> {
    const data = await this.readInstance(instanceId);
    if (!data) throw new Error('Instance not found');
    data.users.push(user);
    await this.writeInstance(instanceId, data);
  }

  async updateUser(instanceId: string, user: User): Promise<void> {
    const data = await this.readInstance(instanceId);
    if (!data) throw new Error('Instance not found');
    const index = data.users.findIndex((u) => u.id === user.id);
    if (index === -1) throw new Error('User not found');
    data.users[index] = user;
    await this.writeInstance(instanceId, data);
  }

  async deleteUser(instanceId: string, userId: number): Promise<void> {
    const data = await this.readInstance(instanceId);
    if (!data) throw new Error('Instance not found');
    data.users = data.users.filter((u) => u.id !== userId);
    // Also delete associated passkeys
    data.passkeys = data.passkeys.filter((p) => p.userId !== userId);
    await this.writeInstance(instanceId, data);
  }

  async getNextUserId(instanceId: string): Promise<number> {
    const users = await this.getUsers(instanceId);
    if (users.length === 0) return 1;
    return Math.max(...users.map((u) => u.id)) + 1;
  }

  // Passkey operations
  async getPasskeys(instanceId: string): Promise<Passkey[]> {
    const data = await this.readInstance(instanceId);
    return data?.passkeys || [];
  }

  async getPasskeyById(instanceId: string, passkeyId: number): Promise<Passkey | null> {
    const passkeys = await this.getPasskeys(instanceId);
    return passkeys.find((p) => p.id === passkeyId) || null;
  }

  async getPasskeysByUserId(instanceId: string, userId: number): Promise<Passkey[]> {
    const passkeys = await this.getPasskeys(instanceId);
    return passkeys.filter((p) => p.userId === userId);
  }

  async getPasskeyByCredentialId(
    instanceId: string,
    credentialId: string
  ): Promise<{ user: User; passkey: Passkey } | null> {
    const passkeys = await this.getPasskeys(instanceId);
    // Get the last matching credential (most recently added)
    // This matters for credential overwrite attacks where a newer credential
    // with the same ID should take precedence
    const matching = passkeys.filter((p) => p.credentialId === credentialId);
    const passkey = matching.length > 0 ? matching[matching.length - 1] : null;
    if (!passkey) return null;

    const user = await this.getUserById(instanceId, passkey.userId);
    if (!user) return null;

    return { user, passkey };
  }

  async createPasskey(instanceId: string, passkey: Passkey): Promise<void> {
    const data = await this.readInstance(instanceId);
    if (!data) throw new Error('Instance not found');
    data.passkeys.push(passkey);
    await this.writeInstance(instanceId, data);
  }

  async updatePasskey(instanceId: string, passkey: Passkey): Promise<void> {
    const data = await this.readInstance(instanceId);
    if (!data) throw new Error('Instance not found');
    const index = data.passkeys.findIndex((p) => p.id === passkey.id);
    if (index === -1) throw new Error('Passkey not found');
    data.passkeys[index] = passkey;
    await this.writeInstance(instanceId, data);
  }

  async deletePasskey(instanceId: string, passkeyId: number): Promise<void> {
    const data = await this.readInstance(instanceId);
    if (!data) throw new Error('Instance not found');
    data.passkeys = data.passkeys.filter((p) => p.id !== passkeyId);
    await this.writeInstance(instanceId, data);
  }

  async getNextPasskeyId(instanceId: string): Promise<number> {
    const passkeys = await this.getPasskeys(instanceId);
    if (passkeys.length === 0) return 1;
    return Math.max(...passkeys.map((p) => p.id)) + 1;
  }

  // Flag operations
  async getFlags(instanceId: string): Promise<Flag[]> {
    const data = await this.readInstance(instanceId);
    return data?.flags || [];
  }

  async getFlagById(instanceId: string, flagId: number): Promise<Flag | null> {
    const flags = await this.getFlags(instanceId);
    return flags.find((f) => f.id === flagId) || null;
  }

  async getFlagsByUserId(instanceId: string, userId: number): Promise<Flag[]> {
    const flags = await this.getFlags(instanceId);
    return flags.filter((f) => f.userId === userId);
  }

  async createFlag(instanceId: string, flag: Flag): Promise<void> {
    const data = await this.readInstance(instanceId);
    if (!data) throw new Error('Instance not found');
    data.flags.push(flag);
    await this.writeInstance(instanceId, data);
  }

  async updateFlag(instanceId: string, flag: Flag): Promise<void> {
    const data = await this.readInstance(instanceId);
    if (!data) throw new Error('Instance not found');
    const index = data.flags.findIndex((f) => f.id === flag.id);
    if (index === -1) throw new Error('Flag not found');
    data.flags[index] = flag;
    await this.writeInstance(instanceId, data);
  }

  async deleteFlag(instanceId: string, flagId: number): Promise<void> {
    const data = await this.readInstance(instanceId);
    if (!data) throw new Error('Instance not found');
    data.flags = data.flags.filter((f) => f.id !== flagId);
    // Also delete associated comments and ratings
    data.comments = data.comments.filter((c) => c.flagId !== flagId);
    data.ratings = data.ratings.filter((r) => r.flagId !== flagId);
    await this.writeInstance(instanceId, data);
  }

  async getNextFlagId(instanceId: string): Promise<number> {
    const flags = await this.getFlags(instanceId);
    if (flags.length === 0) return 1;
    return Math.max(...flags.map((f) => f.id)) + 1;
  }

  // Comment operations
  async getCommentsByFlagId(instanceId: string, flagId: number): Promise<Comment[]> {
    const data = await this.readInstance(instanceId);
    return data?.comments.filter((c) => c.flagId === flagId) || [];
  }

  async createComment(instanceId: string, comment: Comment): Promise<void> {
    const data = await this.readInstance(instanceId);
    if (!data) throw new Error('Instance not found');
    data.comments.push(comment);
    await this.writeInstance(instanceId, data);
  }

  async deleteComment(instanceId: string, commentId: number): Promise<void> {
    const data = await this.readInstance(instanceId);
    if (!data) throw new Error('Instance not found');
    data.comments = data.comments.filter((c) => c.id !== commentId);
    await this.writeInstance(instanceId, data);
  }

  async getNextCommentId(instanceId: string): Promise<number> {
    const data = await this.readInstance(instanceId);
    const comments = data?.comments || [];
    if (comments.length === 0) return 1;
    return Math.max(...comments.map((c) => c.id)) + 1;
  }

  // Rating operations
  async getRatingsByFlagId(instanceId: string, flagId: number): Promise<Rating[]> {
    const data = await this.readInstance(instanceId);
    return data?.ratings.filter((r) => r.flagId === flagId) || [];
  }

  async getUserRating(instanceId: string, flagId: number, userId: number): Promise<Rating | null> {
    const data = await this.readInstance(instanceId);
    return data?.ratings.find((r) => r.flagId === flagId && r.userId === userId) || null;
  }

  async createOrUpdateRating(instanceId: string, rating: Rating): Promise<void> {
    const data = await this.readInstance(instanceId);
    if (!data) throw new Error('Instance not found');

    const existingIndex = data.ratings.findIndex(
      (r) => r.flagId === rating.flagId && r.userId === rating.userId
    );

    if (existingIndex !== -1) {
      data.ratings[existingIndex] = rating;
    } else {
      data.ratings.push(rating);
    }

    await this.writeInstance(instanceId, data);
  }

  async deleteRating(instanceId: string, ratingId: number): Promise<void> {
    const data = await this.readInstance(instanceId);
    if (!data) throw new Error('Instance not found');
    data.ratings = data.ratings.filter((r) => r.id !== ratingId);
    await this.writeInstance(instanceId, data);
  }

  async getNextRatingId(instanceId: string): Promise<number> {
    const data = await this.readInstance(instanceId);
    const ratings = data?.ratings || [];
    if (ratings.length === 0) return 1;
    return Math.max(...ratings.map((r) => r.id)) + 1;
  }

  // Cleanup operations
  async getExpiredInstanceIds(maxAgeMs: number): Promise<string[]> {
    const cutoffTime = Date.now() - maxAgeMs;
    const expiredIds: string[] = [];

    if (!fs.existsSync(DATA_DIR)) {
      return expiredIds;
    }

    const files = fs.readdirSync(DATA_DIR);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const instanceId = file.replace('.json', '');
      const filePath = this.getFilePath(instanceId);

      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const instance = JSON.parse(data) as InstanceData;
        const createdAt = new Date(instance.createdAt).getTime();

        if (createdAt < cutoffTime) {
          expiredIds.push(instanceId);
        }
      } catch (error) {
        console.error(`[Cleanup] Error reading instance ${instanceId}:`, error);
      }
    }

    return expiredIds;
  }
}
