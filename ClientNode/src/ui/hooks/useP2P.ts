import { useState, useEffect, useCallback, useRef } from 'react';
import { P2PAPI, TokenHashData } from '../types';

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
    // Clean up any existing listeners
    cleanup();

    // Create new handlers
    const handleConnection = () => setIsConnected(true);
    const handleDisconnection = () => setIsConnected(false);
    const handleError = (error: any) => console.error('P2P error:', error);
    const handleMessage = (message: any) => {
      if (message.type === 'token-hash') {
        setTokenHashes(prev => new Map(prev).set(message.data.serialNumber, message.data));
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

    // Cleanup on unmount
    return cleanup;
  }, [cleanup]);

  const registerTokenHash = useCallback(async (serialNumber: string, hash: string) => {
    try {
      await window.electron.ipcRenderer.invoke('p2p:send-message', {
        type: 'register-token-hash',
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
        type: 'verify-token-hash',
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