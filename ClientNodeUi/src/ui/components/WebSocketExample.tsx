import React, { useEffect } from 'react';
import { useWebSocketStore } from '../stores/websocket.store';

export const WebSocketExample: React.FC = () => {
  const { 
    isConnected, 
    isConnecting,
    error, 
    lastMessage, 
    reconnectAttempts,
    connect, 
    disconnect, 
    send,
    clearError 
  } = useWebSocketStore();

  useEffect(() => {
    // Connect to WebSocket when component mounts
    connect({
      url: 'ws://your-websocket-server-url',
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      pingInterval: 30000,
      pingTimeout: 5000,
      connectionTimeout: 10000,
    });

    // Disconnect when component unmounts
    return () => {
      disconnect();
    };
  }, []);

  const handleSendMessage = () => {
    send({
      type: 'example',
      payload: { message: 'Hello from client!' },
    });
  };

  const getConnectionStatus = () => {
    if (isConnected) return 'Connected';
    if (isConnecting) return 'Connecting...';
    if (reconnectAttempts > 0) return `Reconnecting (Attempt ${reconnectAttempts})...`;
    return 'Disconnected';
  };

  return (
    <div>
      <h2>WebSocket Status</h2>
      <p>Connection Status: {getConnectionStatus()}</p>
      
      {error && (
        <div style={{ 
          color: 'red', 
          padding: '10px', 
          margin: '10px 0', 
          border: '1px solid red',
          borderRadius: '4px'
        }}>
          <p>Error: {error.message}</p>
          <button 
            onClick={clearError}
            style={{
              padding: '5px 10px',
              marginTop: '5px',
              cursor: 'pointer'
            }}
          >
            Dismiss Error
          </button>
        </div>
      )}

      <div style={{ margin: '20px 0' }}>
        <button 
          onClick={handleSendMessage} 
          disabled={!isConnected}
          style={{
            padding: '10px 20px',
            backgroundColor: isConnected ? '#4CAF50' : '#cccccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isConnected ? 'pointer' : 'not-allowed'
          }}
        >
          Send Message
        </button>

        {!isConnected && (
          <button 
            onClick={() => connect({
              url: 'ws://your-websocket-server-url',
              reconnectInterval: 5000,
              maxReconnectAttempts: 10,
            })}
            style={{
              padding: '10px 20px',
              marginLeft: '10px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reconnect
          </button>
        )}
      </div>

      {lastMessage && (
        <div style={{
          padding: '15px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          marginTop: '20px'
        }}>
          <h3>Last Message Received:</h3>
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            backgroundColor: '#fff',
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}>
            {JSON.stringify(lastMessage, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}; 