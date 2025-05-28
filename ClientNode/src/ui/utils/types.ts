export interface Token {
  serialNumber: string;
  hash: string;
  createdAt: string;
  status: 'active' | 'inactive' | 'pending';
} 