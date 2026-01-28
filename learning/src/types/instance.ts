import { User } from './user';
import { Passkey } from './passkey';
import { Flag, Comment, Rating } from './flag';

export interface InstanceData {
  id: string;
  createdAt: string;
  users: User[];
  passkeys: Passkey[];
  flags: Flag[];
  comments: Comment[];
  ratings: Rating[];
}

export interface InstanceInfo {
  id: string;
  createdAt: string;
  userCount: number;
  flagCount: number;
  commentCount: number;
  ratingCount: number;
}
