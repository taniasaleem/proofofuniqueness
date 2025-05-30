import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from 'url';
import { isDev } from "./util.js";
import fs from 'fs';
import type { WriteStream } from 'fs';
import { P2PService } from './p2p.js';
import { promises as fsPromises } from 'fs';

// Get the application data directory
const getAppDataPath = () => {
  // In development, use the project directory
  return path.join(process.cwd(), 'MasterNode')
}

// Ensure directory exists
const ensureDirectoryExists = (dirPath: string) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 })
      console.log('Created directory:', dirPath)
    }
  } catch (error) {
    console.error('Error creating directory:', dirPath, error)
    throw error
  }
}

// Initialize application directories
let appDataPath = getAppDataPath()
console.log('Application data path:', appDataPath)

try {
  ensureDirectoryExists(appDataPath)
} catch (error) {
  console.error('Failed to create application directory:', error)
  // Fallback to user's home directory if app directory fails
  const homeDir = process.env.HOME || process.env.USERPROFILE
  if (homeDir) {
    const fallbackPath = path.join(homeDir, '.masternode')
    console.log('Using fallback directory:', fallbackPath)
    ensureDirectoryExists(fallbackPath)
    appDataPath = fallbackPath
  } else {
    throw new Error('Could not determine application data directory')
  }
}

// Set up log file path
const LOG_FILE = path.join(appDataPath, 'electron.log')

// Initialize logging
function initializeLogging() {
  try {
    // Create log file if it doesn't exist
    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, '', { mode: 0o644 })
      console.log('Created log file:', LOG_FILE)
    }
    
    // Test write access
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] Logging initialized\n`)
    console.log('Logging initialized at:', LOG_FILE)
  } catch (error) {
    console.error('Failed to initialize logging:', error)
    // Try to create the file again with different permissions
    try {
      fs.writeFileSync(LOG_FILE, '', { mode: 0o666 })
      console.log('Created log file with alternative permissions:', LOG_FILE)
    } catch (retryError) {
      console.error('Failed to create log file even with alternative permissions:', retryError)
    }
  }
}

// Initialize logging
initializeLogging()

// Test logging
console.log('Application data path:', appDataPath)
console.log('Log file path:', LOG_FILE)

export function logToFile(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message} ${data ? JSON.stringify(data, null, 2) : ''}\n`;
  
  // Always log to console
  console.log(`[Main] ${message}`, data ? data : '');
  
  // Log to file
  try {
    fs.appendFileSync(LOG_FILE, logMessage);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

let p2pService: P2PService | null = null;
let isP2PInitialized = false;

// Get the directory path using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getPreloadPath = () => {
  // In development, preload.js will be in the same directory as main.js
  // In production, it will be in resources/app/build-electron
  if (app.isPackaged) {
    const preloadPath = path.join(process.resourcesPath, 'app', 'build-electron', 'preload.js');
    console.log('[Main] Production preload path:', preloadPath);
    return preloadPath;
  } else {
    const preloadPath = path.join(__dirname, 'preload.js');
    console.log('[Main] Development preload path:', preloadPath);
    return preloadPath;
  }
};

let mainWindow: BrowserWindow | null = null;

// Initialize P2P service
async function initializeP2PService() {
  try {
    console.log('[Main] Starting P2P service initialization...');
    logToFile('Starting P2P service initialization');
    
    p2pService = new P2PService();
    
    // Create a promise that will be resolved when initialization is complete
    const initPromise = new Promise<void>((resolve, reject) => {
      // Set up progress tracking
      let progressInterval = setInterval(() => {
        if (p2pService) {
          const status = p2pService.getInitializationStatus();
          console.log('[Main] P2P initialization status:', status);
          logToFile('P2P initialization status', status);
        }
      }, 2000); // Log status every 2 seconds

      // Wait for initialization with timeout
      const initTimeout = setTimeout(() => {
        clearInterval(progressInterval);
        reject(new Error('P2P service initialization timed out'));
      }, 60000); // Increase timeout to 60 seconds

      // Wait for the service to be ready
      if (!p2pService) {
        clearTimeout(initTimeout);
        clearInterval(progressInterval);
        reject(new Error('P2P service instance is null'));
        return;
      }

      p2pService.waitForReady()
        .then(() => {
          clearTimeout(initTimeout);
          clearInterval(progressInterval);
          resolve();
        })
        .catch((error) => {
          clearTimeout(initTimeout);
          clearInterval(progressInterval);
          reject(error);
        });
    });

    // Wait for initialization to complete
    await initPromise;
    
    // Verify service is ready
    if (!p2pService || !p2pService.isConnected()) {
      throw new Error('P2P service failed to initialize properly');
    }
    
    isP2PInitialized = true;
    console.log('[Main] P2P service initialization completed successfully');
    logToFile('P2P service initialization completed successfully');
    
    // Set up peer connection handlers after successful initialization
    if (p2pService) {
      p2pService.onPeerConnect((peerId) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('p2p-message', {
            type: 'peer-connected',
            success: true,
            data: { peerId },
            timestamp: new Date().toISOString()
          });
        }
      });

      p2pService.onPeerDisconnect((peerId) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('p2p-message', {
            type: 'peer-disconnected',
            success: true,
            data: { peerId },
            timestamp: new Date().toISOString()
          });
        }
      });
    }
  } catch (error) {
    console.error('[Main] Failed to initialize P2P service:', error);
    logToFile('Failed to initialize P2P service', { error: error instanceof Error ? error.message : String(error) });
    isP2PInitialized = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('p2p:error', { 
        message: 'Failed to initialize P2P service. Some features may be limited.',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    throw error; // Re-throw to handle it in the calling code
  }
}

async function createWindow() {
  
  // Get and verify preload script path
  const preloadPath = path.join(__dirname, 'preload.js');
  // preloadPath = getPreloadPath();
  console.log('[Main] Using preload script at:', preloadPath);
  
  try {
    await fsPromises.access(preloadPath);
    console.log('[Main] Preload script found successfully');
  } catch (error) {
    console.error('[Main] Preload script not found:', error);
    console.error('[Main] Current directory:', __dirname);
    console.error('[Main] Is packaged:', app.isPackaged);
    throw new Error('Preload script not found');
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: true
    }
  });


  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline' https:",
          "style-src-elem 'self' 'unsafe-inline' https: data:",
          "font-src 'self' data: https:",
          "img-src 'self' data: https:",
          "connect-src 'self' ws: wss: http: https:"
        ].join('; ')
      }
    });
  });


  // Initialize P2P service before loading the app
  await initializeP2PService();

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(app.getAppPath(), 'build-react', 'index.html');
    await mainWindow.loadFile(indexPath);
  }

  // Test P2P service integration
  mainWindow.webContents.on('did-finish-load', () => {
    logToFile('Window loaded, did-finish-load');
    if (mainWindow && p2pService) {
      logToFile('Window loaded, did-finish-load, testing P2P service...');
      console.log('Testing P2P service...');
      console.log('P2P service connected:', p2pService.isConnected());
      console.log('Current peers:', p2pService.getPeers());
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Add debug logging function
const debugLog = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data ? data : '');
};

// P2P message handlers
ipcMain.on('p2p-send', async (event, message) => {
  try {
    if (!isP2PInitialized || !p2pService) {
      throw new Error('P2P service not initialized');
    }

    debugLog('Received P2P send request:', message);

    if (!message || !message.type) {
      throw new Error('Invalid message format');
    }

    // Check connection status before sending
    if (!p2pService.isConnected()) {
      throw new Error('P2P service not ready');
    }

    const response = await p2pService.handleMessage(message);
    debugLog('Sending P2P response:', response);
    
    if (response.success) {
      event.reply('p2p-message', response);
    } else {
      event.reply('p2p-error', response);
    }
  } catch (error) {
    debugLog('Error handling P2P message:', error);
    const errorResponse = {
      type: message?.type || 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      success: false
    };
    debugLog('Sending P2P error response:', errorResponse);
    event.reply('p2p-error', errorResponse);
  }
});

ipcMain.on('p2p-get-peers', async (event) => {
  try {
    if (!p2pService) {
      throw new Error('P2P service not initialized');
    }
    debugLog('Received get-peers request');
    const peers = p2pService.getPeers();
    const response = {
      type: 'peers-response',
      success: true,
      data: peers,
      timestamp: new Date().toISOString()
    };
    debugLog('Sending peers response:', response);
    event.reply('p2p-message', response);
  } catch (error) {
    debugLog('Error getting peers:', error);
    const errorResponse = {
      type: 'peers-response',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
    debugLog('Sending peers error response:', errorResponse);
    event.reply('p2p-error', errorResponse);
  }
});

// Set up peer connection handlers
// if (p2pService) {
//   p2pService.node.addEventListener('peer:connect', (evt: any) => {
//     const peerId = evt.detail.toString();
//     if (mainWindow && !mainWindow.isDestroyed()) {
//       const message = {
//         type: 'peer-connected',
//         success: true,
//         data: {
//           peerId,
//           timestamp: new Date().toISOString()
//         },
//         timestamp: new Date().toISOString()
//       };
//       console.log('[P2P IPC] Peer connected:', message);
//       mainWindow.webContents.send('p2p-message', message);
//     }
//   });

//   p2pService.node.addEventListener('peer:disconnect', (evt: any) => {
//     const peerId = evt.detail.toString();
//     if (mainWindow && !mainWindow.isDestroyed()) {
//       const message = {
//         type: 'peer-disconnected',
//         success: true,
//         data: {
//           peerId,
//           timestamp: new Date().toISOString()
//         },
//         timestamp: new Date().toISOString()
//       };
//       console.log('[P2P IPC] Peer disconnected:', message);
//       mainWindow.webContents.send('p2p-message', message);
//     }
//   });
// } 
