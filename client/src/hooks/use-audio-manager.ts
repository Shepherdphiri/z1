import { useState, useEffect, useRef, useCallback } from 'react';

export const useAudioManager = (deviceId?: string) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [microphonePermission, setMicrophonePermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>();

  const checkMicrophonePermission = useCallback(async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setMicrophonePermission(permission.state as any);
      
      permission.onchange = () => {
        setMicrophonePermission(permission.state as any);
      };
    } catch (error) {
      console.error('Error checking microphone permission:', error);
    }
  }, []);

  const createAudioAnalyzer = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Start analyzing audio
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (analyserRef.current && isActive) {
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate RMS (Root Mean Square) for more accurate level detection
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / dataArray.length);
          const level = Math.min(100, (rms / 128) * 100);
          
          setAudioLevel(level);
          
          animationRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };

      updateAudioLevel();
    } catch (error) {
      console.error('Error creating audio analyzer:', error);
    }
  }, [isActive]);

  const startAudio = useCallback(async (forBroadcast = false): Promise<MediaStream | null> => {
    try {
      const constraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setCurrentStream(stream);
      setIsActive(true);
      setMicrophonePermission('granted');

      // Create audio analyzer for level monitoring
      createAudioAnalyzer(stream);

      return stream;
    } catch (error) {
      console.error('Error starting audio:', error);
      setMicrophonePermission('denied');
      return null;
    }
  }, [deviceId, createAudioAnalyzer]);

  const stopAudio = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCurrentStream(null);
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsActive(false);
    setAudioLevel(0);
  }, []);

  // Check permission on mount
  useEffect(() => {
    checkMicrophonePermission();
  }, [checkMicrophonePermission]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  return {
    audioLevel,
    isActive,
    microphonePermission,
    currentStream,
    startAudio,
    stopAudio
  };
};