import { useState, useRef, useCallback, useEffect } from 'react';

export const useWebRTC = (userId: string, sendMessage: (message: any) => void) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnections] = useState(new Map<string, RTCPeerConnection>());
  const [connectionStates] = useState(new Map<string, string>());
  
  const localStreamRef = useRef<MediaStream | null>(null);

  const createPeerConnection = useCallback((targetId: string, isOfferer: boolean) => {
    console.log(`Creating peer connection for ${targetId}, isOfferer: ${isOfferer}`);
    
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      console.log('ICE candidate generated:', event.candidate);
      if (event.candidate) {
        sendMessage({
          type: 'webrtc-ice-candidate',
          candidate: event.candidate,
          targetId,
          targetType: userId.startsWith('broadcaster') ? 'listener' : 'broadcaster',
          fromId: userId
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Remote track received:', event.streams[0]);
      if (event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${targetId}:`, pc.connectionState);
      connectionStates.set(targetId, pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        console.log('WebRTC connection established successfully');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.log('WebRTC connection failed or disconnected');
        peerConnections.delete(targetId);
        connectionStates.delete(targetId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${targetId}:`, pc.iceConnectionState);
    };

    // Add local stream tracks if we're the broadcaster
    if (localStreamRef.current && userId.startsWith('broadcaster')) {
      console.log('Adding local stream tracks to peer connection');
      localStreamRef.current.getTracks().forEach(track => {
        console.log('Adding track:', track.kind, track.enabled);
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnections.set(targetId, pc);
    return pc;
  }, [userId, sendMessage, peerConnections, connectionStates]);

  const startBroadcast = useCallback(async (deviceId?: string, existingStream?: MediaStream) => {
    try {
      console.log('Starting broadcast with deviceId:', deviceId);
      let stream = existingStream;
      
      if (!stream) {
        const constraints = {
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        };
        console.log('Getting user media with constraints:', constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }

      console.log('Got audio stream:', stream.getAudioTracks());
      setLocalStream(stream);
      localStreamRef.current = stream;

      return stream;
    } catch (error) {
      console.error('Error starting broadcast:', error);
      throw error;
    }
  }, []);

  const stopBroadcast = useCallback(() => {
    console.log('Stopping broadcast');
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    peerConnections.forEach((pc, id) => {
      console.log('Closing peer connection:', id);
      pc.close();
    });
    peerConnections.clear();
    connectionStates.clear();
  }, [peerConnections, connectionStates]);

  const connectToStream = useCallback(async (broadcasterId: string) => {
    try {
      console.log('Connecting to broadcaster:', broadcasterId);
      const pc = createPeerConnection(broadcasterId, true);
      
      console.log('Creating offer...');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      console.log('Setting local description...');
      await pc.setLocalDescription(offer);

      console.log('Sending offer to broadcaster');
      sendMessage({
        type: 'webrtc-offer',
        offer,
        broadcasterId,
        listenerId: userId
      });
    } catch (error) {
      console.error('Error connecting to stream:', error);
      throw error;
    }
  }, [createPeerConnection, sendMessage, userId]);

  const disconnectFromStream = useCallback(() => {
    console.log('Disconnecting from stream');
    peerConnections.forEach((pc, id) => {
      console.log('Closing connection to:', id);
      pc.close();
    });
    peerConnections.clear();
    connectionStates.clear();
    setRemoteStream(null);
  }, [peerConnections, connectionStates]);

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, listenerId: string) => {
    try {
      console.log('Handling offer from listener:', listenerId);
      const pc = createPeerConnection(listenerId, false);
      
      console.log('Setting remote description...');
      await pc.setRemoteDescription(offer);
      
      // Add local stream tracks to the connection
      if (localStreamRef.current) {
        console.log('Adding local tracks to answer connection');
        localStreamRef.current.getTracks().forEach(track => {
          console.log('Adding track for answer:', track.kind);
          pc.addTrack(track, localStreamRef.current!);
        });
      }
      
      console.log('Creating answer...');
      const answer = await pc.createAnswer();
      
      console.log('Setting local description for answer...');
      await pc.setLocalDescription(answer);

      console.log('Sending answer to listener');
      sendMessage({
        type: 'webrtc-answer',
        answer,
        listenerId,
        broadcasterId: userId
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }, [createPeerConnection, sendMessage, userId]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit, broadcasterId: string) => {
    try {
      console.log('Handling answer from broadcaster:', broadcasterId);
      const pc = peerConnections.get(broadcasterId);
      if (pc) {
        console.log('Setting remote description for answer...');
        await pc.setRemoteDescription(answer);
        console.log('Answer processed successfully');
      } else {
        console.error('No peer connection found for broadcaster:', broadcasterId);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }, [peerConnections]);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit, fromId: string) => {
    try {
      console.log('Handling ICE candidate from:', fromId, candidate);
      const pc = peerConnections.get(fromId);
      if (pc && pc.remoteDescription) {
        console.log('Adding ICE candidate...');
        await pc.addIceCandidate(candidate);
        console.log('ICE candidate added successfully');
      } else {
        console.error('Cannot add ICE candidate - no peer connection or remote description:', fromId);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }, [peerConnections]);

  return {
    localStream,
    remoteStream,
    peerConnections,
    startBroadcast,
    stopBroadcast,
    connectToStream,
    disconnectFromStream,
    handleOffer,
    handleAnswer,
    handleIceCandidate
  };
};
