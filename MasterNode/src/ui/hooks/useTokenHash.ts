import { useCallback, useState, useEffect } from 'react';
import { useP2P } from './useP2P';
import { P2P_MESSAGE_TYPES } from '../utils/api/config';

interface TokenHash {
    hash: string;
    timestamp: number;
    serialNumber: string;
    verificationCount?: number;
}

interface TokenHashData {
    [serialNumber: string]: TokenHash;
}

export const useTokenHash = () => {
    const [tokenHash, setTokenHash] = useState<TokenHash | null>(null);
    const [tokenHashData, setTokenHashData] = useState<TokenHashData>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { sendMessage, isConnected, status, messages } = useP2P();

    // Handle incoming token hash messages
    useEffect(() => {
        const latestMessage = messages[messages.length - 1];
        if (latestMessage?.type === P2P_MESSAGE_TYPES.TOKEN_HASH_VERIFICATION) {
            const { serialNumber, hash, timestamp, verificationCount } = latestMessage.data;
            setTokenHashData(prev => ({
                ...prev,
                [serialNumber]: { hash, timestamp, serialNumber, verificationCount }
            }));
        }
    }, [messages]);

    const registerTokenHash = useCallback((serialNumber: string, hash: string) => {
        setIsLoading(true);
        setError(null);

        try {
            sendMessage({
                type: P2P_MESSAGE_TYPES.TOKEN_HASH_CREATED,
                data: {
                    serialNumber,
                    hash,
                    timestamp: Date.now()
                }
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to register token hash');
        } finally {
            setIsLoading(false);
        }
    }, [sendMessage]);

    const verifyTokenHash = useCallback((serialNumber: string, hash: string) => {
        setIsLoading(true);
        setError(null);

        try {
            sendMessage({
                type: P2P_MESSAGE_TYPES.VERIFY_TOKEN_HASH,
                data: {
                    serialNumber,
                    hash,
                    timestamp: Date.now()
                }
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to verify token hash');
        } finally {
            setIsLoading(false);
        }
    }, [sendMessage]);

    const getTokenHash = useCallback((serialNumber: string) => {
        setIsLoading(true);
        setError(null);

        try {
            sendMessage({
                type: P2P_MESSAGE_TYPES.VERIFY_TOKEN_HASH,
                data: {
                    serialNumber,
                    timestamp: Date.now()
                }
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get token hash');
        } finally {
            setIsLoading(false);
        }
    }, [sendMessage]);

    const getTokenHashData = useCallback((serialNumber: string) => {
        return tokenHashData[serialNumber] || null;
    }, [tokenHashData]);

    const getVerificationResult = useCallback((serialNumber: string) => {
        const data = tokenHashData[serialNumber];
        return data ? {
            valid: data.verificationCount ? data.verificationCount > 0 : false,
            verifiedBy: data.verificationCount || 0
        } : null;
    }, [tokenHashData]);

    const getVerificationStatus = useCallback((serialNumber: string) => {
        const data = tokenHashData[serialNumber];
        if (!data) return 'Not Found';
        return data.verificationCount ? 'Verified' : 'Unverified';
    }, [tokenHashData]);

    return {
        tokenHash,
        registerTokenHash,
        verifyTokenHash,
        getTokenHash,
        getTokenHashData,
        getVerificationResult,
        getVerificationStatus,
        isLoading,
        error,
        isConnected,
        status
    };
}; 