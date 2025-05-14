import React, { useEffect, useState, useCallback } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Grid,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Chip
} from '@mui/material';
import { useWebSocket } from '../services/websocket';
import type { TokenHashMessage } from '../services/websocket';
import { AppLayout } from '../components/layout/AppLayout';
import { Blockchain, Node, NodeToken, MasterNode, log } from './node-token-implementation';
import { useSnackbar } from 'notistack';
import { LocalBlockchain } from '../../core/LocalBlockchain';

interface TokenHashStatus {
  serialNumber: string;
  hash: string;
  status: 'registered' | 'verified' | 'pending' | 'error';
  message?: string;
}

interface NetworkNode {
  serialNumber: string;
  status: string;
  tokenHash?: string;
  lastSeen: string;
}

// Initialize blockchain and master node
const localBlockchain = new Blockchain(0.6);
const masterNode = new MasterNode(localBlockchain);

export default function NodeManager() {
  const { 
    isConnected, 
    isConnecting,
    connectionError,
    verifyTokenHash, 
    getTokenHash,
    setMessageHandler,
    connect,
    disconnect,
    socket
  } = useWebSocket();

  // Node state
  const [serialNumber, setSerialNumber] = useState<string>('');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [privateKey, setPrivateKey] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isNodeCreated, setIsNodeCreated] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'failed'>('pending');
  const [tokenHash, setTokenHash] = useState<string>('');
  const [connectionTime, setConnectionTime] = useState('');

  // Network nodes state
  const [networkNodes, setNetworkNodes] = useState<NetworkNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Memoize the message handler
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      console.log('=== WebSocket Message Received ===');
      console.log('Message Type:', message.type);
      console.log('Full Message:', message);
      console.log('Serial Number:', message.data?.serialNumber);
      console.log('Hash:', message.data?.hash);
      console.log('Message:', message.data?.message);
      console.log('Timestamp:', message.timestamp);
      console.log('Client ID:', message.clientId);

      switch (message.type) {
        case 'token-hash-registered':
          console.log('Processing token-hash-registered message');
          if (message.data?.hash) {
            setTokenHash(message.data.hash);
            localStorage.setItem('tokenHash', message.data.hash);
            setStatus('Token hash registered successfully');
          }
          break;

        case 'token-hash-response':
          console.log('Processing token-hash-response message');
          if (message.data?.hash) {
            setTokenHash(message.data.hash);
            localStorage.setItem('tokenHash', message.data.hash);
            setStatus('Token hash received from master node');
          } else {
            console.log('Received token-hash-response without hash');
            setStatus('Waiting for token hash from master node...');
          }
          break;

        case 'token-hash-verified':
          console.log('Processing token-hash-verified message');
          if (message.data?.hash) {
            setTokenHash(message.data.hash);
            localStorage.setItem('tokenHash', message.data.hash);
            setVerificationStatus('verified');
            localStorage.setItem('verificationStatus', 'verified');
            setStatus('Token hash verified successfully');
          }
          break;

        case 'network-nodes-update':
          console.log('Processing network-nodes-update message');
          if (message.data?.nodes) {
            setNetworkNodes(message.data.nodes);
            setStatus('Network nodes updated');
          }
          break;

        case 'error':
          console.log('Processing error message:', message.data?.message);
          if (message.data?.message === 'Token hash not found') {
            console.log('Token hash not found - this is expected for new nodes');
            setStatus('Waiting for token hash from master node...');
            // If we have a serial number, request the token hash again
            if (serialNumber) {
              console.log('Requesting token hash again for serial number:', serialNumber);
              setTimeout(() => {
                getTokenHash(serialNumber);
              }, 5000); // Wait 5 seconds before requesting again
            }
          } else {
            setStatus(`Error: ${message.data?.message || 'Unknown error'}`);
          }
          break;

        default:
          console.log('Unknown message type:', message.type);
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      setStatus(`Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [serialNumber, getTokenHash]);

  // Handle WebSocket connection
  useEffect(() => {
    console.log('Node Manager initialized');
    
    // Connect to WebSocket if not already connected
    if (!isConnected && !isConnecting) {
      console.log('Connecting to WebSocket...');
      connect();
    }

    // Check if node information exists in localStorage
    const savedNode = localStorage.getItem('nodeInfo');
    if (savedNode) {
      const nodeInfo = JSON.parse(savedNode);
      console.log('Loading saved node info:', nodeInfo);
      setSerialNumber(nodeInfo.serialNumber);
      setWalletAddress(nodeInfo.walletAddress);
      setPrivateKey(nodeInfo.privateKey);
      setIsNodeCreated(true);
      setVerificationStatus(nodeInfo.verificationStatus || 'pending');
      if (nodeInfo.tokenHash) setTokenHash(nodeInfo.tokenHash);
      if (nodeInfo.connectionTime) setConnectionTime(nodeInfo.connectionTime);

      // Request token hash if we have a serial number and are connected
      if (nodeInfo.serialNumber && isConnected) {
        console.log('Requesting token hash for saved node:', nodeInfo.serialNumber);
        getTokenHash(nodeInfo.serialNumber);
      }
    }

    // Cleanup WebSocket connection when component unmounts
    return () => {
      if (isConnected) {
        console.log('Disconnecting WebSocket on cleanup');
        disconnect();
      }
    };
  }, [isConnected, isConnecting, connect, disconnect, getTokenHash]);

  // Handle WebSocket messages
  useEffect(() => {
    if (socket) {
      socket.addEventListener('message', handleMessage);
      return () => socket.removeEventListener('message', handleMessage);
    }
  }, [socket, handleMessage]);

  // Add interval to fetch token hash
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isNodeCreated && isConnected && serialNumber) {
      console.log('Setting up token hash fetch interval with serial number:', serialNumber);
      
      // Initial call
      console.log('Making initial getTokenHash call with serial number:', serialNumber);
      getTokenHash(serialNumber);

      // Set up interval to fetch every 5 seconds
      intervalId = setInterval(() => {
        if (isConnected) {
          console.log('Fetching token hash for serial number:', serialNumber);
          getTokenHash(serialNumber);
        }
      }, 20000); // 3 seconds interval
    }

    // Cleanup interval on unmount or when dependencies change
    return () => {
      if (intervalId) {
        console.log('Cleaning up token hash fetch interval');
        clearInterval(intervalId);
      }
    };
  }, [isNodeCreated, isConnected, serialNumber, getTokenHash]);

  // Add effect to log verification status changes
  useEffect(() => {
    console.log('=== Verification Status Changed ===');
    console.log('New Status:', verificationStatus);
    console.log('Current Token Hash:', tokenHash);
    console.log('================================');
  }, [verificationStatus, tokenHash]);

  // Add effect to log token hash changes
  useEffect(() => {
    console.log('Token hash changed to:', tokenHash);
  }, [tokenHash]);

  const createNode = () => {
    try {
      const newNode = new Node(localBlockchain);
      const nodeInfo = {
        serialNumber: newNode.serialNumber,
        walletAddress: newNode.wallet.getPublicKey(),
        privateKey: newNode.wallet.privateKey,
        verificationStatus: 'pending',
        isConnected: false
      };

      console.log('Creating new node with serial number:', newNode.serialNumber);
      localStorage.setItem('nodeInfo', JSON.stringify(nodeInfo));

      setSerialNumber(nodeInfo.serialNumber);
      setWalletAddress(nodeInfo.walletAddress);
      setPrivateKey(nodeInfo.privateKey);
      setVerificationStatus('pending');
      setIsNodeCreated(true);
      setStatus('Node created successfully. Waiting for token hash from master node...');

      // Request token hash immediately after node creation
      if (nodeInfo.serialNumber) {
        console.log('Requesting token hash for new node with serial number:', nodeInfo.serialNumber);
        getTokenHash(nodeInfo.serialNumber);
      }
    } catch (error) {
      console.error('Error creating node:', error);
      setStatus(`Error creating node: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleVerify = () => {
    if (!serialNumber || !tokenHash) {
      setSnackbar({
        open: true,
        message: 'Missing serial number or token hash',
        severity: 'error'
      });
      return;
    }
    verifyTokenHash(serialNumber, tokenHash);
  };

  const handleCheck = () => {
    if (!serialNumber) {
      setSnackbar({
        open: true,
        message: 'Please enter serial number',
        severity: 'error'
      });
      return;
    }
    getTokenHash(serialNumber);
  };

  const getVerificationStatusColor = () => {
    switch (verificationStatus) {
      case 'verified':
        return 'success.main';
      case 'failed':
        return 'error.main';
      default:
        return 'warning.main';
    }
  };

  const getVerificationStatusText = () => {
    switch (verificationStatus) {
      case 'verified':
        return 'Verified';
      case 'failed':
        return 'Failed';
      default:
        return 'Pending Verification';
    }
  };

  return (
    <AppLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">
            Node Manager
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {connectionError && (
              <Alert severity="error" sx={{ mr: 2 }}>
                {connectionError.message}
              </Alert>
            )}
            <Chip
              label={isConnecting ? 'Connecting...' : isConnected ? 'Connected to Master Node' : 'Disconnected'}
              color={isConnected ? 'success' : isConnecting ? 'warning' : 'error'}
              icon={isConnected ? 
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} /> : 
                isConnecting ?
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} /> :
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main' }} />
              }
            />
          </Box>
        </Box>

        {/* Node Creation/Status Section */}
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {isNodeCreated ? 'Node Information' : 'Create New Node'}
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">Verification Status:</Typography>
              <Typography color={getVerificationStatusColor()}>
                {getVerificationStatusText()}
              </Typography>
            </Box>

            {isNodeCreated ? (
              <>
                <TextField
                  fullWidth
                  label="Serial Number"
                  value={serialNumber}
                  InputProps={{ readOnly: true }}
                  variant="outlined"
                />
                
                <TextField
                  fullWidth
                  label="Wallet Address (Public Key)"
                  value={walletAddress}
                  InputProps={{ readOnly: true }}
                  variant="outlined"
                />

                <TextField
                  fullWidth
                  label="Private Key"
                  value={privateKey}
                  InputProps={{ readOnly: true }}
                  variant="outlined"
                  sx={{
                    '& .MuiInputBase-input': {
                      color: 'warning.main',
                    }
                  }}
                />

                {tokenHash && (
                  <TextField
                    fullWidth
                    label="Token Hash (Received from Master Node)"
                    value={tokenHash}
                    InputProps={{ readOnly: true }}
                    variant="outlined"
                  />
                )}

                {!isConnected && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Waiting for connection to Master Node...
                  </Alert>
                )}
              </>
            ) : (
              <Button 
                variant="contained" 
                color="primary" 
                onClick={createNode}
                fullWidth
              >
                Create Node
              </Button>
            )}
          </Box>
        </Paper>

        {/* Token Hash Operations Section */}
        {isNodeCreated && tokenHash && (
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Token Hash Operations
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleVerify}
                    disabled={!isConnected || verificationStatus === 'verified'}
                  >
                    Verify Token Hash
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleCheck}
                    disabled={!isConnected}
                  >
                    Check Status
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Network Nodes List */}
        <Paper elevation={3} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Network Nodes
            </Typography>
            {!isConnected && (
              <Chip
                label="Waiting for connection"
                color="warning"
                size="small"
              />
            )}
          </Box>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List>
              {networkNodes.map((node, index) => (
                <React.Fragment key={node.serialNumber}>
                  <ListItem>
                    <ListItemText
                      primary={`Node ${node.serialNumber}`}
                      secondary={
                        <>
                          <Typography component="span" variant="body2" color="text.primary">
                            Status: {node.status}
                          </Typography>
                          {node.tokenHash && (
                            <Typography component="span" variant="body2" display="block">
                              Token Hash: {node.tokenHash}
                            </Typography>
                          )}
                          <Typography component="span" variant="body2" display="block">
                            Last Seen: {new Date(node.lastSeen).toLocaleString()}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                  {index < networkNodes.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              {networkNodes.length === 0 && (
                <ListItem>
                  <ListItemText primary="No nodes found in the network" />
                </ListItem>
              )}
            </List>
          )}
        </Paper>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </AppLayout>
  );
} 