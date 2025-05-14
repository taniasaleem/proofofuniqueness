import { useEffect, useCallback, useState, useRef } from 'react';
import { wsService } from '../utils/api/websocket';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  clientId: string;
}

interface IpcRenderer {
  send: (channel: string, data: any) => void;
  on: (channel: string, func: (...args: any[]) => void) => void;
  removeListener: (channel: string, func: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    electron?: {
      ipcRenderer: IpcRenderer;
    };
  }
}

const MAX_MESSAGES = 1000; // Maximum number of messages to keep in state
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const ELECTRON_API_CHECK_INTERVAL = 1000; // Check every second
const WS_PORT = 8080; // Default WebSocket port

export const useWebSocket = () => {
  const [connectedClients, setConnectedClients] = useState<string[]>([]);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<string>('Initializing...');
  const [clientId, setClientId] = useState<string>('browser');
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

  const getConnectedClients = useCallback(() => {
    if (!checkElectronApi()) {
      console.warn('Electron API not available, retrying...');
      return;
    }
    
    // Send the request with retry logic
    const sendRequest = () => {
      const requestId = Date.now();
      
      // Ensure message has required type field
      const message = {
        type: 'get-clients',
        data: {
          requestId,
          port: WS_PORT,
          timestamp: Date.now()
        },
        timestamp: Date.now(),
        clientId: wsService.getClientId() || 'browser'
      };

      window.electron?.ipcRenderer.send('ws-get-clients', message);
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
      getConnectedClients();
    }, delay);
  }, [getConnectedClients]);

  const addMessage = useCallback((message: WebSocketMessage) => {
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
        getConnectedClients();
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
  }, [checkElectronApi, getConnectedClients]);

  useEffect(() => {
    if (!checkElectronApi()) {
      return;
    }

    const ipcRenderer = window.electron?.ipcRenderer;
    if (!ipcRenderer) {
      return;
    }

    // Request initial client list
    getConnectedClients();

    // Set up event listeners
    const handleMessage = (message: WebSocketMessage) => {
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

      // Handle connection message to get client ID
      if (message.type === 'connection' && message.data?.clientId) {
        console.log('[WebSocket] Setting client ID from connection message:', message.data.clientId);
        setClientId(message.data.clientId);
      }

      // Format the message with required fields
      const formattedMessage = {
        type: message.type,
        data: message.data || {},
        timestamp: message.timestamp || Date.now(),
        clientId: message.clientId || wsService.getClientId() || 'browser'
      };

      console.log('[WebSocket] Current client ID state:', clientId);
      console.log('[WebSocket] Formatted message:', formattedMessage);

      addMessage(formattedMessage);
      
      // If we receive any message, we're connected
      if (!isConnected) {
        setIsConnected(true);
        setStatus('Connected');
        reconnectAttemptsRef.current = 0;
      }
    };

    const handleClientConnected = (clientId: string) => {
      if (!isComponentMountedRef.current) return;
      console.log('[WebSocket] Client connected:', clientId);
      setConnectedClients(prev => [...prev, clientId]);
      setClientId(clientId); // Also update clientId when client connects
      setIsConnected(true);
      setStatus('Connected');
      reconnectAttemptsRef.current = 0;
    };

    const handleClientDisconnected = (clientId: string) => {
      if (!isComponentMountedRef.current) return;
      setConnectedClients(prev => prev.filter(id => id !== clientId));
      setIsConnected(false);
      setStatus('Disconnected');
      attemptReconnect();
    };

    const handleClientsList = (clients: string[]) => {
      if (!isComponentMountedRef.current) return;
      setConnectedClients(clients);
      const newConnectionStatus = clients.length > 0;
      setIsConnected(newConnectionStatus);
      setStatus(newConnectionStatus ? 'Connected' : 'No clients connected');
      if (newConnectionStatus) {
        reconnectAttemptsRef.current = 0;
      }
    };

    const handleWebSocketError = (error: { message: string }) => {
      if (!isComponentMountedRef.current) return;
      console.error('WebSocket error:', error);
      setIsConnected(false);
      setStatus(error.message);
      attemptReconnect();
    };

    // Register event listeners
    ipcRenderer.on('ws-message', handleMessage);
    ipcRenderer.on('ws-client-connected', handleClientConnected);
    ipcRenderer.on('ws-client-disconnected', handleClientDisconnected);
    ipcRenderer.on('ws-clients-list', handleClientsList);
    ipcRenderer.on('ws-error', handleWebSocketError);

    // Cleanup
    return () => {
      ipcRenderer.removeListener('ws-message', handleMessage);
      ipcRenderer.removeListener('ws-client-connected', handleClientConnected);
      ipcRenderer.removeListener('ws-client-disconnected', handleClientDisconnected);
      ipcRenderer.removeListener('ws-clients-list', handleClientsList);
      ipcRenderer.removeListener('ws-error', handleWebSocketError);
    };
  }, [checkElectronApi, attemptReconnect, addMessage, getConnectedClients]);

  const sendMessage = useCallback((data: any) => {
    if (!checkElectronApi()) {
      console.warn('Electron API not available, cannot send message');
      return;
    }

    if (!data || typeof data !== 'object') {
      console.error('Invalid message data:', data);
      return;
    }

    console.log('[WebSocket] Current client ID before sending:', clientId);

    // Format the message with the correct structure
    const message = {
      type: data.type,
      data: data.data || {},
      timestamp: Date.now(),
      clientId: wsService.getClientId() || clientId || 'browser'
    };

    console.log('[WebSocket] Sending message with client ID:', message.clientId);

    // Validate message structure
    if (!message.type) {
      console.error('Message missing required type field:', message);
      return;
    }

    try {
      window.electron?.ipcRenderer.send('ws-send', message);
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      setStatus('Failed to send message');
    }
  }, [checkElectronApi, clientId]);

  useEffect(() => {
    console.log('[WebSocket] Client ID changed:', clientId);
  }, [clientId]);

  useEffect(() => {
    isComponentMountedRef.current = true;
  }, []);

  return {
    connectedClients,
    messages,
    sendMessage,
    getConnectedClients,
    isConnected,
    status,
    clientId
  };
}; 