export interface Passkey {
  id: number;
  userId: number;
  credentialId: string;
  publicKey: string;
  signCount: number;
  algorithm: number;
  transports?: AuthenticatorTransport[];
  aaguid: string;
  backupEligible: boolean;
  backupState: boolean;
  uvInitialized: boolean;
  createdAt: string;
  name?: string;
}

export type AuthenticatorTransport = 'ble' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';
