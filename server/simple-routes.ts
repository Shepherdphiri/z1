import { Express } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface Connection {
  ws: WebSocket;
  id: string;
  type: 'broadcaster' | 'listener';
}

const connections = new Map<string, Connection>();
const broadcasters = new Set<string>();

export function setupSimpleWebRTC(app: Express, server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket connection established');
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('Received message:', message.type);
        
        switch (message.type) {
          case 'start-broadcast':
            handleStartBroadcast(ws, message);
            break;
            
          case 'stop-broadcast':
            handleStopBroadcast(message);
            break;
            
          case 'join-broadcast':
            handleJoinBroadcast(ws, message);
            break;
            
          case 'broadcast-answer':
            handleBroadcastAnswer(message);
            break;
            
          case 'ice-candidate':
            handleIceCandidate(message);
            break;
            
          case 'get-broadcasters':
            handleGetBroadcasters(ws);
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      // Clean up connections
      const entries = Array.from(connections.entries());
      for (const [id, conn] of entries) {
        if (conn.ws === ws) {
          connections.delete(id);
          broadcasters.delete(id);
          break;
        }
      }
    });
  });

  function handleStartBroadcast(ws: WebSocket, message: any) {
    const { broadcasterId } = message;
    console.log('Starting broadcast for:', broadcasterId);
    
    connections.set(broadcasterId, {
      ws,
      id: broadcasterId,
      type: 'broadcaster'
    });
    
    broadcasters.add(broadcasterId);
    
    // Notify all connections about new broadcaster
    broadcastToAll({
      type: 'broadcaster-online',
      broadcasterId
    });
  }

  function handleStopBroadcast(message: any) {
    const { broadcasterId } = message;
    console.log('Stopping broadcast for:', broadcasterId);
    
    connections.delete(broadcasterId);
    broadcasters.delete(broadcasterId);
    
    // Notify all connections
    broadcastToAll({
      type: 'broadcaster-offline',
      broadcasterId
    });
  }

  function handleJoinBroadcast(ws: WebSocket, message: any) {
    const { broadcasterId, listenerId, offer } = message;
    console.log('Listener joining broadcast:', listenerId, '->', broadcasterId);
    
    // Store listener connection
    connections.set(listenerId, {
      ws,
      id: listenerId,
      type: 'listener'
    });
    
    // Forward join request to broadcaster
    const broadcasterConn = connections.get(broadcasterId);
    if (broadcasterConn) {
      broadcasterConn.ws.send(JSON.stringify({
        type: 'listener-wants-to-join',
        listenerId,
        offer
      }));
    }
  }

  function handleBroadcastAnswer(message: any) {
    const { broadcasterId, listenerId, answer } = message;
    console.log('Forwarding answer from broadcaster to listener');
    
    const listenerConn = connections.get(listenerId);
    if (listenerConn) {
      listenerConn.ws.send(JSON.stringify({
        type: 'broadcast-answer',
        broadcasterId,
        listenerId,
        answer
      }));
    }
  }

  function handleIceCandidate(message: any) {
    const { from, candidate } = message;
    console.log('Forwarding ICE candidate from:', from);
    
    // Forward to all other connections
    const entries = Array.from(connections.entries());
    for (const [id, conn] of entries) {
      if (id !== from && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify({
          type: 'ice-candidate',
          from,
          candidate
        }));
      }
    }
  }

  function handleGetBroadcasters(ws: WebSocket) {
    console.log('Sending broadcaster list');
    ws.send(JSON.stringify({
      type: 'broadcasters-list',
      broadcasters: Array.from(broadcasters)
    }));
  }

  function broadcastToAll(message: any) {
    const messageStr = JSON.stringify(message);
    const values = Array.from(connections.values());
    for (const conn of values) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(messageStr);
      }
    }
  }

  // API endpoints
  app.get('/api/broadcasters', (req, res) => {
    res.json({
      broadcasters: Array.from(broadcasters)
    });
  });
}