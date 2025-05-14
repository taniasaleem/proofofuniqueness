import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { createServer } from 'http';
import { randomBytes, createHash } from 'crypto';
import { isDev } from './util.js';

interface TokenHash {
    serialNumber: string;
    hash: string;
    timestamp: number;
    verifiedBy: string[];
}

interface WebSocketMessage {
    type: 'ping' | 'pong' | 'register-token-hash' | 'verify-token-hash' | 'get-token-hash' | 'error';
    data: any;
    timestamp: number;
    clientId: string;
}

interface RateLimit {
    count: number;
    lastReset: number;
}

export class WebSocketService extends EventEmitter {
    private wss: WebSocketServer;
    private server: any;
    private clients: Map<string, WebSocket> = new Map();
    private clientInfo: Map<string, { lastPing: number; ip: string; connectedAt: number }> = new Map();
    private tokenHashes: Map<string, TokenHash> = new Map();
    private rateLimits: Map<string, RateLimit> = new Map();
    private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();
    private readonly MAX_CLIENTS = 1000;
    private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
    private readonly RATE_LIMIT_MAX = 100; // 100 requests per minute
    private readonly TOKEN_HASH_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
    private readonly PING_INTERVAL = 30000; // 30 seconds
    private readonly CONNECTION_TIMEOUT = 30000; // 30 seconds
    private readonly HEARTBEAT_INTERVAL = 60000; // 1 minute
    private readonly MAX_MISSED_HEARTBEATS = 5;
    private readonly GRACE_PERIOD = 30000; // 30 seconds grace period for new connections

    constructor(port: number = 8080) {
        super();
        this.server = createServer();
        
        this.wss = new WebSocketServer({ 
            server: this.server,
            path: '/ws',
            perMessageDeflate: {
                zlibDeflateOptions: {
                    chunkSize: 1024,
                    memLevel: 7,
                    level: 3
                },
                zlibInflateOptions: {
                    chunkSize: 10 * 1024
                },
                clientNoContextTakeover: true,
                serverNoContextTakeover: true,
                serverMaxWindowBits: 10,
                concurrencyLimit: 10,
                threshold: 1024
            }
        });

        this.initialize();
        
        this.server.listen(port, () => {
            console.log(`WebSocket server is running on port ${port}`);
        });

        // Start cleanup intervals
        setInterval(() => this.cleanup(), 3600000); // Run cleanup every hour
        setInterval(() => this.checkHeartbeats(), this.HEARTBEAT_INTERVAL); // Check heartbeats every minute
    }

    private initialize() {
        this.wss.on('connection', (ws: WebSocket, req: any) => {
            const clientIp = req.socket.remoteAddress;
            const now = Date.now();

            // Only check for duplicate connections in production mode
            if (process.env.NODE_ENV === 'production') {
                for (const [id, info] of this.clientInfo.entries()) {
                    if (info.ip === clientIp) {
                        console.log(`Duplicate connection attempt from ${clientIp}, closing old connection`);
                        this.closeClient(id);
                    }
                }
            }

            // Check client limit
            if (this.clients.size >= this.MAX_CLIENTS) {
                ws.close(1013, 'Server at capacity');
                return;
            }

            // Verify authentication
            const token = req.headers['authorization'];
            if (!this.verifyToken(token)) {
                ws.close(1008, 'Unauthorized');
                return;
            }

            const clientId = this.generateClientId();
            this.clients.set(clientId, ws);
            this.clientInfo.set(clientId, {
                lastPing: now,
                ip: clientIp,
                connectedAt: now
            });

            console.log(`Client connected: ${clientId} from ${clientIp}`);

            // Set up connection timeout
            const connectionTimeout = setTimeout(() => {
                if (ws.readyState === WebSocket.CONNECTING) {
                    console.log(`Connection timeout for client ${clientId}`);
                    this.closeClient(clientId);
                }
            }, this.CONNECTION_TIMEOUT);

            // Set up ping interval
            const pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    try {
                        ws.ping();
                    } catch (error) {
                        console.error(`Error sending ping to client ${clientId}:`, error);
                        this.closeClient(clientId);
                    }
                }
            }, this.PING_INTERVAL);

            ws.on('message', (message: string) => {
                try {
                    // Check rate limit
                    if (!this.checkRateLimit(clientId)) {
                        console.log(`Rate limit exceeded for client ${clientId}`);
                        this.closeClient(clientId);
                        return;
                    }

                    const data = JSON.parse(message.toString());
                    if (!this.validateMessageStructure(data)) {
                        throw new Error('Invalid message structure');
                    }

                    // Update last ping time for heartbeat
                    if (data.type === 'pong') {
                        this.updateClientHeartbeat(clientId);
                    }

                    this.handleMessage(clientId, data);
                } catch (error: unknown) {
                    console.error('Error handling message:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    this.sendToClient(clientId, {
                        type: 'error',
                        data: { message: errorMessage },
                        timestamp: Date.now(),
                        clientId
                    });
                }
            });

            ws.on('close', (code: number, reason: string) => {
                console.log(`Client ${clientId} closed connection: ${code} - ${reason}`);
                clearInterval(pingInterval);
                clearTimeout(connectionTimeout);
                this.closeClient(clientId);
            });

            ws.on('error', (error: Error) => {
                console.error(`WebSocket error for client ${clientId}:`, error);
                this.closeClient(clientId);
            });

            ws.on('pong', () => {
                this.updateClientHeartbeat(clientId);
                console.log(`Received pong from client ${clientId}`);
            });

            // Send initial connection success message
            this.sendToClient(clientId, {
                type: 'connection',
                data: { status: 'connected', clientId },
                timestamp: Date.now(),
                clientId
            });
        });

        this.wss.on('error', (error: Error) => {
            console.error('WebSocket server error:', error);
            this.emit('serverError', error);
        });
    }

    private checkHeartbeats() {
        const now = Date.now();
        for (const [clientId, info] of this.clientInfo.entries()) {
            // Skip heartbeat check during grace period
            if (now - info.connectedAt < this.GRACE_PERIOD) {
                continue;
            }

            const missedHeartbeats = Math.floor((now - info.lastPing) / this.HEARTBEAT_INTERVAL);
            if (missedHeartbeats > this.MAX_MISSED_HEARTBEATS) {
                console.log(`Client ${clientId} missed ${missedHeartbeats} heartbeats, closing connection`);
                this.closeClient(clientId);
            }
        }

    }

    private closeClient(clientId: string) {
        const ws = this.clients.get(clientId);
        if (ws) {
            try {
                ws.close();
            } catch (error) {
                console.error(`Error closing WebSocket for client ${clientId}:`, error);
            }
        }
        this.clients.delete(clientId);
        this.clientInfo.delete(clientId);
        this.rateLimits.delete(clientId);
        this.removeClientHandlers(clientId);
        console.log(`Client disconnected: ${clientId}`);
    }

    private updateClientHeartbeat(clientId: string) {
        const info = this.clientInfo.get(clientId);
        if (info) {
            info.lastPing = Date.now();
        }
    }

    private cleanup() {
        const now = Date.now();
        
        // Clean up expired token hashes
        for (const [serialNumber, tokenHash] of this.tokenHashes.entries()) {
            if (now - tokenHash.timestamp > this.TOKEN_HASH_EXPIRY) {
                this.tokenHashes.delete(serialNumber);
            }
        }

        // Clean up rate limits
        for (const [clientId, rateLimit] of this.rateLimits.entries()) {
            if (now - rateLimit.lastReset > this.RATE_LIMIT_WINDOW) {
                this.rateLimits.delete(clientId);
            }
        }

        // Log current connection stats
        console.log('Connection stats:', {
            totalClients: this.clients.size,
            uniqueIPs: new Set([...this.clientInfo.values()].map(info => info.ip)).size
        });
    }

    private removeClientHandlers(clientId: string) {
        // Remove any pending message handlers for this client
        const handlers = this.messageHandlers.get(clientId);
        if (handlers) {
            handlers.forEach((handler: (data: any) => void) => {
                this.removeListener('message', handler);
            });
            this.messageHandlers.delete(clientId);
        }
    }

    private generateClientId(): string {
        return randomBytes(16).toString('hex');
    }

    private verifyToken(token: string): boolean {
        // Skip token verification in development mode
        if (isDev()) {
            console.log('Development mode: Skipping token verification');
            return true;
        }
        // Implement your token verification logic here
        // For now, return true for testing
        return true;
    }

    private checkRateLimit(clientId: string): boolean {
        const now = Date.now();
        const rateLimit = this.rateLimits.get(clientId) || { count: 0, lastReset: now };

        if (now - rateLimit.lastReset > this.RATE_LIMIT_WINDOW) {
            rateLimit.count = 0;
            rateLimit.lastReset = now;
        }

        rateLimit.count++;
        this.rateLimits.set(clientId, rateLimit);

        return rateLimit.count <= this.RATE_LIMIT_MAX;
    }

    private validateMessageStructure(message: any): boolean {
        if (!message || typeof message !== 'object') {
            console.error('Message is not an object:', message);
            return false;
        }

        // Check required fields
        const requiredFields = ['type', 'data', 'timestamp'];
        for (const field of requiredFields) {
            if (!(field in message)) {
                console.error(`Missing required field: ${field}`);
                return false;
            }
        }

        // Validate field types
        if (typeof message.type !== 'string') {
            console.error('Invalid type field:', message.type);
            return false;
        }
        if (typeof message.timestamp !== 'number') {
            console.error('Invalid timestamp field:', message.timestamp);
            return false;
        }

        return true;
    }

    private handleMessage(clientId: string, data: any) {
        try {
            console.log('WebSocket received message:', {
                clientId,
                data,
                timestamp: new Date().toISOString()
            });

            // Validate message structure
            if (!data || typeof data !== 'object') {
                console.error('Invalid message data:', data);
                this.sendToClient(clientId, {
                    type: 'error',
                    data: { 
                        error: 'Invalid message structure'
                    },
                    timestamp: Date.now(),
                    clientId
                });
                return;
            }

            // Handle specific message types
            switch (data.type) {
                case 'ping':
                    this.sendToClient(clientId, { 
                        type: 'pong', 
                        data: { timestamp: Date.now() },
                        timestamp: Date.now(),
                        clientId 
                    });
                    break;
                case 'register-token-hash':
                    console.log('Handling token hash registration:', {
                        clientId,
                        messageData: data.data,
                        currentTokenCount: this.tokenHashes.size
                    });
                    this.handleTokenHashRegistration(clientId, data);
                    break;
                case 'verify-token-hash':
                    this.handleTokenHashVerification(clientId, data);
                    break;
                case 'get-token-hash':
                    this.handleTokenHashRequest(clientId, data);
                    break;
                default:
                    console.log(`Received message from ${clientId}:`, data);
                    // Send acknowledgment for unknown message types
                    this.sendToClient(clientId, {
                        type: 'acknowledgment',
                        data: { 
                            message: 'Message received',
                            originalType: data.type
                        },
                        timestamp: Date.now(),
                        clientId
                    });
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
            this.sendToClient(clientId, {
                type: 'error',
                data: { 
                    error: error instanceof Error ? error.message : 'Unknown error occurred'
                },
                timestamp: Date.now(),
                clientId
            });
        }
    }

    public handleTokenHashRegistration(clientId: string, data: any) {
        console.log('Starting token hash registration:', {
            clientId,
            data,
            currentTokenCount: this.tokenHashes.size,
            currentTokens: Array.from(this.tokenHashes.entries())
        });

        try {
            // Validate message structure
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid message structure');
            }

            // Extract and validate data
            const { serialNumber, hash } = data.data || {};
            
            if (!serialNumber || typeof serialNumber !== 'string') {
                throw new Error('Invalid or missing serial number');
            }

            if (!hash || typeof hash !== 'string') {
                throw new Error('Invalid or missing hash');
            }

            // Check if token already exists
            if (this.tokenHashes.has(serialNumber)) {
                const existingToken = this.tokenHashes.get(serialNumber);
                if (existingToken?.hash === hash) {
                    console.log('Token already registered with same hash:', {
                        serialNumber,
                        hash,
                        timestamp: existingToken.timestamp
                    });
                    // Token already registered with same hash
                    this.sendToClient(clientId, {
                        type: 'token-hash-registered',
                        data: {
                            serialNumber,
                            hash,
                            timestamp: existingToken.timestamp,
                            verifiedBy: existingToken.verifiedBy,
                            status: 'already_registered'
                        },
                        timestamp: Date.now(),
                        clientId
                    });
                    return;
                } else {
                    console.log('Token exists but with different hash:', {
                        serialNumber,
                        existingHash: existingToken?.hash,
                        newHash: hash
                    });
                    // Token exists but with different hash
                    throw new Error('Token already registered with different hash');
                }
            }

            // Create new token hash entry
            const tokenHash = {
                serialNumber,
                hash,
                timestamp: Date.now(),
                verifiedBy: []
            };

            // Store the token hash
            this.tokenHashes.set(serialNumber, tokenHash);
            
            console.log('Token hash stored successfully:', {
                serialNumber,
                hash,
                timestamp: new Date(tokenHash.timestamp).toISOString(),
                verificationCount: 0,
                currentTokenCount: this.tokenHashes.size
            });

            // Send confirmation to the client
            this.sendToClient(clientId, {
                type: 'token-hash-registered',
                data: {
                    serialNumber,
                    hash,
                    timestamp: tokenHash.timestamp,
                    verifiedBy: [],
                    status: 'registered'
                },
                timestamp: Date.now(),
                clientId
            });

            // Broadcast the registration to all other clients
            this.broadcast({
                type: 'token-hash-registered',
                data: {
                    serialNumber,
                    hash,
                    timestamp: tokenHash.timestamp,
                    verifiedBy: [],
                    status: 'broadcast'
                },
                timestamp: Date.now(),
                clientId: 'server'
            });

        } catch (error) {
            console.error('Error in token hash registration:', error);
            this.sendToClient(clientId, {
                type: 'error',
                data: { 
                    error: error instanceof Error ? error.message : 'Unknown error occurred'
                },
                timestamp: Date.now(),
                clientId
            });
        }
    }

    private handleTokenHashVerification(clientId: string, data: any) {
        const { serialNumber, hash } = data.data;
        
        if (!serialNumber || !hash) {
            this.sendToClient(clientId, {
                type: 'error',
                data: { error: 'Invalid token hash verification data' },
                timestamp: Date.now(),
                clientId
            });
            return;
        }

        const storedHash = this.tokenHashes.get(serialNumber);
        
        if (!storedHash) {
            this.sendToClient(clientId, {
                type: 'error',
                data: { error: 'Token hash not found' },
                timestamp: Date.now(),
                clientId
            });
            return;
        }

        const isValid = storedHash.hash === hash;
        
        if (isValid && !storedHash.verifiedBy.includes(clientId)) {
            storedHash.verifiedBy.push(clientId);
        }

        this.sendToClient(clientId, {
            type: 'token-verification-response',
            data: {
                isValid,
                verifiedBy: storedHash.verifiedBy,
                message: isValid ? 'Token verified successfully' : 'Invalid token hash'
            },
            timestamp: Date.now(),
            clientId
        });
    }

    private handleTokenHashRequest(clientId: string, data: any) {
        const { serialNumber } = data.data;
        
        if (!serialNumber) {
            this.sendToClient(clientId, {
                type: 'error',
                data: { error: 'Invalid token hash request' },
                timestamp: Date.now(),
                clientId
            });
            return;
        }

        console.log('Token hashes map:', this.tokenHashes);
        console.log('Requested serialNumber:', serialNumber);

        const tokenHash = this.tokenHashes.get(serialNumber);
        
        if (!tokenHash) {
            this.sendToClient(clientId, {
                type: 'error',
                data: { error: 'Token hash not found' },
                timestamp: Date.now(),
                clientId
            });
            return;
        }

        this.sendToClient(clientId, {
            type: 'token-hash-response',
            data: {
                serialNumber,
                hash: tokenHash.hash,
                timestamp: tokenHash.timestamp,
                verifiedBy: tokenHash.verifiedBy
            },
            timestamp: Date.now(),
            clientId
        });
    }

    private generateTokenHash(serialNumber: string): string {
        // Generate a hash using the serial number and current timestamp
        const timestamp = Date.now();
        const data = `${serialNumber}:${timestamp}`;
        return createHash('sha256').update(data).digest('hex');
    }

    public sendToClient(clientId: string, data: any) {
        const client = this.clients.get(clientId);
        if (!client) {
            console.error(`Client ${clientId} not found`);
            return;
        }

        if (client.readyState !== WebSocket.OPEN) {
            console.error(`Client ${clientId} not in OPEN state (current state: ${client.readyState})`);
            return;
        }

        try {
            const message = {
                type: data.type,
                data: data.data,
                timestamp: data.timestamp || Date.now(),
                clientId: data.clientId || clientId
            };

            const messageStr = JSON.stringify(message);
            client.send(messageStr);
            console.log(`Sent message to client ${clientId}:`, message);
        } catch (error) {
            console.error(`Error sending message to client ${clientId}:`, error);
            // Don't try to send error notification if the client is already closed
            if (client.readyState === WebSocket.OPEN) {
                try {
                    const errorMessage = {
                        type: 'error',
                        data: { 
                            error: error instanceof Error ? error.message : 'Unknown error'
                        },
                        timestamp: Date.now(),
                        clientId
                    };
                    client.send(JSON.stringify(errorMessage));
                } catch (notifyError) {
                    console.error('Failed to send error notification:', notifyError);
                }
            }
        }
    }

    public broadcast(data: any) {
        if (!data || typeof data !== 'object') {
            console.error('Invalid broadcast data:', data);
            return;
        }

        const message = {
            type: data.type,
            data: data.data,
            timestamp: data.timestamp || Date.now(),
            clientId: data.clientId || 'server'
        };

        const messageStr = JSON.stringify(message);
        let successCount = 0;
        let errorCount = 0;

        this.clients.forEach((client, clientId) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(messageStr);
                    successCount++;
                } catch (error) {
                    console.error(`Error broadcasting message to client ${clientId}:`, error);
                    errorCount++;
                }
            }
        });

        console.log(`Broadcast complete: ${successCount} successful, ${errorCount} failed`);
    }

    public getConnectedClients(): string[] {
        return Array.from(this.clients.keys());
    }

    public close() {
        // Close all client connections
        this.clients.forEach((client, clientId) => {
            try {
                client.close();
            } catch (error) {
                console.error(`Error closing client ${clientId}:`, error);
            }
        });
        this.clients.clear();
        this.rateLimits.clear();
        this.tokenHashes.clear();

        // Close the WebSocket server
        this.wss.close(() => {
            console.log('WebSocket server closed');
        });

        // Close the HTTP server
        this.server.close(() => {
            console.log('HTTP server closed');
        });
    }
} 
