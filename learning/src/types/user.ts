export interface User {
  id: number;
  username: string;
  passwordHash: string;
  createdAt: string;
  securityQuestion?: string;
  securityAnswer?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}
