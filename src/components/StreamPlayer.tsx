/**
 * HLS Stream Player Component
 * 
 * Plays live HLS stream from our custom server
 * Mobile-responsive with beautiful UI
 */

import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface StreamPlayerProps {
  streamUrl?: string;
}

export default function StreamPlayer({ 
  streamUrl = '/api/stream/live.m3u8'
}: StreamPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Poll for stream status and auto-connect when live
  useEffect(() => {
    const checkAndConnect = async () => {
      try {
        const response = await fetch('/api/stream/status');
        const data = await response.json();
        
        if (data.live && !hlsRef.current && audioRef.current) {
          console.log('🎙️ [PLAYER] Stream is live! Connecting...');
          initializePlayer();
        } else if (!data.live) {
          console.log('⏸️ [PLAYER] Stream offline, waiting...');
        }
      } catch (error) {
        console.error('Error checking stream status:', error);
      }
    };

    // Check immediately
    checkAndConnect();
    
    // Poll every 2 seconds for fast detection
    const interval = setInterval(checkAndConnect, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const initializePlayer = () => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

      // Check if HLS is supported
      if (Hls.isSupported()) {
        console.log('🎵 [PLAYER] HLS.js supported, initializing for LOW LATENCY...');
        
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 10,        // Minimal buffer (was 90)
          maxBufferLength: 10,          // Keep buffer small
          maxMaxBufferLength: 20,       // Don't buffer too far ahead
          liveSyncDuration: 2,          // Stay close to live edge
          liveMaxLatencyDuration: 10,   // Max 10 sec behind live
          liveDurationInfinity: true,   // Live stream
          highBufferWatchdogPeriod: 1   // Aggressive buffer management
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(audio);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('✅ [PLAYER] HLS manifest loaded');
          setIsLive(true);
          setError(null);
          setIsLoading(false);
          
          // Auto-play (always for embedded player)
          audio.play().catch(() => {
            console.warn('⚠️ [PLAYER] Autoplay blocked - user interaction required');
            setError(null);  // Don't show error, just wait for user click
          });
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.error('❌ [PLAYER] HLS error:', data);
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Network error, attempting recovery...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Media error, attempting recovery...');
                hls.recoverMediaError();
                break;
              default:
                setError('Stream unavailable');
                setIsLive(false);
                setIsLoading(false);
                break;
            }
          }
        });

        hlsRef.current = hls;
      } 
      // Fallback for Safari (native HLS support)
      else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('🎵 [PLAYER] Native HLS support detected');
        audio.src = streamUrl;
        setIsLive(true);
        setIsLoading(false);
        
        // Auto-play
        audio.play().catch(() => {
          console.warn('⚠️ [PLAYER] Autoplay blocked');
        });
      } 
      else {
        setError('HLS not supported in this browser');
        setIsLoading(false);
      }
    };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);


  return (
    <div className="w-full">
      {/* Audio element */}
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        className="w-full"
        controls
      />
      
      {/* Status indicator */}
      {isLoading && (
        <p className="text-center text-gray-400 mt-2 text-sm">
          Connecting to stream...
        </p>
      )}
      
      {error && (
        <p className="text-center text-red-400 mt-2 text-sm">
          {error}
        </p>
      )}
      
      {isLive && !isPlaying && !isLoading && (
        <p className="text-center text-green-400 mt-2 text-sm">
          🔴 LIVE - Click play to listen
        </p>
      )}
    </div>
  );
}

