import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from 'url';
import { isDev } from "./util.js";
import { WebSocketService } from "./websocket.js";
import fs from 'fs';

// Get the directory path using import.meta.url
const getAppPath = () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return isDev() ? process.cwd() : app.getAppPath();
};

let mainWindow: BrowserWindow;
let wsService: WebSocketService;

app.on("ready", () => {
  const preloadPath = path.join(getAppPath(), 'build-electron', 'preload.js');
  console.log('Loading preload script from:', preloadPath);

  // Check if preload script exists
  if (!fs.existsSync(preloadPath)) {
    console.error('Preload script not found at:', preloadPath);
    throw new Error('Preload script not found');
  }

  console.log('Preload script found and will be loaded');
  // Log the contents of the preload script
  try {
    const preloadContent = fs.readFileSync(preloadPath, 'utf8');
    console.log('Preload script contents:', preloadContent);
  } catch (error) {
    console.error('Error reading preload script:', error);
    throw error;
  }

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      // Add additional debugging options
      devTools: true
    }
  });

  // Add error handling for preload script
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load preload script:', errorDescription);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window loaded successfully');
    // Check if electron API is available in the renderer
    mainWindow.webContents.executeJavaScript(`
      console.log('Checking electron API availability:', !!window.electron);
      console.log('Window state at did-finish-load:', {
        hasElectron: !!window.electron,
        windowKeys: Object.keys(window),
        electronKeys: window.electron ? Object.keys(window.electron) : [],
        electronMethods: window.electron?.ipcRenderer ? Object.keys(window.electron.ipcRenderer) : []
      });
      
      // Test the IPC API
      if (window.electron?.ipcRenderer) {
        console.log('Testing IPC API...');
        try {
          window.electron.ipcRenderer.send('ws-get-clients', { requestId: Date.now() });
          console.log('IPC send test successful');
        } catch (error) {
          console.error('IPC send test failed:', error);
        }
      }
    `).catch(error => {
      console.error('Error checking electron API:', error);
    });
  });

  // Initialize WebSocket service
  try {
    // Try to initialize WebSocket service with port 8080
    const initializeWebSocket = (port: number) => {
      try {
        wsService = new WebSocketService(port);
        console.log(`WebSocket service initialized successfully on port ${port}`);

        // Handle WebSocket events
        wsService.on('message', (clientId: string, data: any) => {
          mainWindow.webContents.send('ws-message', { clientId, data });
        });

        wsService.on('clientConnected', (clientId: string) => {
          console.log('Client connected:', clientId);
          mainWindow.webContents.send('ws-client-connected', clientId);
        });

        wsService.on('clientDisconnected', (clientId: string) => {
          console.log('Client disconnected:', clientId);
          mainWindow.webContents.send('ws-client-disconnected', clientId);
        });

        // IPC handlers for WebSocket communication
        ipcMain.on('ws-send', (event, message) => {
          console.log('Received WebSocket message to send:', message);
          if (!message || !message.type) {
            console.error('Invalid WebSocket message:', message);
            return;
          }

          try {
            // Handle registration messages directly
            if (message.type === 'register-token-hash') {
              console.log('Processing registration message:', message);
              wsService.handleTokenHashRegistration(message.clientId, message);
              return;
            }

            if (message.clientId) {
              console.log('Sending message to specific client:', message.clientId);
              wsService.sendToClient(message.clientId, message);
            } else {
              console.log('Broadcasting message to all clients');
              wsService.broadcast(message);
            }
          } catch (error) {
            console.error('Error sending WebSocket message:', error);
            mainWindow.webContents.send('ws-error', { 
              message: 'Failed to send WebSocket message',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        });

        ipcMain.on('ws-get-clients', (event, _data) => {
          // console.log('Getting connected clients');
          const clients = wsService.getConnectedClients();
          // console.log('Connected clients:', clients);
          event.reply('ws-clients-list', clients);
        });

        return true;
      } catch (error) {
        console.error(`Failed to initialize WebSocket service on port ${port}:`, error);
        return false;
      }
    };

    // Try ports 8080-8090
    let port = 8080;
    let initialized = false;
    while (port <= 8090 && !initialized) {
      initialized = initializeWebSocket(port);
      if (!initialized) {
        port++;
      }
    }

    if (!initialized) {
      throw new Error('Failed to initialize WebSocket service on any port between 8080-8090');
    }
  } catch (error) {
    console.error('Failed to initialize WebSocket service:', error);
    mainWindow.webContents.send('ws-error', { message: 'Failed to initialize WebSocket service' });
  }

  if (isDev()) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.setMenu(null);
    mainWindow.loadFile(
      path.join(getAppPath(), "build-react", "index.html")
    );
  }
});

app.on('window-all-closed', () => {
  if (wsService) {
    wsService.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // Recreate the window if it was closed
    app.emit('ready');
  }
});
