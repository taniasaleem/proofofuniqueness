export interface TokenHashData {
  serialNumber: string;
  hash: string;
  verified: boolean;
  timestamp: string;
  verificationCount: number;
}

export interface P2PAPI {
  isConnected: boolean;
  registerTokenHash: (serialNumber: string, hash: string) => Promise<void>;
  verifyTokenHash: (serialNumber: string, hash: string) => Promise<void>;
  getTokenHash: (serialNumber: string) => string | undefined;
  getTokenHashData: (serialNumber: string) => TokenHashData | undefined;
} 