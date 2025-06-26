import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Volume2, VolumeX, Radio, Users } from 'lucide-react';

export default function SimpleListenPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [broadcasters, setBroadcasters] = useState<string[]>([]);
  const [selectedBroadcaster, setSelectedBroadcaster] = useState<string>('');
  const [volume, setVolume] = useState([70]);
  const [streamTime, setStreamTime] = useState('00:00');

  const websocket = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const streamStartTime = useRef<number>(0);
  const timeInterval = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  const listenerId = useRef(`listener-${Date.now()}`);

  // Initialize WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    websocket.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      // Request current broadcasters list
      ws.send(JSON.stringify({ type: 'get-broadcasters' }));
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

  const handleWebSocketMessage = useCallback((message: any) => {
    console.log('Received message:', message.type);

    switch (message.type) {
      case 'broadcasters-list':
        setBroadcasters(message.broadcasters);
        if (message.broadcasters.length > 0 && !selectedBroadcaster) {
          setSelectedBroadcaster(message.broadcasters[0]);
        }
        break;
      
      case 'broadcaster-online':
        setBroadcasters(prev => [...prev, message.broadcasterId]);
        if (!selectedBroadcaster) {
          setSelectedBroadcaster(message.broadcasterId);
        }
        break;
      
      case 'broadcaster-offline':
        setBroadcasters(prev => prev.filter(id => id !== message.broadcasterId));
        if (selectedBroadcaster === message.broadcasterId) {
          setSelectedBroadcaster('');
          stopListening();
        }
        break;
      
      case 'broadcast-answer':
        if (message.listenerId === listenerId.current) {
          handleBroadcastAnswer(message.answer);
        }
        break;
      
      case 'ice-candidate':
        if (message.from !== listenerId.current) {
          handleIceCandidate(message.candidate);
        }
        break;
    }
  }, [selectedBroadcaster]);

  const handleBroadcastAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (peerConnection.current) {
      try {
        await peerConnection.current.setRemoteDescription(answer);
        console.log('Remote description set');
      } catch (error) {
        console.error('Error setting remote description:', error);
      }
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (peerConnection.current) {
      try {
        await peerConnection.current.addIceCandidate(candidate);
        console.log('ICE candidate added');
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  };

  const startListening = async () => {
    if (!selectedBroadcaster || !websocket.current) {
      toast({
        title: "No Broadcaster",
        description: "Please select a broadcaster to listen to.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Starting to listen to:', selectedBroadcaster);

      // Create peer connection
      peerConnection.current = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate && websocket.current) {
          websocket.current.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate,
            from: listenerId.current
          }));
        }
      };

      peerConnection.current.ontrack = (event) => {
        console.log('Received remote stream');
        const stream = event.streams[0];
        if (audioRef.current) {
          audioRef.current.srcObject = stream;
          audioRef.current.volume = volume[0] / 100;
          audioRef.current.play().then(() => {
            console.log('Audio playback started');
            setIsListening(true);
            startStreamTimer();
          }).catch(error => {
            console.error('Audio playback error:', error);
            toast({
              title: "Playback Error",
              description: "Could not start audio playback. Try clicking play manually.",
              variant: "destructive"
            });
          });
        }
      };

      peerConnection.current.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.current?.connectionState);
        if (peerConnection.current?.connectionState === 'failed') {
          toast({
            title: "Connection Failed",
            description: "Lost connection to broadcaster.",
            variant: "destructive"
          });
          stopListening();
        }
      };

      // Create offer
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });

      await peerConnection.current.setLocalDescription(offer);

      // Send join request
      websocket.current.send(JSON.stringify({
        type: 'join-broadcast',
        broadcasterId: selectedBroadcaster,
        listenerId: listenerId.current,
        offer
      }));

      toast({
        title: "Connecting",
        description: "Connecting to broadcaster..."
      });

    } catch (error) {
      console.error('Error starting to listen:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to broadcaster.",
        variant: "destructive"
      });
    }
  };

  const stopListening = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }

    if (timeInterval.current) {
      clearInterval(timeInterval.current);
      timeInterval.current = null;
    }

    setIsListening(false);
    setStreamTime('00:00');

    toast({
      title: "Disconnected",
      description: "Stopped listening to broadcast."
    });
  };

  const startStreamTimer = () => {
    streamStartTime.current = Date.now();
    timeInterval.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - streamStartTime.current) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setStreamTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
  };

  // Update audio volume when slider changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume[0] / 100;
    }
  }, [volume]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Audio Listener</h1>
          <p className="text-gray-600">| Developed By Shepherd Zisper Phiri |</p>
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

        {/* Broadcaster Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Radio className="h-5 w-5" />
              <span>Available Broadcasts</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {broadcasters.length > 0 ? (
              <Select value={selectedBroadcaster} onValueChange={setSelectedBroadcaster}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a broadcast" />
                </SelectTrigger>
                <SelectContent>
                  {broadcasters.map(broadcasterId => (
                    <SelectItem key={broadcasterId} value={broadcasterId}>
                      Broadcaster {broadcasterId.slice(-8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No live broadcasts available</p>
                <p className="text-sm">Check back later or refresh the page</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audio Player */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Audio Stream</CardTitle>
          </CardHeader>
          <CardContent>
            <audio 
              ref={audioRef}
              controls 
              className="w-full mb-4 rounded-lg"
              style={{ filter: 'sepia(20%) saturate(70%) hue-rotate(280deg)' }}
            />
            
            {isListening && (
              <div className="text-center mb-4">
                <div className="text-2xl font-mono font-bold text-purple-600">{streamTime}</div>
                <div className="text-sm text-gray-600">Stream time</div>
              </div>
            )}

            {/* Volume Control */}
            <div className="flex items-center space-x-4">
              <VolumeX className="h-4 w-4 text-gray-600" />
              <Slider
                value={volume}
                onValueChange={setVolume}
                max={100}
                step={1}
                className="flex-1"
              />
              <Volume2 className="h-4 w-4 text-gray-600" />
              <span className="text-sm text-gray-600 min-w-[3rem]">{volume[0]}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Listen Controls */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              {!isListening ? (
                <Button 
                  onClick={startListening}
                  disabled={!isConnected || !selectedBroadcaster}
                  size="lg"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4"
                >
                  <Radio className="mr-2 h-5 w-5" />
                  Start Listening
                </Button>
              ) : (
                <Button 
                  onClick={stopListening}
                  size="lg"
                  variant="destructive"
                  className="px-8 py-4"
                >
                  <VolumeX className="mr-2 h-5 w-5" />
                  Stop Listening
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 mt-8">
          Developed by Shepherd Zisper Phiri
        </div>
      </div>
    </div>
  );
}
