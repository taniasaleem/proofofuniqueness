import { create } from 'zustand';
import { StateCreator } from 'zustand';

// Use browser WebSocket in browser environment, ws in Node.js
const WebSocketImpl = typeof window !== 'undefined' ? window.WebSocket : require('ws').WebSocket;

export interface TokenHashMessage {
  type: 'token-hash-registered' | 'token-hash-verification' | 'token-hash-response' | 'token-hash-verified' | 'error' | 'network-nodes-update' | 'get-token-hash';
  data?: {
    message?: string;
    serialNumber?: string;
    hash?: string;
    nodes?: any[];
    requestId?: number;
  };
  timestamp?: number;
  clientId?: string;
}

interface WebSocketState {
  socket: typeof WebSocketImpl | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: Error | null;
  messageQueue: any[];
  clientId: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: any) => void;
  registerTokenHash: (serialNumber: string, hash: string) => void;
  verifyTokenHash: (serialNumber: string, hash: string) => void;
  getTokenHash: (serialNumber: string) => void;
  onMessage: ((message: TokenHashMessage) => void) | null;
  setMessageHandler: (handler: (message: TokenHashMessage) => void) => void;
}

const WS_URL = 'ws://localhost:8080/ws';
const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;

export const useWebSocket = create<WebSocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  messageQueue: [],
  clientId: null,
  onMessage: null,

  setMessageHandler: (handler) => {
    set({ onMessage: handler });
  },

  connect: async () => {
    const { socket, isConnected, isConnecting } = get();
    
    if (socket || isConnected || isConnecting) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    console.log('Connecting to WebSocket...');
    set({ isConnecting: true, connectionError: null });

    try {
      // Close any existing socket first
      if (socket) {
        socket.close();
      }

      const newSocket = new WebSocketImpl(WS_URL);
      let reconnectAttempts = 0;
      let reconnectTimeout: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
        if (newSocket) {
          newSocket.onopen = null;
          newSocket.onclose = null;
          newSocket.onerror = null;
          newSocket.onmessage = null;
        }
      };

      newSocket.onopen = () => {
        console.log('WebSocket Connected');
        set({ 
          isConnected: true, 
          isConnecting: false, 
          connectionError: null,
          socket: newSocket 
        });
        
        // Process any queued messages
        const { messageQueue, clientId } = get();
        if (messageQueue.length > 0) {
          console.log(`Processing ${messageQueue.length} queued messages`);
          messageQueue.forEach(message => {
            newSocket.send(JSON.stringify({
              ...message,
              clientId: clientId || 'pending'
            }));
          });
          set({ messageQueue: [] });
        }
      };

      newSocket.onclose = (event: CloseEvent) => {
        console.log('WebSocket Disconnected:', event.code, event.reason);
        cleanup();
        set({ 
          isConnected: false, 
          socket: null, 
          isConnecting: false,
          clientId: null // Reset client ID on disconnect
        });

        // Only attempt to reconnect if not manually disconnected
        if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
          console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`);
          reconnectTimeout = setTimeout(() => {
            if (!get().isConnected && !get().isConnecting) {
              get().connect();
            }
          }, delay);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          set({ 
            connectionError: new Error('Max reconnection attempts reached'),
            isConnecting: false 
          });
        }
      };

      newSocket.onerror = (error: Event) => {
        console.error('WebSocket Error:', error);
        cleanup();
        set({ 
          isConnected: false, 
          isConnecting: false,
          connectionError: new Error('WebSocket connection error')
        });
      };

      newSocket.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received message:', data);
          
          // Store the client ID if it's in the message
          if (data.type === 'connection' && data.data?.clientId) {
            console.log('Received client ID:', data.data.clientId);
            set({ clientId: data.data.clientId });
          }

          const { onMessage } = get();
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      set({ 
        isConnecting: false, 
        connectionError: error instanceof Error ? error : new Error('Failed to create WebSocket')
      });
    }
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      console.log('Disconnecting WebSocket...');
      socket.close();
      set({ 
        socket: null, 
        isConnected: false, 
        isConnecting: false,
        messageQueue: [],
        connectionError: null,
        clientId: null
      });
    }
  },

  sendMessage: (message: any) => {
    const { socket, isConnected, clientId } = get();
    
    // Don't wrap the message again if it's already in the correct format
    const formattedMessage = message.data ? message : {
      type: message.type,
      data: message.type === 'get-token-hash' 
        ? { 
            serialNumber: message.serialNumber,
            requestId: Date.now()
          }
        : { 
            serialNumber: message.serialNumber,
            hash: message.hash,
            requestId: Date.now()
          },
      timestamp: Date.now(),
      clientId: clientId || 'pending'
    };

    if (!socket || !isConnected) {
      console.log('WebSocket not connected, queueing message');
      set(state => ({ 
        messageQueue: [...state.messageQueue, formattedMessage]
      }));
      get().connect();
      return;
    }

    try {
      console.log('Sending message:', formattedMessage);
      socket.send(JSON.stringify(formattedMessage));
    } catch (error) {
      console.error('Error sending message:', error);
      set(state => ({ 
        messageQueue: [...state.messageQueue, formattedMessage],
        connectionError: error instanceof Error ? error : new Error('Failed to send message')
      }));
      get().connect();
    }
  },

  registerTokenHash: (serialNumber: string, hash: string) => {
    const message = {
      type: 'register-token-hash',
      serialNumber,
      hash
    };
    get().sendMessage(message);
  },

  verifyTokenHash: (serialNumber: string, hash: string) => {
    const message = {
      type: 'verify-token-hash',
      serialNumber,
      hash
    };
    get().sendMessage(message);
  },

  getTokenHash: (serialNumber: string) => {
    console.log('getTokenHash called with serial number:', serialNumber);
    if (!serialNumber) {
      console.error('getTokenHash called without serial number');
      return;
    }

    const message = {
      type: 'get-token-hash',
      data: {
        serialNumber,
        requestId: Date.now()
      },
      timestamp: Date.now(),
      clientId: get().clientId || 'pending'
    };

    // Send the message directly without any additional wrapping
    const { socket, isConnected } = get();
    if (!socket || !isConnected) {
      console.log('WebSocket not connected, queueing message');
      set(state => ({ 
        messageQueue: [...state.messageQueue, message]
      }));
      get().connect();
      return;
    }

    try {
      console.log('Sending message:', message);
      socket.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message:', error);
      set(state => ({ 
        messageQueue: [...state.messageQueue, message],
        connectionError: error instanceof Error ? error : new Error('Failed to send message')
      }));
      get().connect();
    }
  }
})); 