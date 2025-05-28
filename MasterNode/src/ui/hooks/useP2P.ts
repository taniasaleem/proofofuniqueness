import { useEffect, useCallback, useState, useRef } from 'react';
import { p2pService, blockchainAPI } from '../utils/api/p2p';
import { IpcRenderer, ElectronAPI } from '../utils/api/types';
import { P2P_MESSAGE_TYPES } from '../utils/api/config';

type P2PMessageTypeValue = typeof P2P_MESSAGE_TYPES[keyof typeof P2P_MESSAGE_TYPES];

interface P2PMessage {
  type: P2PMessageTypeValue;
  data: any;
  timestamp: number;
  peerId: string;
  success?: boolean;
  error?: string;
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
  const [nodes, setNodes] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
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
      return Promise.reject(new Error('Electron API not available'));
    }
    
    return new Promise((resolve, reject) => {
      // Set up response handler
      const responseHandler = (response: any) => {
        if (response.type === 'peers-response' || response.type === 'error') {
          window.electron?.ipcRenderer.removeListener('p2p-message', responseHandler);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        }
      };

      // Add response handler
      window.electron?.ipcRenderer.on('p2p-message', responseHandler);

      // Send the request
      window.electron?.ipcRenderer.send('p2p-send', {
        type: 'get-nodes',
        data: {},
        timestamp: new Date().toISOString()
      });
    });
  }, [checkElectronApi]);

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

  const handleMessage = useCallback((message: any) => {
    if (!isComponentMountedRef.current) return;
    
    // Handle port messages
    if (message.sender && message.ports) {
      console.log('[P2P] Received port message, skipping type validation');
      return;
    }
    
    // Validate message structure
    if (!message || typeof message !== 'object') {
      console.error('Invalid message structure:', message);
      return;
    }

    if (!message.type) {
      console.error('Message missing type field:', message);
      return;
    }

    // Validate message type
    const validTypes = Object.values(P2P_MESSAGE_TYPES);
    const isValidType = validTypes.includes(message.type as P2PMessageTypeValue);
    if (!isValidType) {
      console.warn(`Unknown message type: ${message.type}`);
      return;
    }

    // Format the message with required fields
    const formattedMessage: P2PMessage = {
      type: message.type as P2PMessageTypeValue,
      data: message.data || {},
      timestamp: message.timestamp || Date.now(),
      peerId: message.peerId || peerId,
      success: message.success !== undefined ? message.success : !message.error,
      error: message.error
    };

    console.log('[P2P] Formatted message:', formattedMessage);

    addMessage(formattedMessage);
    
    // Update state based on message type
    switch (formattedMessage.type) {
      case P2P_MESSAGE_TYPES.NODES_RESPONSE:
        setNodes(formattedMessage.data.nodes || []);
        setConnectionStatus('connected');
        break;
      case P2P_MESSAGE_TYPES.NODE_CONNECTED:
        setConnectionStatus('connected');
        break;
      case P2P_MESSAGE_TYPES.NODE_DISCONNECTED:
        setConnectionStatus('disconnected');
        break;
      case P2P_MESSAGE_TYPES.ERROR:
        setError(formattedMessage.data.error || 'Unknown error');
        break;
      default:
        // Handle other message types
        break;
    }
  }, [addMessage, peerId]);

  const handlePeerConnected = useCallback((peerId: string) => {
    if (!isComponentMountedRef.current) return;
    console.log('[P2P] Peer connected:', peerId);
    setConnectedPeers(prev => [...prev, peerId]);
    setIsConnected(true);
    setStatus('Connected');
    reconnectAttemptsRef.current = 0;
  }, []);

  const handlePeerDisconnected = useCallback((peerId: string) => {
    if (!isComponentMountedRef.current) return;
    setConnectedPeers(prev => prev.filter(id => id !== peerId));
    setIsConnected(false);
    setStatus('Disconnected');
    attemptReconnect();
  }, [attemptReconnect]);

  const handlePeersList = useCallback((peers: string[]) => {
    if (!isComponentMountedRef.current) return;
    setConnectedPeers(peers);
    const newConnectionStatus = peers.length > 0;
    setIsConnected(newConnectionStatus);
    setStatus(newConnectionStatus ? 'Connected' : 'No peers connected');
    if (newConnectionStatus) {
      reconnectAttemptsRef.current = 0;
    }
  }, []);

  const handleP2PError = useCallback((error: { message: string }) => {
    if (!isComponentMountedRef.current) return;
    console.error('P2P error:', error);
    setIsConnected(false);
    setStatus(error.message);
    attemptReconnect();
  }, [attemptReconnect]);

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
  }, [checkElectronApi, handleMessage, handlePeerConnected, handlePeerDisconnected, handlePeersList, handleP2PError, getConnectedPeers]);

  const sendMessage = useCallback((data: any) => {
    if (!checkElectronApi()) {
      console.warn('Electron API not available, cannot send message');
      return Promise.reject(new Error('Electron API not available'));
    }

    if (!data || typeof data !== 'object') {
      console.error('Invalid message data:', data);
      return Promise.reject(new Error('Invalid message data'));
    }

    console.log("Sending message1:**********", data);

    // Format the message with the correct structure
    const message = {
      type: data.type,
      data: data.data || {},
      timestamp: new Date().toISOString()
    };

    console.log("Sending message:**********", message);

    // Validate message structure
    if (!message.type) {
      console.error('Message missing required type field:', message);
      return Promise.reject(new Error('Message missing required type field'));
    }

    return new Promise((resolve, reject) => {
      try {
        // Set up response handler
        const responseHandler = (response: any) => {
          if (response.type === `${message.type}-response` || response.type === 'error') {
            window.electron?.ipcRenderer.removeListener('p2p-message', responseHandler);
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.data);
            }
          }
        };

        // Add response handler
        window.electron?.ipcRenderer.on('p2p-message', responseHandler);

        // Send the message
        window.electron?.ipcRenderer.send('p2p-send', message);
      } catch (error) {
        reject(error);
      }
    });
  }, [checkElectronApi]);

  return {
    nodes,
    connectionStatus,
    error,
    connectedPeers,
    messages,
    sendMessage,
    getConnectedPeers,
    isConnected,
    status,
    peerId
  };
}; 