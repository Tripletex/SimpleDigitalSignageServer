// models/userData.ts
export interface User {
  id: string;
  email: string;
  displayName?: string; // Optional now
  createdAt: Date;
  authenticators?: Authenticator[];
  role: UserRole;
}

export interface Authenticator {
  credentialID: string;
  credentialPublicKey: string;
  counter: number;
  credentialDeviceType: string;
  credentialBackedUp: boolean;
  transports?: string[];
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}

export interface UserRegisterRequest {
  email: string;
  displayName?: string; // Optional
}

export interface AuthenticatedResponse {
  success: boolean;
  message: string;
}