import { create } from 'zustand';
import { WebSocketService, WebSocketConfig, WebSocketMessage } from '../../electron/services/websocket.service';

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  lastMessage: WebSocketMessage | null;
  reconnectAttempts: number;
  service: WebSocketService | null;
  connect: (config: WebSocketConfig) => void;
  disconnect: () => void;
  send: (message: WebSocketMessage) => void;
  clearError: () => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  isConnected: false,
  isConnecting: false,
  error: null,
  lastMessage: null,
  reconnectAttempts: 0,
  service: null,

  connect: (config: WebSocketConfig) => {
    const { service } = get();
    
    // If there's an existing service, disconnect it first
    if (service) {
      service.disconnect();
    }

    const newService = new WebSocketService({
      ...config,
      // Increase default values for better stability
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      pingInterval: config.pingInterval || 30000,
      pingTimeout: config.pingTimeout || 5000,
      connectionTimeout: config.connectionTimeout || 10000,
    });

    newService.on('connected', () => {
      set({ 
        isConnected: true, 
        isConnecting: false,
        error: null,
        reconnectAttempts: 0 
      });
    });

    newService.on('message', (message: WebSocketMessage) => {
      set({ lastMessage: message });
    });

    newService.on('error', (error: Error) => {
      set((state) => ({ 
        error, 
        isConnected: false,
        isConnecting: false,
        reconnectAttempts: state.reconnectAttempts + 1
      }));
    });

    set({ 
      service: newService,
      isConnecting: true,
      error: null
    });
    
    newService.connect();
  },

  disconnect: () => {
    const { service } = get();
    if (service) {
      service.disconnect();
      set({ 
        service: null, 
        isConnected: false, 
        isConnecting: false,
        error: null, 
        lastMessage: null,
        reconnectAttempts: 0
      });
    }
  },

  send: (message: WebSocketMessage) => {
    const { service, isConnected } = get();
    if (service && isConnected) {
      service.send(message);
    } else {
      set({ 
        error: new Error('Cannot send message: WebSocket is not connected')
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
})); 