/**
 * Listen Page - Test listener for HLS stream
 * 
 * This simulates what your listener app will do
 */

import { useEffect, useRef, useState } from 'react';

export default function Listen() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamStatus, setStreamStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Check stream status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/stream/status');
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

          {/* Hidden audio element for HLS */}
          <audio
            ref={audioRef}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={(e) => {
              console.error('Audio error:', e);
              setError('Stream playback error');
              setIsPlaying(false);
            }}
          >
            <source src="/api/stream/live.m3u8" type="application/x-mpegURL" />
          </audio>

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
            {window.location.origin}/api/stream/live.m3u8
          </code>
          <p className="text-gray-400 text-xs">
            Use AVPlayer (iOS), ExoPlayer (Android), or react-native-video
          </p>
        </div>

        {/* Debug Info */}
        <div className="mt-6 bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h3 className="text-gray-400 text-sm font-semibold mb-2">Debug Info</h3>
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Stream URL: /api/stream/live.m3u8</p>
            <p>• Segment duration: 2 seconds</p>
            <p>• Playlist size: 3 segments (6 seconds total)</p>
            <p>• Expected latency: 4-6 seconds</p>
            <p>• Auto DJ: Enabled (24/7 streaming)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
