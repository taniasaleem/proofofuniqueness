import { blockchainAPI, wsService, TokenHash } from '../websocket';

// Mock the WebSocket implementation at the top using a factory function
jest.mock('ws', () => {
  class MockWebSocket {
    static OPEN = 1;
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: ((error: any) => void) | null = null;
    readyState: number = 1; // OPEN
    send = jest.fn();

    constructor(url: string) {
      setTimeout(() => {
        if (this.onopen) {
          this.onopen();
        }
      }, 0);
    }
  }
  if (typeof window === 'undefined') {
    (global as any).WebSocket = MockWebSocket;
  }
  return { WebSocket: MockWebSocket };
});

describe('WebSocket API Tests', () => {
  // Helper function to simulate WebSocket response
  const simulateResponse = (type: string, data: any) => {
    wsService.simulateMessage(type, data);
  };

  describe('Node Management', () => {
    test('getAllNodes should return list of nodes', async () => {
      const mockNodes = [
        {
          address: '0x123',
          timestamp: Date.now(),
          wallet: { address: '0x123' }
        }
      ];

      const promise = blockchainAPI.getAllNodes();
      simulateResponse('nodes-response', mockNodes);
      
      const result = await promise;
      expect(result).toEqual(mockNodes);
    });

    test('addNode should add new node', async () => {
      const nodeData = {
        address: '0x123',
        privateKey: 'private-key'
      };

      const mockResponse = {
        success: true,
        message: 'Node added successfully'
      };

      const promise = blockchainAPI.addNode(nodeData);
      simulateResponse('node-added', mockResponse);
      
      const result = await promise;
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Chain Operations', () => {
    test('getChainInfo should return chain information', async () => {
      const mockChainInfo = {
        fee: 0.1,
        height: 100,
        latestBlockHash: '0xabc',
        accounts: 50,
        currentSupply: 1000,
        peers: 5
      };

      const promise = blockchainAPI.getChainInfo();
      simulateResponse('chain-info', mockChainInfo);
      
      const result = await promise;
      expect(result).toEqual(mockChainInfo);
    });

    test('getSupplyInfo should return supply information', async () => {
      const mockSupplyInfo = {
        maxSupply: 1000000,
        currentSupply: 500000,
        blockReward: 10,
        nextHalvingBlock: 1000
      };

      const promise = blockchainAPI.getSupplyInfo();
      simulateResponse('supply-info', mockSupplyInfo);
      
      const result = await promise;
      expect(result).toEqual(mockSupplyInfo);
    });
  });

  describe('Transaction Operations', () => {
    test('createTransaction should create new transaction', async () => {
      const transactionData = {
        fromAddress: '0x123',
        toAddress: '0x456',
        amount: 100,
        fee: 0.1,
        privateKey: 'private-key',
        message: 'Test transaction'
      };

      const mockResponse = {
        success: true,
        transaction: {
          hash: '0xabc',
          ...transactionData
        }
      };

      const promise = blockchainAPI.createTransaction(transactionData);
      simulateResponse('transaction-created', mockResponse);
      
      const result = await promise;
      expect(result).toEqual(mockResponse);
    });

    test('getAddressBalance should return balance', async () => {
      const address = '0x123';
      const mockBalance = {
        balance: 1000,
        address
      };

      const promise = blockchainAPI.getAddressBalance(address);
      simulateResponse('balance-response', mockBalance);
      
      const result = await promise;
      expect(result).toEqual(mockBalance);
    });
  });

  describe('Block Operations', () => {
    test('verifyBlockHash should verify block', async () => {
      const hash = '0xabc';
      const mockVerification = {
        hash,
        blockNumber: 100,
        timestamp: Date.now()
      };

      const promise = blockchainAPI.verifyBlockHash(hash);
      simulateResponse('block-verification', mockVerification);
      
      const result = await promise;
      expect(result).toEqual(mockVerification);
    });
  });

  describe('Node Synchronization', () => {
    test('syncWithNodes should sync with peer', async () => {
      const peerUrl = 'ws://peer:8080';
      const mockSyncResponse = {
        message: 'Sync completed successfully',
        success: true
      };

      const promise = blockchainAPI.syncWithNodes(peerUrl);
      simulateResponse('sync-complete', mockSyncResponse);
      
      const result = await promise;
      expect(result).toEqual(mockSyncResponse);
    });
  });

  describe('Token Operations', () => {
    test('generateTokenHash should create a new token hash', async () => {
      const serialNumber = 'TEST-TOKEN-123';
      const mockTokenHash: TokenHash = {
        hash: '0xabc123',
        serialNumber,
        timestamp: Date.now()
      };

      const promise = blockchainAPI.generateTokenHash(serialNumber);
      simulateResponse('token-hash-generated', mockTokenHash);
      
      const result = await promise;
      expect(result).toEqual(mockTokenHash);
    });

    test('getTokenHash should retrieve existing token hash', async () => {
      const serialNumber = 'TEST-TOKEN-123';
      const mockTokenHash: TokenHash = {
        hash: '0xabc123',
        serialNumber,
        timestamp: Date.now()
      };

      const promise = blockchainAPI.getTokenHash(serialNumber);
      simulateResponse('token-hash-response', mockTokenHash);
      
      const result = await promise;
      expect(result).toEqual(mockTokenHash);
    });

    test('verifyToken should verify a valid token', async () => {
      const tokenData = {
        serialNumber: 'TEST-TOKEN-123',
        hash: '0xabc123'
      };

      const mockVerification = {
        isValid: true,
        verifiedBy: ['node1', 'node2']
      };

      const promise = blockchainAPI.verifyToken(tokenData);
      simulateResponse('token-verification', mockVerification);
      
      const result = await promise;
      expect(result).toEqual(mockVerification);
    });

    test('verifyToken should reject an invalid token', async () => {
      const tokenData = {
        serialNumber: 'TEST-TOKEN-123',
        hash: 'invalid-hash'
      };

      const mockVerification = {
        isValid: false,
        verifiedBy: []
      };

      const promise = blockchainAPI.verifyToken(tokenData);
      simulateResponse('token-verification', mockVerification);
      
      const result = await promise;
      expect(result).toEqual(mockVerification);
    });

    test('getTokenHash should handle non-existent token', async () => {
      const nonExistentSerial = 'NON-EXISTENT-TOKEN';
      const promise = blockchainAPI.getTokenHash(nonExistentSerial);
      // Simulate an error response on the correct message type
      simulateResponse('token-hash-response', { error: 'Token not found' });
      await expect(promise).rejects.toThrow('Token not found');
    });
  });

  describe('Error Handling', () => {
    test('should handle connection errors', async () => {
      wsService.setReadyState(3); // WebSocket.CLOSED
      
      const promise = blockchainAPI.getAllNodes();
      
      // Should reject after timeout
      await expect(promise).rejects.toThrow('WebSocket is not connected');
    }, 10000); // Increase timeout to 10 seconds

    test('should handle invalid responses', async () => {
      const promise = blockchainAPI.getAllNodes();
      simulateResponse('invalid-response', { error: 'Invalid response' });
      
      // Should reject after timeout
      await expect(promise).rejects.toThrow('WebSocket is not connected');
    }, 10000); // Increase timeout to 10 seconds
  });
}); 