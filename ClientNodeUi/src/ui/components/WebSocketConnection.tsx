import React, { useEffect } from 'react';
import { Button, Typography, Box, Paper } from '@mui/material';
import { useWebSocket } from '../services/websocket';

export const WebSocketConnection: React.FC = () => {
  const { isConnected, connect, disconnect, sendMessage } = useWebSocket();

  useEffect(() => {
    // Connect to WebSocket when component mounts
    connect();

    // Disconnect when component unmounts
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const handleTestMessage = () => {
    sendMessage({
      type: 'test',
      data: {
        message: 'Hello from client!',
        timestamp: new Date().toISOString()
      }
    });
  };

  return (
    <Paper elevation={3} sx={{ p: 3, m: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6">
          WebSocket Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color={isConnected ? 'error' : 'success'}
            onClick={isConnected ? disconnect : connect}
          >
            {isConnected ? 'Disconnect' : 'Connect'}
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleTestMessage}
            disabled={!isConnected}
          >
            Send Test Message
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}; 