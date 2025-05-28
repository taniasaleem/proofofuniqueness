import { useEffect, useCallback, useState, useRef } from 'react';
import { p2pService, blockchainAPI } from '../utils/api/p2p';
import { IpcRenderer, ElectronAPI } from '../utils/api/types';

interface P2PMessage {
  type: string;
  data: any;
  timestamp: number;
  peerId: string;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

const MAX_MESSAGES = 1000; // Maximum number of messages to keep in state
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const ELECTRON_API_CHECK_INTERVAL = 1000; // Check every second

export const useP2P = () => {
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [messages, setMessages] = useState<P2PMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<string>('Initializing...');
  const [peerId, setPeerId] = useState<string>('');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastMessageTimestampRef = useRef<number>(Date.now());
  const isComponentMountedRef = useRef(true);
  const electronApiCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initializationAttemptsRef = useRef(0);
  const MAX_INITIALIZATION_ATTEMPTS = 10;

  const checkElectronApi = useCallback(() => {
    if (!window.electron?.ipcRenderer) {
      console.warn('Electron API not available, retrying...');
      setStatus('Waiting for Electron API...');
      initializationAttemptsRef.current += 1;
      
      if (initializationAttemptsRef.current >= MAX_INITIALIZATION_ATTEMPTS) {
        console.error('Max initialization attempts reached. Electron API not available.');
        setStatus('Failed to initialize: Electron API not available');
        return false;
      }
      return false;
    }
    return true;
  }, []);

  const getConnectedPeers = useCallback(() => {
    if (!checkElectronApi()) {
      console.warn('Electron API not available, retrying...');
      return;
    }
    
    // Send the request with retry logic
    const sendRequest = () => {
      window.electron?.ipcRenderer.send('p2p-get-peers', { type: 'get-peers' });
    };

    // Initial request
    sendRequest();

    // Set up retry interval with exponential backoff
    let retryCount = 0;
    const maxRetries = 5;
    const baseDelay = 2000; // 2 seconds

    const retryInterval = setInterval(() => {
      if (isConnected) {
        clearInterval(retryInterval);
        return;
      }

      retryCount++;
      if (retryCount >= maxRetries) {
        clearInterval(retryInterval);
        setStatus('Connection failed after max retries');
        return;
      }

      const delay = baseDelay * Math.pow(2, retryCount - 1);
      sendRequest();
    }, baseDelay);

    // Clear interval after max time
    setTimeout(() => {
      clearInterval(retryInterval);
      if (!isConnected) {
        setStatus('Connection failed');
      }
    }, baseDelay * Math.pow(2, maxRetries));
  }, [checkElectronApi, isConnected]);

  const attemptReconnect = useCallback(() => {
    if (!isComponentMountedRef.current) return;

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      setStatus('Max reconnection attempts reached. Please refresh the page.');
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
      MAX_RECONNECT_DELAY
    );

    setStatus(`Attempting to reconnect in ${delay/1000} seconds...`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isComponentMountedRef.current) return;
      
      reconnectAttemptsRef.current += 1;
      getConnectedPeers();
    }, delay);
  }, [getConnectedPeers]);

  const addMessage = useCallback((message: P2PMessage) => {
    setMessages(prev => {
      const newMessages = [...prev, message];
      return newMessages.slice(-MAX_MESSAGES);
    });
    lastMessageTimestampRef.current = message.timestamp;
  }, []);

  useEffect(() => {
    isComponentMountedRef.current = true;
    initializationAttemptsRef.current = 0;

    const checkApi = () => {
      if (checkElectronApi()) {
        setStatus('Connecting...');
        clearInterval(electronApiCheckIntervalRef.current!);
        getConnectedPeers();
        return true;
      }
      return false;
    };

    // Initial check
    if (!checkApi()) {
      electronApiCheckIntervalRef.current = setInterval(checkApi, ELECTRON_API_CHECK_INTERVAL);
    }

    // Cleanup
    return () => {
      isComponentMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (electronApiCheckIntervalRef.current) {
        clearInterval(electronApiCheckIntervalRef.current);
      }
    };
  }, [checkElectronApi, getConnectedPeers]);

  useEffect(() => {
    if (!checkElectronApi()) {
      return;
    }

    const ipcRenderer = window.electron?.ipcRenderer;
    if (!ipcRenderer) {
      return;
    }

    // Request initial peer list
    getConnectedPeers();

    // Set up event listeners
    const handleMessage = (message: P2PMessage) => {
      if (!isComponentMountedRef.current) return;
      
      // Validate message structure
      if (!message || typeof message !== 'object') {
        console.error('Invalid message structure:', message);
        return;
      }

      if (!message.type) {
        console.error('Message missing type field:', message);
        return;
      }

      // Format the message with required fields
      const formattedMessage = {
        type: message.type,
        data: message.data || {},
        timestamp: message.timestamp || Date.now(),
        peerId: message.peerId || peerId
      };

      console.log('[P2P] Formatted message:', formattedMessage);

      addMessage(formattedMessage);
      
      // If we receive any message, we're connected
      if (!isConnected) {
        setIsConnected(true);
        setStatus('Connected');
        reconnectAttemptsRef.current = 0;
      }
    };

    const handlePeerConnected = (peerId: string) => {
      if (!isComponentMountedRef.current) return;
      console.log('[P2P] Peer connected:', peerId);
      setConnectedPeers(prev => [...prev, peerId]);
      setIsConnected(true);
      setStatus('Connected');
      reconnectAttemptsRef.current = 0;
    };

    const handlePeerDisconnected = (peerId: string) => {
      if (!isComponentMountedRef.current) return;
      setConnectedPeers(prev => prev.filter(id => id !== peerId));
      setIsConnected(false);
      setStatus('Disconnected');
      attemptReconnect();
    };

    const handlePeersList = (peers: string[]) => {
      if (!isComponentMountedRef.current) return;
      setConnectedPeers(peers);
      const newConnectionStatus = peers.length > 0;
      setIsConnected(newConnectionStatus);
      setStatus(newConnectionStatus ? 'Connected' : 'No peers connected');
      if (newConnectionStatus) {
        reconnectAttemptsRef.current = 0;
      }
    };

    const handleP2PError = (error: { message: string }) => {
      if (!isComponentMountedRef.current) return;
      console.error('P2P error:', error);
      setIsConnected(false);
      setStatus(error.message);
      attemptReconnect();
    };

    // Register event listeners
    ipcRenderer.on('p2p-message', handleMessage);
    ipcRenderer.on('peer-connected', handlePeerConnected);
    ipcRenderer.on('peer-disconnected', handlePeerDisconnected);
    ipcRenderer.on('peers-list', handlePeersList);
    ipcRenderer.on('p2p-error', handleP2PError);

    // Cleanup
    return () => {
      ipcRenderer.removeListener('p2p-message', handleMessage);
      ipcRenderer.removeListener('peer-connected', handlePeerConnected);
      ipcRenderer.removeListener('peer-disconnected', handlePeerDisconnected);
      ipcRenderer.removeListener('peers-list', handlePeersList);
      ipcRenderer.removeListener('p2p-error', handleP2PError);
    };
  }, [checkElectronApi, attemptReconnect, addMessage, getConnectedPeers]);

  const sendMessage = useCallback((data: any) => {
    if (!checkElectronApi()) {
      console.warn('Electron API not available, cannot send message');
      return;
    }

    if (!data || typeof data !== 'object') {
      console.error('Invalid message data:', data);
      return;
    }

    // Format the message with the correct structure
    const message = {
      type: data.type,
      data: data.data || {},
      timestamp: Date.now(),
      peerId: peerId
    };

    // Validate message structure
    if (!message.type) {
      console.error('Message missing required type field:', message);
      return;
    }

    try {
      window.electron?.ipcRenderer.send('p2p-send', message);
    } catch (error) {
      console.error('Error sending P2P message:', error);
      setStatus('Failed to send message');
    }
  }, [checkElectronApi, peerId]);

  return {
    connectedPeers,
    messages,
    sendMessage,
    getConnectedPeers,
    isConnected,
    status,
    peerId
  };
}; 