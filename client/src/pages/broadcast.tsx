import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Mic, MicOff, Play, Square, Users, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWebSocket } from "@/hooks/use-websocket";
import { useWebRTC } from "@/hooks/use-webrtc";
import { useAudioManager } from "@/hooks/use-audio-manager";
import { AudioVisualizer } from "@/components/audio-visualizer";
import { useToast } from "@/hooks/use-toast";

export default function BroadcastPage() {
  const [, setLocation] = useLocation();
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [listenersCount, setListenersCount] = useState(0);
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("");
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const { toast } = useToast();

  const broadcasterId = `broadcaster-${Date.now()}`;
  
  const { 
    isConnected: wsConnected, 
    sendMessage,
    lastMessage 
  } = useWebSocket();

  const {
    localStream,
    peerConnections,
    startBroadcast: startWebRTCBroadcast,
    stopBroadcast: stopWebRTCBroadcast,
    handleOffer,
    handleIceCandidate
  } = useWebRTC(broadcasterId, sendMessage);

  const {
    audioLevel,
    isActive: isAudioActive,
    microphonePermission,
    currentStream,
    startAudio,
    stopAudio
  } = useAudioManager(selectedMicrophone);

  // Get available microphones
  useEffect(() => {
    const getMicrophones = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(device => device.kind === 'audioinput');
        setMicrophones(mics);
        if (mics.length > 0 && !selectedMicrophone) {
          setSelectedMicrophone(mics[0].deviceId);
        }
      } catch (error) {
        console.error('Error getting microphones:', error);
      }
    };

    getMicrophones();
  }, [selectedMicrophone]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      const message = JSON.parse(lastMessage.data);
      
      switch (message.type) {
        case 'webrtc-offer':
          if (localStream && message.offer && message.listenerId) {
            handleOffer(message.offer, message.listenerId);
          }
          break;
        case 'webrtc-ice-candidate':
          if (message.candidate && message.fromId) {
            handleIceCandidate(message.candidate, message.fromId);
          }
          break;
      }
    }
  }, [lastMessage, localStream, handleOffer, handleIceCandidate]);

  // Update listeners count based on peer connections
  useEffect(() => {
    setListenersCount(peerConnections.size);
  }, [peerConnections]);

  const handleStartBroadcast = async () => {
    try {
      if (!wsConnected) {
        toast({
          title: "Connection Error",
          description: "WebSocket not connected. Please refresh the page.",
          variant: "destructive"
        });
        return;
      }

      if (microphonePermission !== 'granted') {
        toast({
          title: "Microphone Permission Required",
          description: "Please allow microphone access to start broadcasting.",
          variant: "destructive"
        });
        return;
      }

      // Use current stream or start new one for broadcasting
      let broadcastStream = currentStream;
      if (!broadcastStream) {
        broadcastStream = await startAudio(true);
        if (!broadcastStream) {
          throw new Error('Failed to access microphone');
        }
      }
      
      await startWebRTCBroadcast(selectedMicrophone, broadcastStream);
      
      // Register as broadcaster
      sendMessage({
        type: 'register-broadcaster',
        broadcasterId
      });

      setIsBroadcasting(true);
      
      toast({
        title: "Broadcasting Started",
        description: "You are now live! Listeners can connect to your stream."
      });
    } catch (error) {
      console.error('Error starting broadcast:', error);
      toast({
        title: "Broadcast Error",
        description: "Failed to start broadcasting. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleStopBroadcast = () => {
    try {
      stopWebRTCBroadcast();
      
      // Notify server
      sendMessage({
        type: 'stop-broadcast',
        broadcasterId
      });

      setIsBroadcasting(false);
      
      // Restart audio preview after stopping broadcast
      if (selectedMicrophone) {
        setTimeout(() => {
          startAudio(false);
        }, 500);
      }
      
      toast({
        title: "Broadcast Stopped",
        description: "Your broadcast has ended."
      });
    } catch (error) {
      console.error('Error stopping broadcast:', error);
    }
  };

  // Start audio preview when microphone is selected
  useEffect(() => {
    if (selectedMicrophone && !isBroadcasting && !isAudioActive) {
      startAudio(false);
    }
  }, [selectedMicrophone, isBroadcasting, isAudioActive, startAudio]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pb-20">
      {/* Navigation Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-white rounded-lg shadow-lg p-2 flex gap-2">
          <Button 
            variant="default" 
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Broadcast
          </Button>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => setLocation('/listen')}
          >
            Listen
          </Button>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mic className="text-2xl text-blue-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Start Broadcasting</h1>
          <p className="text-slate-600 text-sm">Share your voice with listeners worldwide</p>
        </div>

        {/* Broadcast Status */}
        <div className="mb-6">
          <div className="flex items-center justify-center p-4 bg-slate-100 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                isBroadcasting 
                  ? 'bg-red-500 animate-pulse' 
                  : 'bg-slate-400'
              }`} />
              <span className="text-sm font-medium text-slate-700">
                {isBroadcasting ? 'Broadcasting Live' : 'Ready to broadcast'}
              </span>
            </div>
          </div>
        </div>

        {/* Audio Preview Monitor */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Audio Preview</label>
          <div className="bg-slate-100 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.818L4.636 14H2a1 1 0 01-1-1V7a1 1 0 011-1h2.636l3.747-2.818a1 1 0 011.617.818zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.414A3.983 3.983 0 0013 10a3.983 3.983 0 00-1.172-2.829 1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              <AudioVisualizer audioLevel={audioLevel} />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Microphone Input</span>
              <span>
                {microphonePermission === 'granted' ? 
                  (isAudioActive ? 'Active' : 'Ready') : 
                  'Permission needed'
                }
              </span>
            </div>
          </div>
        </div>

        {/* Microphone Controls */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Microphone</label>
          <Select value={selectedMicrophone} onValueChange={setSelectedMicrophone}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select microphone" />
            </SelectTrigger>
            <SelectContent>
              {microphones.map((mic) => (
                <SelectItem key={mic.deviceId} value={mic.deviceId || "default"}>
                  {mic.label || `Microphone ${mic.deviceId.slice(0, 5)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Broadcast Controls */}
        <div className="space-y-3">
          {!isBroadcasting ? (
            <Button 
              onClick={handleStartBroadcast}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-blue-700 h-auto"
              disabled={!wsConnected || !selectedMicrophone}
            >
              <Play className="mr-3" size={20} />
              Start Broadcasting
            </Button>
          ) : (
            <Button 
              onClick={handleStopBroadcast}
              className="w-full bg-red-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-red-700 h-auto"
            >
              <Square className="mr-3" size={20} />
              Stop Broadcasting
            </Button>
          )}
        </div>

        {/* Connection Info */}
        <div className="mt-6 p-4 bg-blue-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Users className="text-blue-600" size={16} />
            <span className="text-sm font-medium text-blue-900">Listeners</span>
          </div>
          <span className="text-2xl font-bold text-blue-600">{listenersCount}</span>
          <span className="text-sm text-blue-700 ml-1">connected</span>
        </div>
      </div>
    </div>
  );
}
