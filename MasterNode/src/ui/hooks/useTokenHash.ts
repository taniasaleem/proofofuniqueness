import { useCallback, useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';

interface TokenHashData {
    serialNumber: string;
    hash: string;
    timestamp: number;
    verificationCount: number;
}

export const useTokenHash = () => {
    const { sendMessage, isConnected, status } = useWebSocket();
    const [tokenHashes, setTokenHashes] = useState<Map<string, TokenHashData>>(new Map());
    const [verificationResults, setVerificationResults] = useState<Map<string, boolean>>(new Map());
    const [verificationStatus, setVerificationStatus] = useState<Map<string, string>>(new Map());

    // Get token hash data
    const getTokenHashData = useCallback((serialNumber: string) => {
        if (!serialNumber) {
            console.error('[TokenHash] Invalid serial number provided to getTokenHashData');
            return undefined;
        }

        const data = tokenHashes.get(serialNumber);
        return data;
    }, [tokenHashes]);

    // Debug function to check token existence
    const debugTokenExistence = useCallback((serialNumber: string) => {
        // Remove debug logging
    }, [tokenHashes, verificationStatus, isConnected, status]);

    // Register a new token hash
    const registerTokenHash = useCallback((serialNumber: string, hash: string) => {
        if (!isConnected) {
            console.error('[TokenHash] WebSocket not connected. Current status:', status);
            return;
        }

        try {
            // Validate input
            if (!serialNumber || typeof serialNumber !== 'string') {
                throw new Error('Invalid serial number');
            }
            if (!hash || typeof hash !== 'string') {
                throw new Error('Invalid hash');
            }

            // Format the message with all required fields
            const message = {
                type: 'register-token-hash',
                data: {
                    serialNumber,
                    hash,
                    requestId: Date.now()
                },
                timestamp: Date.now()
            };

            console.log('[TokenHash] Sending registration message:', {
                type: message.type,
                data: message.data,
                timestamp: new Date(message.timestamp).toISOString()
            });

            // Send the message and wait for response
            sendMessage(message);

            // Set up a timeout to check if registration was successful
            const timeout = setTimeout(() => {
                console.log('[TokenHash] Checking registration status for:', serialNumber);
                const tokenData = getTokenHashData(serialNumber);
                if (!tokenData) {
                    console.error('[TokenHash] Registration failed - token not found after timeout');
                    setVerificationStatus(prev => new Map(prev).set(serialNumber, 'Registration failed'));
                } else {
                    console.log('[TokenHash] Registration successful:', tokenData);
                    setVerificationStatus(prev => new Map(prev).set(serialNumber, 'Registered'));
                }
            }, 5000);

            return () => clearTimeout(timeout);
        } catch (error) {
            console.error('[TokenHash] Error in registerTokenHash:', error);
            if (error instanceof Error) {
                console.error('[TokenHash] Error details:', {
                    message: error.message,
                    stack: error.stack
                });
                setVerificationStatus(prev => new Map(prev).set(serialNumber, `Error: ${error.message}`));
            }
        }
    }, [isConnected, sendMessage, status, getTokenHashData]);

    // Verify a token hash
    const verifyTokenHash = useCallback((serialNumber: string, hash: string) => {
        if (!isConnected) {
            console.error('[TokenHash] WebSocket not connected');
            return;
        }

        // Validate input
        if (!serialNumber || typeof serialNumber !== 'string') {
            console.error('[TokenHash] Invalid serial number');
            return;
        }
        if (!hash || typeof hash !== 'string') {
            console.error('[TokenHash] Invalid hash');
            return;
        }

        const message = {
            type: 'verify-token-hash',
            data: {
                serialNumber,
                hash
            },
            timestamp: Date.now()
        };
        sendMessage(message);
    }, [isConnected, sendMessage]);

    // Get token hash for a serial number
    const getTokenHash = useCallback((serialNumber: string) => {
        if (!serialNumber || typeof serialNumber !== 'string') {
            console.error('[TokenHash] Invalid serial number:', serialNumber);
            return;
        }

        // If not connected, try to establish connection
        if (!isConnected) {
            const connectionMessage = {
                type: 'get-clients',
                data: {
                    requestId: Date.now(),
                    port: 8080
                },
                timestamp: Date.now()
            };
            
            window.electron?.ipcRenderer.send('ws-get-clients', connectionMessage);
            
            // Wait a short time for connection to establish
            setTimeout(() => {
                if (isConnected) {
                    // Create the message with the correct structure
                    const message = {
                        type: 'get-token-hash',
                        data: {
                            serialNumber,
                            requestId: Date.now()
                        },
                        timestamp: Date.now()
                    };
                    console.log('[TokenHash] Sending get-token-hash message:', message);
                    sendMessage(message);
                }
            }, 1000);
            return;
        }

        // Create the message with the correct structure
        const message = {
            type: 'get-token-hash',
            data: {
                serialNumber,
                requestId: Date.now()
            },
            timestamp: Date.now()
        };

        console.log('[TokenHash] Sending get-token-hash message:', message);
        sendMessage(message);
    }, [isConnected, sendMessage]);

    // Process incoming messages
    const processMessages = useCallback(() => {
        const handleMessage = (message: any) => {
            // Validate message structure
            if (!message || typeof message !== 'object') {
                console.error('[TokenHash] Invalid message structure:', message);
                return;
            }

            if (!message.type) {
                console.error('[TokenHash] Message missing type field:', message);
                return;
            }

            // Handle WebSocket messages with clientId and data
            if (message.clientId && message.data) {
                // Handle registration response
                if (message.type === 'token-hash-registered') {
                    const { serialNumber, hash, timestamp, verificationCount, status } = message.data;
                    console.log('[TokenHash] Processing token registration:', {
                        serialNumber,
                        hash,
                        timestamp,
                        verificationCount,
                        status
                    });

                    setTokenHashes(prev => {
                        const newMap = new Map(prev);
                        newMap.set(serialNumber, {
                            serialNumber,
                            hash,
                            timestamp: timestamp || Date.now(),
                            verificationCount: verificationCount || 0
                        });
                        return newMap;
                    });

                    // Update verification status based on registration status
                    let statusMessage = 'Registered';
                    if (status === 'already_registered') {
                        statusMessage = 'Already Registered';
                    } else if (status === 'broadcast') {
                        statusMessage = 'Broadcast Received';
                    }

                    setVerificationStatus(prev => new Map(prev).set(serialNumber, statusMessage));
                    return;
                }

                // Handle error messages
                if (message.type === 'error') {
                    console.error('[TokenHash] WebSocket error:', {
                        message: message.data.message,
                        clientId: message.clientId,
                        originalMessage: message.data.originalMessage
                    });

                    if (message.data.originalMessage?.data?.serialNumber) {
                        setVerificationStatus(prev => new Map(prev).set(
                            message.data.originalMessage.data.serialNumber,
                            `Error: ${message.data.message}`
                        ));
                    }
                    return;
                }

                // Handle verification response
                if (message.type === 'token-hash-verification') {
                    const { serialNumber, isValid, verificationCount } = message.data;
                    setVerificationResults(prev => new Map(prev).set(serialNumber, isValid));
                    setVerificationStatus(prev => new Map(prev).set(
                        serialNumber,
                        isValid ? 'Verified' : 'Verification Failed'
                    ));
                    return;
                }
            }
        };

        return handleMessage;
    }, []);

    // Get verification result
    const getVerificationResult = useCallback((serialNumber: string) => {
        return verificationResults.get(serialNumber);
    }, [verificationResults]);

    // Get verification status
    const getVerificationStatus = useCallback((serialNumber: string) => {
        return verificationStatus.get(serialNumber) || 'Not verified';
    }, [verificationStatus]);

    return {
        registerTokenHash,
        verifyTokenHash,
        getTokenHash,
        getTokenHashData,
        getVerificationResult,
        getVerificationStatus,
        isConnected,
        status,
        processMessages,
        debugTokenExistence
    };
}; 