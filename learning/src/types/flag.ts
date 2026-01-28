export interface Flag {
  id: number;
  userId: number;
  title: string;
  description: string;
  imageUrl: string;
  country: string;
  createdAt: string;
}

// Reward flags are separate from regular flags - only shown when challenges are solved
export interface RewardFlag {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  country: string;
}

// Embedded reward flag in verifiers (no id needed)
export interface VerifierRewardFlag {
  country: string;
  title: string;
  description: string;
  imageUrl: string;
}

export interface FlagReward {
  flagId: number;
  title: string;
  country: string;
  imageUrl: string;
  description: string;
  message: string;
}

export interface Comment {
  id: number;
  flagId: number;
  userId: number;
  content: string;
  createdAt: string;
}

export interface Rating {
  id: number;
  flagId: number;
  userId: number;
  value: number; // 1-5
  createdAt: string;
}

export interface FlagWithDetails extends Flag {
  user: {
    id: number;
    username: string;
  };
  comments: CommentWithUser[];
  ratings: Rating[];
  averageRating: number;
  userRating?: number;
}

export interface CommentWithUser extends Comment {
  user: {
    id: number;
    username: string;
  };
}

export interface CreateFlagInput {
  title: string;
  description: string;
  imageUrl: string;
  country: string;
}
