/**
 * Listen Page - Test listener for HLS stream
 * 
 * This simulates what your listener app will do
 */

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export default function Listen() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamStatus, setStreamStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize HLS.js for browsers that don't support native HLS (Chrome, Firefox)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Stream URL points to dedicated streaming server
    const streamUrl = 'https://audioroad-streaming-server-production.up.railway.app/live.m3u8';

    // Check if browser natively supports HLS (Safari, iOS)
    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('✅ Native HLS support detected (Safari/iOS)');
      audio.src = streamUrl;
    } 
    // Use hls.js for browsers that don't support HLS (Chrome, Firefox)
    else if (Hls.isSupported()) {
      console.log('✅ Using hls.js for HLS playback');
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });
      
      hls.loadSource(streamUrl);
      hls.attachMedia(audio);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ HLS manifest loaded');
      });
      
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('❌ Fatal HLS error:', data);
          setError(`Stream error: ${data.type}`);
          
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Cannot recover from error');
              hls.destroy();
              break;
          }
        }
      });
      
      hlsRef.current = hls;
      
      return () => {
        hls.destroy();
      };
    } else {
      setError('HLS not supported in this browser');
    }
  }, []);

  // Check stream status from dedicated streaming server
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('https://audioroad-streaming-server-production.up.railway.app/health');
        const data = await response.json();
        setStreamStatus(data);
      } catch (err) {
        console.error('Error checking stream status:', err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePlay = async () => {
    if (!audioRef.current) return;

    try {
      setError(null);
      
      // For Safari/native HLS, we need to load the source
      if (audioRef.current.src) {
        audioRef.current.load();
      }
      
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err: any) {
      console.error('Error playing stream:', err);
      setError(err.message || 'Failed to play stream');
      setIsPlaying(false);
    }
  };

  const handlePause = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🎧 AudioRoad Live Stream
          </h1>
          <p className="text-gray-400">
            Test Listener - Your Custom Streaming Platform
          </p>
        </div>

        {/* Stream Status */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Stream Status</h2>
          
          {streamStatus ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${streamStatus.live ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                <span className="text-white font-semibold">
                  {streamStatus.live ? '🔴 LIVE' : '⚫ OFFLINE'}
                </span>
              </div>
              
              {streamStatus.currentSegment !== undefined && (
                <p className="text-gray-400 text-sm">
                  Segment: #{streamStatus.currentSegment}
                </p>
              )}
              
              <p className="text-gray-400 text-sm">
                Encoder: {streamStatus.encoder || 'N/A'}
              </p>
            </div>
          ) : (
            <p className="text-gray-400">Checking status...</p>
          )}
        </div>

        {/* Audio Player */}
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
          <div className="text-center mb-6">
            {isPlaying ? (
              <div className="inline-flex items-center gap-2 text-green-400">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="font-semibold">Now Playing</span>
              </div>
            ) : (
              <span className="text-gray-400">Ready to Listen</span>
            )}
          </div>

          {/* Audio element for HLS (hls.js will attach to this) */}
          <audio
            ref={audioRef}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={(e) => {
              console.error('Audio error:', e);
              setError('Stream playback error - check console for details');
              setIsPlaying(false);
            }}
          />

          {/* Play/Pause Button */}
          <div className="flex justify-center">
            {!isPlaying ? (
              <button
                onClick={handlePlay}
                className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
              >
                ▶️ Play Stream
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
              >
                ⏸️ Pause
              </button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <p className="text-red-400 text-sm">⚠️ {error}</p>
              <p className="text-gray-400 text-xs mt-2">
                Note: Native HLS support varies by browser. 
                Chrome/Safari may work, Firefox might need hls.js library.
              </p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <h3 className="text-blue-300 font-semibold mb-2">📱 For Mobile Apps</h3>
          <p className="text-gray-300 text-sm mb-2">
            Your iOS/Android app will use this same stream URL:
          </p>
          <code className="block bg-slate-900 p-2 rounded text-xs text-green-400 mb-3 break-all">
            https://audioroad-streaming-server-production.up.railway.app/live.m3u8
          </code>
          <p className="text-gray-400 text-xs">
            Use AVPlayer (iOS), ExoPlayer (Android), or react-native-video
          </p>
        </div>

        {/* Debug Info */}
        <div className="mt-6 bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h3 className="text-gray-400 text-sm font-semibold mb-2">Debug Info</h3>
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Stream URL: https://audioroad-streaming-server-production.up.railway.app/live.m3u8</p>
            <p>• Architecture: Dedicated streaming microservice</p>
            <p>• Segment duration: 2 seconds (ultra-low latency)</p>
            <p>• Expected latency: 4-6 seconds</p>
            <p>• Auto DJ: Enabled (24/7 streaming)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
