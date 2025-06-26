import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";

interface BroadcasterConnection {
  ws: WebSocket;
  broadcasterId: string;
}

interface ListenerConnection {
  ws: WebSocket;
  listenerId: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for signaling
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const broadcasters = new Map<string, BroadcasterConnection>();
  const listeners = new Map<string, ListenerConnection>();
  
  wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established');
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'register-broadcaster':
            const broadcasterId = message.broadcasterId;
            broadcasters.set(broadcasterId, { ws, broadcasterId });
            
            // Create broadcast record
            await storage.createBroadcast({
              broadcasterId,
              isActive: true
            });
            
            ws.send(JSON.stringify({
              type: 'broadcaster-registered',
              broadcasterId
            }));
            
            // Notify all listeners about new broadcaster
            listeners.forEach((listener) => {
              if (listener.ws.readyState === WebSocket.OPEN) {
                listener.ws.send(JSON.stringify({
                  type: 'broadcaster-available',
                  broadcasterId
                }));
              }
            });
            break;
            
          case 'register-listener':
            const listenerId = message.listenerId;
            listeners.set(listenerId, { ws, listenerId });
            
            ws.send(JSON.stringify({
              type: 'listener-registered',
              listenerId
            }));
            
            // Send list of active broadcasters
            const activeBroadcasters = Array.from(broadcasters.keys());
            ws.send(JSON.stringify({
              type: 'active-broadcasters',
              broadcasters: activeBroadcasters
            }));
            break;
            
          case 'webrtc-offer':
            const targetBroadcaster = broadcasters.get(message.broadcasterId);
            if (targetBroadcaster && targetBroadcaster.ws.readyState === WebSocket.OPEN) {
              targetBroadcaster.ws.send(JSON.stringify({
                type: 'webrtc-offer',
                offer: message.offer,
                listenerId: message.listenerId
              }));
            }
            break;
            
          case 'webrtc-answer':
            const targetListener = listeners.get(message.listenerId);
            if (targetListener && targetListener.ws.readyState === WebSocket.OPEN) {
              targetListener.ws.send(JSON.stringify({
                type: 'webrtc-answer',
                answer: message.answer,
                broadcasterId: message.broadcasterId
              }));
            }
            break;
            
          case 'webrtc-ice-candidate':
            if (message.targetType === 'broadcaster') {
              const broadcaster = broadcasters.get(message.targetId);
              if (broadcaster && broadcaster.ws.readyState === WebSocket.OPEN) {
                broadcaster.ws.send(JSON.stringify({
                  type: 'webrtc-ice-candidate',
                  candidate: message.candidate,
                  fromId: message.fromId
                }));
              }
            } else if (message.targetType === 'listener') {
              const listener = listeners.get(message.targetId);
              if (listener && listener.ws.readyState === WebSocket.OPEN) {
                listener.ws.send(JSON.stringify({
                  type: 'webrtc-ice-candidate',
                  candidate: message.candidate,
                  fromId: message.fromId
                }));
              }
            }
            break;
            
          case 'stop-broadcast':
            const stoppedBroadcasterId = message.broadcasterId;
            broadcasters.delete(stoppedBroadcasterId);
            
            // Update broadcast record
            await storage.stopBroadcast(stoppedBroadcasterId);
            
            // Notify all listeners
            listeners.forEach((listener) => {
              if (listener.ws.readyState === WebSocket.OPEN) {
                listener.ws.send(JSON.stringify({
                  type: 'broadcaster-stopped',
                  broadcasterId: stoppedBroadcasterId
                }));
              }
            });
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      // Clean up connections
      for (const [id, broadcaster] of Array.from(broadcasters.entries())) {
        if (broadcaster.ws === ws) {
          broadcasters.delete(id);
          storage.stopBroadcast(id);
          
          // Notify listeners
          listeners.forEach((listener) => {
            if (listener.ws.readyState === WebSocket.OPEN) {
              listener.ws.send(JSON.stringify({
                type: 'broadcaster-stopped',
                broadcasterId: id
              }));
            }
          });
          break;
        }
      }
      
      for (const [id, listener] of Array.from(listeners.entries())) {
        if (listener.ws === ws) {
          listeners.delete(id);
          break;
        }
      }
    });
  });
  
  // API routes
  app.get('/api/broadcasts/active', async (req, res) => {
    try {
      const activeBroadcasts = await storage.getActiveBroadcasts();
      res.json(activeBroadcasts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch active broadcasts' });
    }
  });
  
  app.get('/api/stats', async (req, res) => {
    try {
      const stats = {
        activeBroadcasters: broadcasters.size,
        connectedListeners: listeners.size
      };
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  return httpServer;
}
