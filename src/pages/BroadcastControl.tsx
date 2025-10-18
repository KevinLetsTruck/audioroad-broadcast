/**
 * Broadcast Control Center
 * 
 * ONE-BUTTON broadcast system - simplified daily workflow
 * Replaces the complex multi-step process with single "START SHOW" button
 */

import { useState, useEffect, useRef } from 'react';
import { AudioMixerEngine } from '../services/audioMixerEngine';
import { StreamEncoder, StreamConfig } from '../services/streamEncoder';
import VUMeter from '../components/VUMeter';

interface BroadcastStatus {
  isLive: boolean;
  episodeId: string | null;
  showName: string;
  startTime: Date | null;
  micConnected: boolean;
  isRecording: boolean;
  isStreaming: boolean;
  callersCount: number;
  duration: string;
}

export default function BroadcastControl() {
  const [status, setStatus] = useState<BroadcastStatus>({
    isLive: false,
    episodeId: null,
    showName: '',
    startTime: null,
    micConnected: false,
    isRecording: false,
    isStreaming: false,
    callersCount: 0,
    duration: '00:00:00'
  });

  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [masterLevel, setMasterLevel] = useState(0);
  
  // Settings
  const [autoRecord, setAutoRecord] = useState(true);
  const [autoStream, setAutoStream] = useState(true);
  const [radioCoPassword, setRadioCoPassword] = useState('');

  // Mixer refs
  const mixerRef = useRef<AudioMixerEngine | null>(null);
  const encoderRef = useRef<StreamEncoder | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Main "START SHOW" button handler
   * Does EVERYTHING automatically
   */
  const handleStartShow = async () => {
    setIsStarting(true);
    setErrorMessage('');

    try {
      console.log('🎙️ Starting broadcast...');

      // Step 1: Get or create today's show and episode
      const episode = await getOrCreateTodaysEpisode();
      console.log('✅ Episode ready:', episode.id);

      // Step 2: Start the episode (go live)
      await fetch(`/api/episodes/${episode.id}/start`, { method: 'PATCH' });
      console.log('✅ Episode started');

      // Step 3: Initialize audio mixer
      const mixer = new AudioMixerEngine({
        sampleRate: 48000,
        bitrate: 256,
        outputChannels: 2
      });
      await mixer.initialize();
      mixerRef.current = mixer;
      console.log('✅ Mixer initialized');

      // Set up level monitoring
      mixer.onLevelUpdate((sourceId, level) => {
        if (sourceId === 'master') {
          setMasterLevel(level);
        }
      });

      // Step 4: Connect microphone
      await mixer.connectMicrophone();
      console.log('✅ Microphone connected');

      // Step 5: Start recording (if enabled)
      if (autoRecord) {
        mixer.startRecording();
        console.log('✅ Recording started');
      }

      // Step 6: Start Radio.co stream (if enabled and password provided)
      if (autoStream && radioCoPassword) {
        const encoder = new StreamEncoder();
        const streamConfig: StreamConfig = {
          serverUrl: 'pear.radio.co',
          port: 5568,
          password: radioCoPassword,
          streamName: episode.title || 'AudioRoad Network LIVE',
          genre: 'Trucking',
          url: 'http://audioroad.letstruck.com',
          bitrate: 256
        };

        encoder.configure(streamConfig);
        const outputStream = mixer.getOutputStream();
        if (outputStream) {
          await encoder.startStreaming(outputStream);
          encoderRef.current = encoder;
          console.log('✅ Streaming to Radio.co');
        }
      }

      // Update status
      setStatus({
        isLive: true,
        episodeId: episode.id,
        showName: episode.title || 'Live Show',
        startTime: new Date(),
        micConnected: true,
        isRecording: autoRecord,
        isStreaming: autoStream && !!radioCoPassword,
        callersCount: 0,
        duration: '00:00:00'
      });

      // Start duration timer
      startDurationTimer();

      console.log('🎉 SHOW STARTED! You are LIVE!');

    } catch (error: any) {
      console.error('❌ Failed to start show:', error);
      setErrorMessage(error.message || 'Failed to start show');
      
      // Cleanup on error
      if (mixerRef.current) {
        await mixerRef.current.destroy();
        mixerRef.current = null;
      }
    } finally {
      setIsStarting(false);
    }
  };

  /**
   * Main "END SHOW" button handler
   * Cleans up EVERYTHING automatically
   */
  const handleEndShow = async () => {
    if (!status.episodeId) return;

    try {
      console.log('📴 Ending show...');

      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      // Stop streaming
      if (encoderRef.current && status.isStreaming) {
        await encoderRef.current.stopStreaming();
        await encoderRef.current.destroy();
        encoderRef.current = null;
        console.log('✅ Streaming stopped');
      }

      // Stop recording and download
      if (mixerRef.current && status.isRecording) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await mixerRef.current.downloadRecording(`${status.showName}-${timestamp}.webm`);
        console.log('✅ Recording saved');
      }

      // Destroy mixer
      if (mixerRef.current) {
        await mixerRef.current.destroy();
        mixerRef.current = null;
        console.log('✅ Mixer cleaned up');
      }

      // End the episode
      await fetch(`/api/episodes/${status.episodeId}/end`, { method: 'PATCH' });
      console.log('✅ Episode ended');

      // Reset status
      setStatus({
        isLive: false,
        episodeId: null,
        showName: '',
        startTime: null,
        micConnected: false,
        isRecording: false,
        isStreaming: false,
        callersCount: 0,
        duration: '00:00:00'
      });

      console.log('🎉 Show ended successfully!');

    } catch (error) {
      console.error('❌ Error ending show:', error);
      setErrorMessage('Error ending show');
    }
  };

  /**
   * Get or create today's episode
   */
  const getOrCreateTodaysEpisode = async () => {
    // First, get the show
    const showsRes = await fetch('/api/shows');
    const shows = await showsRes.json();
    
    if (shows.length === 0) {
      throw new Error('No shows configured. Please create a show first.');
    }

    const show = shows[0]; // Use first show

    // Check if today's episode exists
    const today = new Date().toISOString().split('T')[0];
    const episodesRes = await fetch(`/api/episodes?showId=${show.id}`);
    const episodes = await episodesRes.json();

    const todaysEpisode = episodes.find((ep: any) => {
      const epDate = new Date(ep.date).toISOString().split('T')[0];
      return epDate === today;
    });

    if (todaysEpisode) {
      return todaysEpisode;
    }

    // Create today's episode
    const now = new Date();
    const endTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now

    const createRes = await fetch('/api/episodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showId: show.id,
        title: `${show.name} - ${now.toLocaleDateString()}`,
        date: now.toISOString(),
        scheduledStart: now.toISOString(),
        scheduledEnd: endTime.toISOString(),
        description: 'Auto-created episode'
      })
    });

    if (!createRes.ok) {
      throw new Error('Failed to create episode');
    }

    return await createRes.json();
  };

  /**
   * Start duration timer
   */
  const startDurationTimer = () => {
    durationIntervalRef.current = setInterval(() => {
      setStatus(prev => {
        if (!prev.startTime) return prev;

        const elapsed = Date.now() - prev.startTime.getTime();
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        return {
          ...prev,
          duration: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        };
      });
    }, 1000);
  };

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (mixerRef.current) {
        mixerRef.current.destroy();
      }
      if (encoderRef.current) {
        encoderRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold">🎙️ Broadcast Control Center</h1>
        <p className="text-sm text-gray-400 mt-1">One-click broadcast management</p>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Main Status Card */}
        <div className="bg-gray-800 rounded-lg border-2 border-gray-700 p-8 mb-6">
          {!status.isLive ? (
            /* PRE-SHOW STATE */
            <>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">Ready to Broadcast</h2>
                <p className="text-gray-400">Click below to start your show</p>
              </div>

              {/* Settings */}
              <div className="bg-gray-900 rounded-lg p-4 mb-6 space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={autoRecord}
                    onChange={(e) => setAutoRecord(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="text-sm">Auto-record show</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={autoStream}
                    onChange={(e) => setAutoStream(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="text-sm">Stream to Radio.co</span>
                </label>

                {autoStream && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Radio.co Password</label>
                    <input
                      type="password"
                      value={radioCoPassword}
                      onChange={(e) => setRadioCoPassword(e.target.value)}
                      placeholder="Enter your Radio.co password"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
                    />
                  </div>
                )}
              </div>

              {/* BIG START BUTTON */}
              <button
                onClick={handleStartShow}
                disabled={isStarting}
                className="w-full py-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-bold text-2xl transition-all transform hover:scale-105 disabled:scale-100"
              >
                {isStarting ? '⏳ Starting...' : '🎙️ START SHOW - GO LIVE!'}
              </button>

              {errorMessage && (
                <div className="mt-4 p-3 bg-red-900/50 border border-red-600 rounded text-sm">
                  ❌ {errorMessage}
                </div>
              )}

              <p className="text-center text-xs text-gray-500 mt-4">
                This will auto-create today's episode, connect your mic, and start broadcasting
              </p>
            </>
          ) : (
            /* LIVE STATE */
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 mb-2">
                  <span className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></span>
                  <h2 className="text-3xl font-bold">LIVE NOW</h2>
                </div>
                <p className="text-xl text-gray-300">{status.showName}</p>
                <p className="text-2xl font-mono text-green-400 mt-2">{status.duration}</p>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <StatusItem 
                  icon="🎤" 
                  label="Microphone" 
                  value={status.micConnected ? 'Connected' : 'Disconnected'}
                  active={status.micConnected}
                />
                <StatusItem 
                  icon="⏺️" 
                  label="Recording" 
                  value={status.isRecording ? 'Active' : 'Off'}
                  active={status.isRecording}
                />
                <StatusItem 
                  icon="📡" 
                  label="Radio.co Stream" 
                  value={status.isStreaming ? 'Live' : 'Off'}
                  active={status.isStreaming}
                />
                <StatusItem 
                  icon="📞" 
                  label="Callers in Queue" 
                  value={status.callersCount.toString()}
                  active={status.callersCount > 0}
                />
              </div>

              {/* Master VU Meter */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Master Output Level</label>
                <VUMeter level={masterLevel} width={600} height={40} />
              </div>

              {/* BIG END BUTTON */}
              <button
                onClick={handleEndShow}
                className="w-full py-6 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-2xl transition-all"
              >
                ⏹️ END SHOW
              </button>

              <p className="text-center text-xs text-gray-500 mt-4">
                This will stop streaming, save your recording, and end the episode
              </p>
            </>
          )}
        </div>

        {/* Quick Links */}
        {status.isLive && (
          <div className="grid grid-cols-3 gap-4">
            <a
              href="/host-dashboard"
              className="block p-4 bg-gray-800 rounded-lg text-center hover:bg-gray-700 transition-colors"
            >
              <div className="text-2xl mb-2">📊</div>
              <div className="text-sm">Full Dashboard</div>
            </a>
            <a
              href="/screening-room"
              className="block p-4 bg-gray-800 rounded-lg text-center hover:bg-gray-700 transition-colors"
            >
              <div className="text-2xl mb-2">🔍</div>
              <div className="text-sm">Screening Room</div>
            </a>
            <a
              href="/host-dashboard?tab=mixer"
              className="block p-4 bg-gray-800 rounded-lg text-center hover:bg-gray-700 transition-colors"
            >
              <div className="text-2xl mb-2">🎚️</div>
              <div className="text-sm">Audio Mixer</div>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Status item component
 */
function StatusItem({ icon, label, value, active }: { icon: string; label: string; value: string; active: boolean }) {
  return (
    <div className={`p-4 rounded-lg ${active ? 'bg-green-900/30 border-green-600' : 'bg-gray-900 border-gray-700'} border-2`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-sm font-semibold ${active ? 'text-green-400' : 'text-gray-500'}`}>{value}</div>
    </div>
  );
}

