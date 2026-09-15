export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  authenticatorCount: number;
}

export interface Passkey {
  id: string;
  name?: string;
  createdAt: string;
  lastUsed?: string;
}