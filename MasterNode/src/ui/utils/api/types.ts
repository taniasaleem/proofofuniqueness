// Electron IPC types
export interface IpcRenderer {
  send: (channel: string, data: any) => void;
  on: (channel: string, func: (...args: any[]) => void) => void;
  removeListener: (channel: string, func: (...args: any[]) => void) => void;
}

export interface ElectronAPI {
  ipcRenderer: IpcRenderer;
}

// Extend the Window interface
declare global {
  interface Window {
    electron?: ElectronAPI;
  }
} 