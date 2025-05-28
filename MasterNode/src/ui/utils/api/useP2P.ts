// import { useState, useEffect } from 'react';
// import { P2P_MESSAGE_TYPES } from './config';
// import { p2pService } from './p2p';

// export const useP2P = () => {
//   const [nodes, setNodes] = useState<any[]>([]);
//   const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
//   const [error, setError] = useState<string | null>(null);

//   const handleMessage = (message: any) => {
//     try {
//       // Handle port messages
//       if (message.sender && message.ports) {
//         console.log('[P2P Hook] Received port message, skipping type validation');
//         return;
//       }

//       // Extract message from args if it's wrapped in an IPC message
//       const actualMessage = message.args?.[0] || message;

//       if (!actualMessage || typeof actualMessage !== 'object') {
//         console.error('[P2P Hook] Invalid message data:', actualMessage);
//         return;
//       }

//       if (!actualMessage.type) {
//         console.error('[P2P Hook] Message missing type field:', actualMessage);
//         return;
//       }

//       // Validate message type
//       const validTypes = Object.values(P2P_MESSAGE_TYPES);
//       if (!validTypes.includes(actualMessage.type)) {
//         console.warn(`[P2P Hook] Unknown message type: ${actualMessage.type}`);
//         return;
//       }

//       // Process the message
//       const formattedMessage = {
//         type: actualMessage.type,
//         data: actualMessage.data || {},
//         timestamp: actualMessage.timestamp || new Date().toISOString(),
//         success: actualMessage.success !== undefined ? actualMessage.success : !actualMessage.error
//       };

//       // Update state based on message type
//       switch (formattedMessage.type) {
//         case P2P_MESSAGE_TYPES.NODES_RESPONSE:
//           setNodes(formattedMessage.data.nodes || []);
//           break;
//         case P2P_MESSAGE_TYPES.NODE_CONNECTED:
//           setConnectionStatus('connected');
//           break;
//         case P2P_MESSAGE_TYPES.NODE_DISCONNECTED:
//           setConnectionStatus('disconnected');
//           break;
//         case P2P_MESSAGE_TYPES.ERROR:
//           setError(formattedMessage.data.error || 'Unknown error');
//           break;
//         default:
//           // Handle other message types
//           break;
//       }
//     } catch (error) {
//       console.error('[P2P Hook] Error handling message:', error);
//     }
//   };

//   useEffect(() => {
//     // Set up message listener
//     p2pService.onMessage(P2P_MESSAGE_TYPES.NODES_RESPONSE, handleMessage);
//     p2pService.onMessage(P2P_MESSAGE_TYPES.NODE_CONNECTED, handleMessage);
//     p2pService.onMessage(P2P_MESSAGE_TYPES.NODE_DISCONNECTED, handleMessage);
//     p2pService.onMessage(P2P_MESSAGE_TYPES.ERROR, handleMessage);

//     // Clean up listeners
//     return () => {
//       p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.NODES_RESPONSE);
//       p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.NODE_CONNECTED);
//       p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.NODE_DISCONNECTED);
//       p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.ERROR);
//     };
//   }, []);

//   return {
//     nodes,
//     connectionStatus,
//     error,
//     sendMessage: p2pService.sendMessage.bind(p2pService)
//   };
// }; 