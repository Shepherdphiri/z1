import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Headphones, Play, Square, Signal, Clock, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useWebSocket } from "@/hooks/use-websocket";
import { useWebRTC } from "@/hooks/use-webrtc";
import { useToast } from "@/hooks/use-toast";

export default function ListenPage() {
  const [, setLocation] = useLocation();
  const [isConnected, setIsConnected] = useState(false);
  const [volume, setVolume] = useState([75]);
  const [activeBroadcasters, setActiveBroadcasters] = useState<string[]>([]);
  const [selectedBroadcaster, setSelectedBroadcaster] = useState<string>("");
  const [streamTime, setStreamTime] = useState("--:--");
  const [audioQuality, setAudioQuality] = useState("High Quality");
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const listenerId = `listener-${Date.now()}`;
  
  const { 
    isConnected: wsConnected, 
    sendMessage,
    lastMessage 
  } = useWebSocket();

  const {
    remoteStream,
    connectToStream,
    disconnectFromStream
  } = useWebRTC(listenerId, sendMessage);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      const message = JSON.parse(lastMessage.data);
      
      switch (message.type) {
        case 'active-broadcasters':
          setActiveBroadcasters(message.broadcasters);
          if (message.broadcasters.length > 0 && !selectedBroadcaster) {
            setSelectedBroadcaster(message.broadcasters[0]);
          }
          break;
        case 'broadcaster-available':
          setActiveBroadcasters(prev => [...prev, message.broadcasterId]);
          break;
        case 'broadcaster-stopped':
          setActiveBroadcasters(prev => prev.filter(id => id !== message.broadcasterId));
          if (selectedBroadcaster === message.broadcasterId) {
            setIsConnected(false);
            setSelectedBroadcaster("");
            if (audioRef.current) {
              audioRef.current.srcObject = null;
            }
          }
          break;
        case 'webrtc-answer':
          // Handle WebRTC answer
          break;
        case 'webrtc-ice-candidate':
          // Handle ICE candidates
          break;
      }
    }
  }, [lastMessage, selectedBroadcaster]);

  // Register as listener when WebSocket connects
  useEffect(() => {
    if (wsConnected) {
      sendMessage({
        type: 'register-listener',
        listenerId
      });
    }
  }, [wsConnected, sendMessage, listenerId]);

  // Set up audio element when remote stream is available
  useEffect(() => {
    if (remoteStream && audioRef.current) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.volume = volume[0] / 100;
      setIsConnected(true);
      
      // Update stream time
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        setStreamTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [remoteStream, volume]);

  const handleConnectToStream = async () => {
    if (!selectedBroadcaster) {
      toast({
        title: "No Broadcaster Selected",
        description: "Please wait for a broadcaster to come online.",
        variant: "destructive"
      });
      return;
    }

    try {
      await connectToStream(selectedBroadcaster);
      toast({
        title: "Connecting to Stream",
        description: "Establishing connection to broadcaster..."
      });
    } catch (error) {
      console.error('Error connecting to stream:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to stream. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDisconnectFromStream = () => {
    try {
      disconnectFromStream();
      setIsConnected(false);
      setStreamTime("--:--");
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
      toast({
        title: "Disconnected",
        description: "You have been disconnected from the stream."
      });
    } catch (error) {
      console.error('Error disconnecting from stream:', error);
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume[0] / 100;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pb-20">
      {/* Navigation Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-white rounded-lg shadow-lg p-2 flex gap-2">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => setLocation('/broadcast')}
          >
            Broadcast
          </Button>
          <Button 
            variant="default" 
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Listen
          </Button>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Headphones className="text-2xl text-emerald-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Live Audio Stream</h1>
          <p className="text-slate-600 text-sm">Listen to live broadcasts from around the world</p>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <div className="flex items-center justify-center p-4 bg-slate-100 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                isConnected 
                  ? 'bg-emerald-500' 
                  : activeBroadcasters.length > 0
                  ? 'bg-slate-400 animate-pulse'
                  : 'bg-slate-400'
              }`} />
              <span className="text-sm font-medium text-slate-700">
                {isConnected 
                  ? 'Connected to live stream' 
                  : activeBroadcasters.length > 0
                  ? `${activeBroadcasters.length} broadcaster${activeBroadcasters.length > 1 ? 's' : ''} available`
                  : 'Searching for broadcasts...'
                }
              </span>
            </div>
          </div>
        </div>

        {/* Audio Player */}
        <div className="mb-6">
          <div className="bg-slate-100 rounded-xl p-6">
            <audio 
              ref={audioRef}
              controls 
              className="w-full mb-4 rounded-lg"
              style={{ filter: 'sepia(20%) saturate(70%) hue-rotate(200deg)' }}
            />
            
            {/* Audio Info */}
            <div className="flex items-center justify-between text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Signal className="text-emerald-500" size={16} />
                <span>{audioQuality}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="text-slate-500" size={16} />
                <span>{streamTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Volume Controls */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Volume</label>
          <div className="flex items-center gap-4">
            <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.818L4.636 14H2a1 1 0 01-1-1V7a1 1 0 011-1h2.636l3.747-2.818a1 1 0 011.617.818z" clipRule="evenodd" />
            </svg>
            <Slider
              value={volume}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
            />
            <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.818L4.636 14H2a1 1 0 01-1-1V7a1 1 0 011-1h2.636l3.747-2.818a1 1 0 011.617.818zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.414A3.983 3.983 0 0013 10a3.983 3.983 0 00-1.172-2.829 1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Connection Controls */}
        <div className="space-y-3">
          {!isConnected ? (
            <Button 
              onClick={handleConnectToStream}
              className="w-full bg-emerald-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-emerald-700 h-auto"
              disabled={activeBroadcasters.length === 0}
            >
              <Play className="mr-3" size={20} />
              Connect to Stream
            </Button>
          ) : (
            <Button 
              onClick={handleDisconnectFromStream}
              className="w-full bg-slate-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-slate-700 h-auto"
            >
              <Square className="mr-3" size={20} />
              Disconnect
            </Button>
          )}
        </div>

        {/* Stream Info */}
        <div className="mt-6 p-4 bg-emerald-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <span className="text-sm font-medium text-emerald-900">Stream Status</span>
          </div>
          <div className="text-sm text-emerald-700">
            <div className="flex justify-between">
              <span>Latency:</span>
              <span>{isConnected ? '~50ms' : '--ms'}</span>
            </div>
            <div className="flex justify-between">
              <span>Bitrate:</span>
              <span>{isConnected ? '128 kbps' : '-- kbps'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
