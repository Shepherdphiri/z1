import { useState, useCallback, useRef } from 'react';

interface SimpleWebRTCHookReturn {
  isConnected: boolean;
  remoteStream: MediaStream | null;
  startBroadcast: (stream: MediaStream) => void;
  stopBroadcast: () => void;
  joinBroadcast: (broadcasterId: string) => void;
  leaveBroadcast: () => void;
}

export const useSimpleWebRTC = (
  websocket: WebSocket | null,
  userId: string
): SimpleWebRTCHookReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const isBroadcaster = useRef<boolean>(false);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && websocket) {
        websocket.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          from: userId
        }));
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track');
      setRemoteStream(event.streams[0]);
      setIsConnected(true);
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnected(true);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setIsConnected(false);
      }
    };

    return pc;
  }, [websocket, userId]);

  const startBroadcast = useCallback((stream: MediaStream) => {
    console.log('Starting broadcast with stream');
    localStream.current = stream;
    isBroadcaster.current = true;
    
    if (websocket) {
      websocket.send(JSON.stringify({
        type: 'start-broadcast',
        broadcasterId: userId
      }));
    }
  }, [websocket, userId]);

  const stopBroadcast = useCallback(() => {
    console.log('Stopping broadcast');
    isBroadcaster.current = false;
    
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    
    if (websocket) {
      websocket.send(JSON.stringify({
        type: 'stop-broadcast',
        broadcasterId: userId
      }));
    }
    
    setIsConnected(false);
  }, [websocket, userId]);

  const joinBroadcast = useCallback(async (broadcasterId: string) => {
    console.log('Joining broadcast from:', broadcasterId);
    
    peerConnection.current = createPeerConnection();
    
    try {
      // Create offer as listener
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      await peerConnection.current.setLocalDescription(offer);
      
      if (websocket) {
        websocket.send(JSON.stringify({
          type: 'join-broadcast',
          broadcasterId,
          listenerId: userId,
          offer
        }));
      }
    } catch (error) {
      console.error('Error joining broadcast:', error);
    }
  }, [createPeerConnection, websocket, userId]);

  const leaveBroadcast = useCallback(() => {
    console.log('Leaving broadcast');
    
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    
    setRemoteStream(null);
    setIsConnected(false);
  }, []);

  // Handle WebSocket messages
  if (websocket) {
    websocket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      console.log('Received message:', message.type);

      switch (message.type) {
        case 'listener-wants-to-join':
          if (isBroadcaster.current && localStream.current) {
            console.log('Listener wants to join, creating answer');
            
            peerConnection.current = createPeerConnection();
            
            // Add local stream to connection
            localStream.current.getTracks().forEach(track => {
              if (peerConnection.current && localStream.current) {
                peerConnection.current.addTrack(track, localStream.current);
              }
            });
            
            // Set remote description and create answer
            await peerConnection.current.setRemoteDescription(message.offer);
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            
            websocket.send(JSON.stringify({
              type: 'broadcast-answer',
              answer,
              broadcasterId: userId,
              listenerId: message.listenerId
            }));
          }
          break;

        case 'broadcast-answer':
          if (peerConnection.current && message.listenerId === userId) {
            console.log('Received broadcast answer');
            await peerConnection.current.setRemoteDescription(message.answer);
          }
          break;

        case 'ice-candidate':
          if (peerConnection.current && message.from !== userId) {
            console.log('Adding ICE candidate');
            await peerConnection.current.addIceCandidate(message.candidate);
          }
          break;
      }
    };
  }

  return {
    isConnected,
    remoteStream,
    startBroadcast,
    stopBroadcast,
    joinBroadcast,
    leaveBroadcast
  };
};