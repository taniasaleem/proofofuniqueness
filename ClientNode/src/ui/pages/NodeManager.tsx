import React, { useEffect, useState } from 'react';
import { useP2P } from '../hooks/useP2P';
import { useSnackbar } from 'notistack';
import { useLocalBlockchain } from '../utils/api/localBlockchain';
import { Box, Typography, Button, CircularProgress, Paper, Grid } from '@mui/material';

interface TokenHashMessage {
  type: string;
  data: {
    serialNumber: string;
    hash: string;
    message?: string;
  };
}

export const NodeManager: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { isConnected, verifyTokenHash, getTokenHash } = useP2P();
  const { getTokenBySerialNumber } = useLocalBlockchain();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isGettingHash, setIsGettingHash] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const handleMessage = (message: TokenHashMessage) => {
      if (message.type === 'verify-token-hash-response') {
        setIsVerifying(false);
        enqueueSnackbar(message.data.message || 'Token hash verification completed', { variant: 'info' });
      } else if (message.type === 'get-token-hash-response') {
        setIsGettingHash(false);
        enqueueSnackbar(`Token hash for ${message.data.serialNumber}: ${message.data.hash}`, { variant: 'info' });
      }
      setMessages(prev => [...prev, message.data.message || '']);
    };

    window.electron.ipcRenderer.on('p2p:message', handleMessage);
    return () => {
      window.electron.ipcRenderer.removeListener('p2p:message', handleMessage);
    };
  }, [enqueueSnackbar]);

  const handleVerifyTokenHash = async () => {
    setIsVerifying(true);
    try {
      const token = await getTokenBySerialNumber('123456'); // Example serial number
      if (token) {
        await verifyTokenHash(token.serialNumber, token.hash);
      } else {
        enqueueSnackbar('Token not found', { variant: 'error' });
        setIsVerifying(false);
      }
    } catch (error) {
      enqueueSnackbar('Error verifying token hash', { variant: 'error' });
      setIsVerifying(false);
    }
  };

  const handleGetTokenHash = async () => {
    setIsGettingHash(true);
    try {
      const token = await getTokenBySerialNumber('123456'); // Example serial number
      if (token) {
        await getTokenHash(token.serialNumber);
      } else {
        enqueueSnackbar('Token not found', { variant: 'error' });
        setIsGettingHash(false);
      }
    } catch (error) {
      enqueueSnackbar('Error getting token hash', { variant: 'error' });
      setIsGettingHash(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Node Manager
      </Typography>
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          P2P Connection Status
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Typography>
              Status: {isConnected ? 'Connected' : 'Disconnected'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Token Operations
        </Typography>
        <Grid container spacing={2}>
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              onClick={handleVerifyTokenHash}
              disabled={!isConnected || isVerifying}
            >
              {isVerifying ? <CircularProgress size={24} /> : 'Verify Token Hash'}
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="secondary"
              onClick={handleGetTokenHash}
              disabled={!isConnected || isGettingHash}
            >
              {isGettingHash ? <CircularProgress size={24} /> : 'Get Token Hash'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Messages
        </Typography>
        {messages.map((msg, index) => (
          <Typography key={index}>{msg}</Typography>
        ))}
      </Paper>
    </Box>
  );
};
