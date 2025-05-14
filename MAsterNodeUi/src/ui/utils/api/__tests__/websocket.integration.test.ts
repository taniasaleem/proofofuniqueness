import { blockchainAPI, TokenHash } from '../websocket';

describe('WebSocket Integration Tests', () => {
  let generatedToken: TokenHash;

  beforeAll(async () => {
    // Wait for WebSocket connection to be established
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Token Operations', () => {
    test('generateTokenHash should create a new token hash', async () => {
      const serialNumber = 'TEST-123';
      generatedToken = await blockchainAPI.generateTokenHash(serialNumber);
      
      expect(generatedToken).toBeDefined();
      expect(generatedToken.serialNumber).toBe(serialNumber);
      expect(generatedToken.hash).toBeDefined();
      expect(generatedToken.timestamp).toBeDefined();
    }, 15000); // Increased timeout

    test('getTokenHash should retrieve existing token hash', async () => {
      expect(generatedToken).toBeDefined();
      const retrievedToken = await blockchainAPI.getTokenHash(generatedToken.serialNumber) as TokenHash;
      
      expect(retrievedToken).toBeDefined();
      expect(retrievedToken.serialNumber).toBe(generatedToken.serialNumber);
      expect(retrievedToken.hash).toBe(generatedToken.hash);
    });

    test('verifyToken should verify a valid token', async () => {
      expect(generatedToken).toBeDefined();
      const result = await blockchainAPI.verifyToken(generatedToken.serialNumber, generatedToken.hash);
      
      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
    });

    test('verifyToken should reject an invalid token', async () => {
      expect(generatedToken).toBeDefined();
      const result = await blockchainAPI.verifyToken(generatedToken.serialNumber, 'invalid-hash');
      
      expect(result).toBeDefined();
      expect(result.isValid).toBe(false);
    });

    test('getTokenHash should return undefined for non-existent token', async () => {
      const result = await blockchainAPI.getTokenHash('NON-EXISTENT');
      expect(result).toBeUndefined();
    });
  });
}); 