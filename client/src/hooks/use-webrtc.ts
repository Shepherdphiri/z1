import { useState, useRef, useCallback } from 'react';

export const useWebRTC = (userId: string, sendMessage: (message: any) => void) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnections] = useState(new Map<string, RTCPeerConnection>());
  
  const localStreamRef = useRef<MediaStream | null>(null);

  const createPeerConnection = useCallback((targetId: string) => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
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
      if (event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        peerConnections.delete(targetId);
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnections.set(targetId, pc);
    return pc;
  }, [userId, sendMessage, peerConnections]);

  const startBroadcast = useCallback(async (deviceId?: string, existingStream?: MediaStream) => {
    try {
      let stream = existingStream;
      
      if (!stream) {
        const constraints = {
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
          video: false
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }

      setLocalStream(stream);
      localStreamRef.current = stream;

      // Add tracks to all existing peer connections
      peerConnections.forEach((pc) => {
        stream!.getTracks().forEach(track => {
          pc.addTrack(track, stream!);
        });
      });

      return stream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }, [peerConnections]);

  const stopBroadcast = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    peerConnections.forEach((pc) => {
      pc.close();
    });
    peerConnections.clear();
  }, [peerConnections]);

  const connectToStream = useCallback(async (broadcasterId: string) => {
    try {
      const pc = createPeerConnection(broadcasterId);
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

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
    peerConnections.forEach((pc) => {
      pc.close();
    });
    peerConnections.clear();
    setRemoteStream(null);
  }, [peerConnections]);

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, listenerId: string) => {
    try {
      const pc = createPeerConnection(listenerId);
      
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

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
      const pc = peerConnections.get(broadcasterId);
      if (pc) {
        await pc.setRemoteDescription(answer);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }, [peerConnections]);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit, fromId: string) => {
    try {
      const pc = peerConnections.get(fromId);
      if (pc) {
        await pc.addIceCandidate(candidate);
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
