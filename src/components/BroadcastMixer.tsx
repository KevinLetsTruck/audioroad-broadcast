/**
 * Broadcast Mixer Component
 * 
 * Main UI for the audio mixer - controls all audio sources and streaming
 */

import { useState, useEffect, useRef } from 'react';
import { AudioMixerEngine, AudioSource } from '../services/audioMixerEngine';
import { StreamEncoder, StreamConfig } from '../services/streamEncoder';
import VUMeter from './VUMeter';

interface BroadcastMixerProps {
  episodeId: string;
  onCallerAudioNeeded?: (callId: string) => MediaStream | null;
}

export default function BroadcastMixer({ episodeId }: BroadcastMixerProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMicConnected, setIsMicConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Audio sources and levels
  const [sources, setSources] = useState<AudioSource[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [masterVolume, setMasterVolume] = useState(100);
  
  // Stream configuration
  const [streamConfig, setStreamConfig] = useState<StreamConfig>({
    serverUrl: 'pear.radio.co',
    port: 5568,
    password: '',
    streamName: 'AudioRoad Network LIVE',
    genre: 'Talk',
    bitrate: 256
  });

  // Refs for engine instances
  const mixerRef = useRef<AudioMixerEngine | null>(null);
  const encoderRef = useRef<StreamEncoder | null>(null);

  /**
   * Initialize mixer engine
   */
  const handleInitialize = async () => {
    if (isInitialized) return;

    try {
      const mixer = new AudioMixerEngine({
        sampleRate: 48000,
        bitrate: streamConfig.bitrate,
        outputChannels: 2
      });

      await mixer.initialize();
      mixerRef.current = mixer;

      // Set up level monitoring
      mixer.onLevelUpdate((sourceId, level) => {
        setLevels(prev => ({ ...prev, [sourceId]: level }));
      });

      // Initialize encoder
      const encoder = new StreamEncoder();
      encoder.configure(streamConfig);
      encoderRef.current = encoder;

      setIsInitialized(true);
      console.log('✅ Mixer initialized');
    } catch (error) {
      console.error('Failed to initialize mixer:', error);
      alert('Failed to initialize audio mixer. Please check browser permissions.');
    }
  };

  /**
   * Connect microphone
   */
  const handleConnectMic = async () => {
    if (!mixerRef.current || isMicConnected) return;

    try {
      await mixerRef.current.connectMicrophone();
      setIsMicConnected(true);
      updateSources();
      console.log('✅ Microphone connected');
    } catch (error) {
      console.error('Failed to connect microphone:', error);
      alert('Failed to access microphone. Please grant microphone permissions and try again.');
    }
  };

  /**
   * Add caller audio to mix
   */
  const addCallerAudio = (callId: string, callerName: string, stream: MediaStream) => {
    if (!mixerRef.current) return;

    try {
      mixerRef.current.addCallerAudio(callId, callerName, stream);
      updateSources();
      console.log(`✅ Added caller: ${callerName}`);
    } catch (error) {
      console.error('Failed to add caller audio:', error);
    }
  };

  /**
   * Remove caller audio
   */
  const removeCallerAudio = (callId: string) => {
    if (!mixerRef.current) return;

    const sourceId = `caller-${callId}`;
    mixerRef.current.removeSource(sourceId);
    updateSources();
    console.log(`➖ Removed caller: ${callId}`);
  };

  /**
   * Update sources from mixer
   */
  const updateSources = () => {
    if (!mixerRef.current) return;
    setSources(mixerRef.current.getSources());
  };

  /**
   * Handle volume change for a source
   */
  const handleVolumeChange = (sourceId: string, volume: number) => {
    if (!mixerRef.current) return;
    mixerRef.current.setVolume(sourceId, volume);
    updateSources();
  };

  /**
   * Handle mute toggle
   */
  const handleMuteToggle = (sourceId: string) => {
    if (!mixerRef.current) return;
    
    const source = mixerRef.current.getSource(sourceId);
    if (source) {
      mixerRef.current.setMuted(sourceId, !source.muted);
      updateSources();
    }
  };

  /**
   * Handle master volume change
   */
  const handleMasterVolumeChange = (volume: number) => {
    if (!mixerRef.current) return;
    setMasterVolume(volume);
    mixerRef.current.setMasterVolume(volume);
  };

  /**
   * Start recording
   */
  const handleStartRecording = () => {
    if (!mixerRef.current || isRecording) return;

    try {
      mixerRef.current.startRecording();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording.');
    }
  };

  /**
   * Stop recording and download
   */
  const handleStopRecording = async () => {
    if (!mixerRef.current || !isRecording) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await mixerRef.current.downloadRecording(`audioroad-${timestamp}.webm`);
      setIsRecording(false);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Failed to stop recording.');
    }
  };

  /**
   * Start streaming to Radio.co
   */
  const handleStartStreaming = async () => {
    if (!mixerRef.current || !encoderRef.current || isStreaming) return;

    if (!streamConfig.password) {
      alert('Please configure Radio.co password in settings first.');
      setShowSettings(true);
      return;
    }

    try {
      const outputStream = mixerRef.current.getOutputStream();
      if (!outputStream) {
        throw new Error('No output stream available');
      }

      await encoderRef.current.startStreaming(outputStream);
      setIsStreaming(true);
      console.log('🚀 Streaming started');
    } catch (error) {
      console.error('Failed to start streaming:', error);
      alert('Failed to start streaming. Check your Radio.co credentials.');
    }
  };

  /**
   * Stop streaming
   */
  const handleStopStreaming = async () => {
    if (!encoderRef.current || !isStreaming) return;

    try {
      await encoderRef.current.stopStreaming();
      setIsStreaming(false);
      console.log('⏹️ Streaming stopped');
    } catch (error) {
      console.error('Failed to stop streaming:', error);
    }
  };

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (mixerRef.current) {
        mixerRef.current.destroy();
      }
      if (encoderRef.current) {
        encoderRef.current.destroy();
      }
    };
  }, []);

  // Expose methods to parent component
  useEffect(() => {
    // Store methods on window for easy access (temporary solution)
    (window as any).broadcastMixer = {
      addCaller: addCallerAudio,
      removeCaller: removeCallerAudio,
      episodeId
    };

    return () => {
      delete (window as any).broadcastMixer;
    };
  }, [isInitialized, episodeId]);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          🎚️ Broadcast Mixer
          {isStreaming && (
            <span className="text-sm px-2 py-1 bg-red-600 rounded animate-pulse">
              LIVE
            </span>
          )}
        </h3>
        
        <div className="flex items-center gap-2">
          {!isInitialized ? (
            <button
              onClick={handleInitialize}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold"
            >
              Start Mixer
            </button>
          ) : (
            <>
              {!isMicConnected && (
                <button
                  onClick={handleConnectMic}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold"
                >
                  Connect Mic
                </button>
              )}
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                ⚙️ Settings
              </button>
            </>
          )}
        </div>
      </div>

      {!isInitialized ? (
        <div className="text-center py-12 text-gray-400">
          <p className="mb-2">Click "Start Mixer" to begin</p>
          <p className="text-sm">This will request microphone permissions</p>
        </div>
      ) : (
        <>
          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
              <h4 className="font-semibold mb-3">Radio.co Settings</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Server URL</label>
                  <input
                    type="text"
                    value={streamConfig.serverUrl}
                    onChange={(e) => setStreamConfig({ ...streamConfig, serverUrl: e.target.value })}
                    className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm"
                    placeholder="pear.radio.co"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={streamConfig.port}
                    onChange={(e) => setStreamConfig({ ...streamConfig, port: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm"
                    placeholder="5568"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={streamConfig.password}
                    onChange={(e) => setStreamConfig({ ...streamConfig, password: e.target.value })}
                    className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm"
                    placeholder="Enter your Radio.co password"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Bitrate</label>
                  <select
                    value={streamConfig.bitrate}
                    onChange={(e) => setStreamConfig({ ...streamConfig, bitrate: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm"
                  >
                    <option value={128}>128 kbps</option>
                    <option value={256}>256 kbps</option>
                  </select>
                </div>
              </div>
              <button
                onClick={() => {
                  if (encoderRef.current) {
                    encoderRef.current.configure(streamConfig);
                  }
                  setShowSettings(false);
                }}
                className="mt-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                Save Settings
              </button>
            </div>
          )}

          {/* Audio Sources */}
          <div className="space-y-3 mb-4">
            {sources.map((source) => (
              <MixerChannel
                key={source.id}
                source={source}
                level={levels[source.id] || 0}
                onVolumeChange={(vol) => handleVolumeChange(source.id, vol)}
                onMuteToggle={() => handleMuteToggle(source.id)}
              />
            ))}

            {sources.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p>No audio sources connected</p>
                <p className="text-sm mt-1">Connect your microphone to get started</p>
              </div>
            )}
          </div>

          {/* Master Output */}
          <div className="bg-gray-800 rounded-lg p-4 border-2 border-blue-600">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-lg">Master Output</h4>
              <span className="text-sm text-gray-400">{masterVolume}%</span>
            </div>
            
            <div className="mb-3">
              <VUMeter 
                level={levels['master'] || 0}
                width={400}
                height={30}
                showPeakIndicator={true}
              />
            </div>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-gray-400">0</span>
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={(e) => handleMasterVolumeChange(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">100</span>
            </div>

            {/* Control Buttons */}
            <div className="flex gap-2">
              <button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className={`flex-1 px-4 py-2 rounded font-semibold ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {isRecording ? '⏹️ Stop Recording' : '⏺️ Record'}
              </button>

              <button
                onClick={isStreaming ? handleStopStreaming : handleStartStreaming}
                disabled={!isMicConnected}
                className={`flex-1 px-4 py-2 rounded font-semibold ${
                  isStreaming
                    ? 'bg-red-600 hover:bg-red-700'
                    : isMicConnected
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-600 cursor-not-allowed'
                }`}
              >
                {isStreaming ? '⏹️ Stop Stream' : '📡 Go Live'}
              </button>
            </div>
          </div>

          {/* Info Banner */}
          {isStreaming && (
            <div className="mt-3 bg-red-900/30 border border-red-600 rounded p-3 text-sm">
              <p className="font-semibold">🔴 LIVE - Broadcasting to Radio.co</p>
              <p className="text-xs text-gray-400 mt-1">
                Note: Direct browser streaming to Radio.co may require backend proxy. 
                Check console for details.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Individual mixer channel component
 */
interface MixerChannelProps {
  source: AudioSource;
  level: number;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
}

function MixerChannel({ source, level, onVolumeChange, onMuteToggle }: MixerChannelProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'host': return '🎤';
      case 'caller': return '📞';
      case 'soundboard': return '🎵';
      case 'file': return '📁';
      default: return '🔊';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'host': return 'border-green-600';
      case 'caller': return 'border-blue-600';
      case 'soundboard': return 'border-purple-600';
      case 'file': return 'border-yellow-600';
      default: return 'border-gray-600';
    }
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-3 border-2 ${getTypeColor(source.type)}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getTypeIcon(source.type)}</span>
          <div>
            <h4 className="font-semibold text-sm">{source.label}</h4>
            <p className="text-xs text-gray-500">
              {source.type.charAt(0).toUpperCase() + source.type.slice(1)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{source.volume}%</span>
          <button
            onClick={onMuteToggle}
            className={`px-2 py-1 rounded text-xs font-semibold ${
              source.muted ? 'bg-red-600' : 'bg-gray-700'
            }`}
          >
            {source.muted ? '🔇 Muted' : '🔊'}
          </button>
        </div>
      </div>

      <div className="mb-2">
        <VUMeter 
          level={source.muted ? 0 : level}
          width={300}
          height={20}
          showPeakIndicator={true}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">0</span>
        <input
          type="range"
          min="0"
          max="100"
          value={source.volume}
          onChange={(e) => onVolumeChange(parseInt(e.target.value))}
          disabled={source.muted}
          className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-xs text-gray-500">100</span>
      </div>
    </div>
  );
}

