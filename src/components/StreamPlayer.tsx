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
  autoplay?: boolean;
  showControls?: boolean;
}

export default function StreamPlayer({ 
  streamUrl = '/api/stream/live.m3u8',
  autoplay = false,
  showControls = true
}: StreamPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

    // Check if HLS is supported
    if (Hls.isSupported()) {
      console.log('🎵 [PLAYER] HLS.js supported, initializing...');
      
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(audio);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ [PLAYER] HLS manifest loaded');
        setIsLive(true);
        setError(null);
        
        if (autoplay) {
          audio.play().catch(e => {
            console.warn('⚠️ [PLAYER] Autoplay blocked:', e);
            setError('Click play to start listening');
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('❌ [PLAYER] HLS error:', data);
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Network error, attempting recovery...');
              hls.startLoad();
              setError('Connection issue, reconnecting...');
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Media error, attempting recovery...');
              hls.recoverMediaError();
              setError('Playback error, recovering...');
              break;
            default:
              setError('Stream unavailable');
              setIsLive(false);
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
      };
    } 
    // Fallback for Safari (native HLS support)
    else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('🎵 [PLAYER] Native HLS support detected');
      audio.src = streamUrl;
      setIsLive(true);
    } 
    else {
      setError('HLS not supported in this browser');
    }
  }, [streamUrl, autoplay]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(error => {
          console.error('Error playing:', error);
          setError('Failed to play stream');
          setIsLoading(false);
        });
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!audioRef.current) return;
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border-2 border-gray-700">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
      />

      {/* Player UI */}
      <div className="flex items-center gap-4">
        {/* Play/Pause Button */}
        <button
          onClick={handlePlayPause}
          disabled={!isLive || isLoading}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all ${
            isPlaying
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          } ${(!isLive || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? '⏳' : isPlaying ? '⏸️' : '▶️'}
        </button>

        {/* Info Section */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isLive && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-red-400 font-bold text-sm">LIVE</span>
              </span>
            )}
            <h3 className="text-lg font-bold">AudioRoad Network</h3>
          </div>
          <p className="text-sm text-gray-400">
            {error ? error : isLive ? 'Live Broadcast' : 'Stream Offline'}
          </p>
        </div>

        {/* Volume Control */}
        {showControls && (
          <div className="flex items-center gap-2">
            <span className="text-xl">{volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-24"
            />
          </div>
        )}
      </div>

      {/* Visualizer (optional future enhancement) */}
      {isPlaying && (
        <div className="mt-4 flex gap-1 justify-center items-end h-12">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="w-2 bg-green-500 rounded-t animate-pulse"
              style={{
                height: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.05}s`
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

