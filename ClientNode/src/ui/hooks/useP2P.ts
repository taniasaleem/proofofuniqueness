import { useState, useEffect, useCallback, useRef } from 'react';
import { P2PAPI, TokenHashData } from '../types';
import { P2P_MESSAGE_TYPES } from '../utils/api/config';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (channel: string, func: (...args: any[]) => void) => void;
        invoke: (channel: string, ...args: any[]) => Promise<any>;
      };
    };
  }
}

export const useP2P = (): P2PAPI => {
  const [isConnected, setIsConnected] = useState(false);
  const [tokenHashes, setTokenHashes] = useState<Map<string, TokenHashData>>(new Map());
  const handlersRef = useRef<{
    connection: (() => void) | null;
    disconnection: (() => void) | null;
    error: ((error: any) => void) | null;
    message: ((message: any) => void) | null;
  }>({
    connection: null,
    disconnection: null,
    error: null,
    message: null
  });

  // Check initial connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const status = await window.electron.ipcRenderer.invoke('p2p:get-status');
        console.log('Initial P2P connection status:', status);
        setIsConnected(status.isConnected);
      } catch (error) {
        console.error('Error checking P2P connection status:', error);
      }
    };
    checkConnection();
  }, []);

  // Cleanup function to remove all listeners
  const cleanup = useCallback(() => {
    const { connection, disconnection, error, message } = handlersRef.current;
    if (connection) {
      window.electron.ipcRenderer.removeListener('p2p:connected', connection);
    }
    if (disconnection) {
      window.electron.ipcRenderer.removeListener('p2p:disconnected', disconnection);
    }
    if (error) {
      window.electron.ipcRenderer.removeListener('p2p:error', error);
    }
    if (message) {
      window.electron.ipcRenderer.removeListener('p2p:message', message);
    }
  }, []);

  useEffect(() => {
    console.log('Setting up P2P event listeners');
    
    // Clean up any existing listeners
    cleanup();

    // Create new handlers
    const handleConnection = () => {
      console.log('P2P Connected event received');
      setIsConnected(true);
    };
    
    const handleDisconnection = () => {
      console.log('P2P Disconnected event received');
      setIsConnected(false);
    };
    
    const handleError = (error: any) => {
      console.error('P2P error received:', error);
      setIsConnected(false);
    };
    
    const handleMessage = (message: any) => {
      console.log('Received P2P message:', message);
      if (message.type === P2P_MESSAGE_TYPES.TOKEN_HASH_CREATED) {
        const { serialNumber, hash } = message.data;
        console.log('Processing token hash created message:', { serialNumber, hash });
        setTokenHashes(prev => {
          const newMap = new Map(prev);
          newMap.set(serialNumber, {
            hash,
            serialNumber,
            timestamp: new Date().toISOString(),
            verified: true,
            verificationCount: 0
          });
          return newMap;
        });
      }
    };

    // Store handlers in ref
    handlersRef.current = {
      connection: handleConnection,
      disconnection: handleDisconnection,
      error: handleError,
      message: handleMessage
    };

    // Add new listeners
    window.electron.ipcRenderer.on('p2p:connected', handleConnection);
    window.electron.ipcRenderer.on('p2p:disconnected', handleDisconnection);
    window.electron.ipcRenderer.on('p2p:error', handleError);
    window.electron.ipcRenderer.on('p2p:message', handleMessage);

    console.log('P2P event listeners set up');

    // Cleanup on unmount
    return cleanup;
  }, [cleanup]);

  const registerTokenHash = useCallback(async (serialNumber: string, hash: string) => {
    try {
      await window.electron.ipcRenderer.invoke('p2p:send-message', {
        type: P2P_MESSAGE_TYPES.TOKEN_HASH_CREATED,
        data: { serialNumber, hash }
      });
    } catch (error) {
      console.error('Error registering token hash:', error);
      throw error;
    }
  }, []);

  const verifyTokenHash = useCallback(async (serialNumber: string, hash: string) => {
    try {
      await window.electron.ipcRenderer.invoke('p2p:send-message', {
        type: P2P_MESSAGE_TYPES.VERIFY_TOKEN_HASH,
        data: { serialNumber, hash }
      });
    } catch (error) {
      console.error('Error verifying token hash:', error);
      throw error;
    }
  }, []);

  const getTokenHash = useCallback((serialNumber: string): string | undefined => {
    return tokenHashes.get(serialNumber)?.hash;
  }, [tokenHashes]);

  const getTokenHashData = useCallback((serialNumber: string): TokenHashData | undefined => {
    return tokenHashes.get(serialNumber);
  }, [tokenHashes]);

  return {
    isConnected,
    registerTokenHash,
    verifyTokenHash,
    getTokenHash,
    getTokenHashData
  };
}; 