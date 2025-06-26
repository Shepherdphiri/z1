import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Users, Activity } from 'lucide-react';

export default function SimpleBroadcastPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [listenerCount, setListenerCount] = useState(0);

  const websocket = useRef<WebSocket | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  
  const { toast } = useToast();
  const broadcasterId = useRef(`broadcaster-${Date.now()}`);

  // Initialize WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    websocket.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Get available microphones
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(deviceList => {
        const audioDevices = deviceList.filter(device => device.kind === 'audioinput');
        setDevices(audioDevices);
        if (audioDevices.length > 0 && !selectedDevice) {
          setSelectedDevice(audioDevices[0].deviceId);
        }
      })
      .catch(error => {
        console.error('Error enumerating devices:', error);
        toast({
          title: "Device Error",
          description: "Could not access microphone devices.",
          variant: "destructive"
        });
      });
  }, [selectedDevice, toast]);

  const handleWebSocketMessage = useCallback((message: any) => {
    console.log('Received message:', message.type);

    switch (message.type) {
      case 'listener-wants-to-join':
        handleListenerJoin(message.listenerId, message.offer);
        break;
      case 'ice-candidate':
        handleIceCandidate(message.from, message.candidate);
        break;
    }
  }, []);

  const handleListenerJoin = async (listenerId: string, offer: RTCSessionDescriptionInit) => {
    console.log('Listener wants to join:', listenerId);
    
    if (!mediaStream.current) return;

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Add tracks to peer connection
      mediaStream.current.getTracks().forEach(track => {
        if (mediaStream.current) {
          pc.addTrack(track, mediaStream.current);
        }
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && websocket.current) {
          websocket.current.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate,
            from: broadcasterId.current
          }));
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('Connection state for', listenerId, ':', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setListenerCount(prev => prev + 1);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setListenerCount(prev => Math.max(0, prev - 1));
          peerConnections.current.delete(listenerId);
        }
      };

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      peerConnections.current.set(listenerId, pc);

      if (websocket.current) {
        websocket.current.send(JSON.stringify({
          type: 'broadcast-answer',
          answer,
          broadcasterId: broadcasterId.current,
          listenerId
        }));
      }

    } catch (error) {
      console.error('Error handling listener join:', error);
    }
  };

  const handleIceCandidate = async (from: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current.get(from);
    if (pc) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  };

  const startBroadcast = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStream.current = stream;
      setIsBroadcasting(true);

      // Set up audio analysis
      audioContext.current = new AudioContext();
      const source = audioContext.current.createMediaStreamSource(stream);
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 256;
      source.connect(analyser.current);

      // Start audio level monitoring
      const updateAudioLevel = () => {
        if (analyser.current) {
          const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
          analyser.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          setAudioLevel(Math.round((average / 255) * 100));
        }
        if (isBroadcasting) {
          requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();

      // Register as broadcaster
      if (websocket.current) {
        websocket.current.send(JSON.stringify({
          type: 'start-broadcast',
          broadcasterId: broadcasterId.current
        }));
      }

      toast({
        title: "Broadcast Started",
        description: "You are now broadcasting live!"
      });

    } catch (error) {
      console.error('Error starting broadcast:', error);
      toast({
        title: "Broadcast Error",
        description: "Could not start broadcast. Please check microphone permissions.",
        variant: "destructive"
      });
    }
  };

  const stopBroadcast = () => {
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach(track => track.stop());
      mediaStream.current = null;
    }

    if (audioContext.current) {
      audioContext.current.close();
      audioContext.current = null;
    }

    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    if (websocket.current) {
      websocket.current.send(JSON.stringify({
        type: 'stop-broadcast',
        broadcasterId: broadcasterId.current
      }));
    }

    setIsBroadcasting(false);
    setAudioLevel(0);
    setListenerCount(0);

    toast({
      title: "Broadcast Stopped",
      description: "Your broadcast has ended."
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Audio Broadcaster</h1>
          <p className="text-gray-600">| Developed By Shepherd Zisper Phiri</p>
        </div>

        {/* Connection Status */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-4">
              <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="font-medium">
                {isConnected ? 'Connected to Server' : 'Connecting...'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Microphone Selection */}
        {!isBroadcasting && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mic className="h-5 w-5" />
                <span>Select Microphone</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose microphone" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map(device => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Broadcast Controls */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              {!isBroadcasting ? (
                <Button 
                  onClick={startBroadcast}
                  disabled={!isConnected || !selectedDevice}
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-4"
                >
                  <Mic className="mr-2 h-5 w-5" />
                  Start Broadcasting
                </Button>
              ) : (
                <Button 
                  onClick={stopBroadcast}
                  size="lg"
                  variant="destructive"
                  className="px-8 py-4"
                >
                  <MicOff className="mr-2 h-5 w-5" />
                  Stop Broadcasting
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live Stats */}
        {isBroadcasting && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <div className="text-2xl font-bold">{listenerCount}</div>
                  <div className="text-sm text-gray-600">Listeners</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <div className="text-2xl font-bold">{audioLevel}%</div>
                  <div className="text-sm text-gray-600">Audio Level</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Audio Level Visualization */}
        {isBroadcasting && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Audio Monitor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-green-500 h-4 rounded-full transition-all duration-100"
                  style={{ width: `${audioLevel}%` }}
                ></div>
              </div>
              <div className="mt-2 text-sm text-gray-600 text-center">
                {audioLevel > 50 ? 'Strong signal' : audioLevel > 20 ? 'Good signal' : 'Weak signal'}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 mt-8">
          Developed by Shepherd Zsper Phiri
        </div>
      </div>
    </div>
  );
}
