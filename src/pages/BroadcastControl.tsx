/**
 * Broadcast Control Center
 * 
 * ONE-BUTTON broadcast system - simplified daily workflow
 * Replaces the complex multi-step process with single "START SHOW" button
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useBroadcast } from '../contexts/BroadcastContext';
import { StreamEncoder, StreamConfig } from '../services/streamEncoder';
import VUMeter from '../components/VUMeter';
import ParticipantBoard from '../components/ParticipantBoard';
import { detectCurrentShow, getShowDisplayName } from '../utils/showScheduler';

export default function BroadcastControl() {
  // Use broadcast context for persistent state
  const broadcast = useBroadcast();
  
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [playingOpener, setPlayingOpener] = useState(false);
  const [playingAd, setPlayingAd] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [masterLevel, setMasterLevel] = useState(0);
  
  // Audio device selection
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>(() => 
    localStorage.getItem('selectedMicId') || 'default'
  );
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>(() =>
    localStorage.getItem('selectedSpeakerId') || 'default'
  );
  
  // Duration from global context (persists across navigation!)
  const duration = broadcast.duration;
  
  // UI status indicators (local to this page)
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Show selection
  const [allShows, setAllShows] = useState<any[]>([]);
  const [selectedShow, setSelectedShow] = useState<any | null>(null);
  const [showChangeModal, setShowChangeModal] = useState(false);
  
  // Settings (load from localStorage)
  const [autoRecord, setAutoRecord] = useState(() => {
    const saved = localStorage.getItem('autoRecord');
    return saved !== null ? saved === 'true' : true;
  });
  const [autoStream, setAutoStream] = useState(() => {
    const saved = localStorage.getItem('autoStream');
    return saved !== null ? saved === 'true' : true;
  });
  const [radioCoPassword, setRadioCoPassword] = useState(() => {
    return localStorage.getItem('radioCoPassword') || '';
  });

  // Local refs (encoder still local, mixer from context)
  const encoderRef = useRef<StreamEncoder | null>(null);
  
  // Get state from context
  const status = broadcast.state;
  const audioSources = broadcast.audioSources;
  
  // Debug: log audioSources when they change
  useEffect(() => {
    if (audioSources.length > 0) {
      console.log('🎚️ [DEBUG] Audio sources updated:', audioSources.map(s => `${s.type}:${s.id}`));
    }
  }, [audioSources]);

  /**
   * Save settings to localStorage whenever they change
   */
  useEffect(() => {
    localStorage.setItem('autoRecord', autoRecord.toString());
  }, [autoRecord]);

  useEffect(() => {
    localStorage.setItem('autoStream', autoStream.toString());
  }, [autoStream]);

  useEffect(() => {
    if (radioCoPassword) {
      localStorage.setItem('radioCoPassword', radioCoPassword);
    }
  }, [radioCoPassword]);

  /**
   * Fetch shows and auto-detect current show on mount
   */
  useEffect(() => {
    fetchShows();
    enumerateAudioDevices();
  }, []);

  // Enumerate available audio input/output devices
  const enumerateAudioDevices = async () => {
    try {
      // Request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => stream.getTracks().forEach(track => track.stop()));
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices);
      
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
      
      console.log('🎤 Found', audioInputs.length, 'microphones');
      console.log('🔊 Found', audioOutputs.length, 'speakers');
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
    }
  };

  /**
   * Check for existing live episode on mount
   * Stop polling when show is live
   */
  useEffect(() => {
    if (status.isLive) {
      console.log('📡 [CHECK] Show is live, stopping polling');
      return; // Don't poll when live
    }
    
    checkForLiveEpisode();
    
    // Poll every 10 seconds (only when not live)
    const interval = setInterval(checkForLiveEpisode, 10000);
    return () => {
      console.log('📡 [CHECK] Clearing polling interval');
      clearInterval(interval);
    };
  }, [status.isLive]); // Re-run when isLive changes

  const fetchShows = async () => {
    try {
      const response = await fetch('/api/shows');
      const shows = await response.json();
      setAllShows(shows);
      
      // Auto-detect current show
      const detected = detectCurrentShow(shows);
      setSelectedShow(detected);
      console.log('✅ Auto-selected show:', detected?.name);
    } catch (error) {
      console.error('Error fetching shows:', error);
    }
  };

  const checkForLiveEpisode = async () => {
    try {
      // Don't check if we're already running a show!
      if (status.isLive) {
        console.log('📡 [CHECK] Already live, skipping check');
        return;
      }
      
      const response = await fetch('/api/episodes?status=live');
      const episodes = await response.json();
      
      if (episodes.length > 0) {
        const liveEpisode = episodes[0];
        console.log('📡 [CHECK] Found existing live episode:', liveEpisode.title);
        
        // Only update if it's different from current state
        if (status.episodeId !== liveEpisode.id) {
          console.log('📡 [CHECK] Updating to show existing episode');
          broadcast.setState({
            ...status,
            episodeId: liveEpisode.id,
            showId: liveEpisode.showId,
            showName: liveEpisode.title,
            startTime: liveEpisode.actualStart ? new Date(liveEpisode.actualStart) : new Date(),
            isLive: false, // Don't auto-mark as live
            selectedShow: null
          });
        }
      }
    } catch (error) {
      console.error('Error checking for live episode:', error);
    }
  };

  /**
   * Main "START SHOW" button handler
   * Does EVERYTHING automatically
   */
  const handleStartShow = async () => {
    setIsStarting(true);
    setErrorMessage('');

    try {
      console.log('🎙️ [START] Beginning broadcast sequence...');
      console.log('🎙️ [START] Current state:', { isLive: status.isLive, episodeId: status.episodeId });

      // Step 1: Get or create today's episode (use existing if available)
      let episode;
      if (status.episodeId) {
        // Episode already exists and is live
        const res = await fetch(`/api/episodes/${status.episodeId}`);
        episode = await res.json();
        console.log('✅ Using existing episode:', episode.id);
      } else {
        episode = await getOrCreateTodaysEpisode();
        console.log('✅ Episode ready:', episode.id);
        
        // Start the episode (go live)
        await fetch(`/api/episodes/${episode.id}/start`, { method: 'PATCH' });
        console.log('✅ Episode started');
      }

      // Step 3: Initialize Twilio device (for calls)
      console.log('🎙️ [START] Step 3: Initializing Twilio...');
      await broadcast.initializeTwilio(`host-${Date.now()}`);
      console.log('✅ [START] Twilio initialized');

      // Step 4: Initialize audio mixer (use global context)
      console.log('🎙️ [START] Step 4: Initializing mixer...');
      const mixerInstance = await broadcast.initializeMixer();
      console.log('✅ [START] Mixer initialized, instance:', !!mixerInstance);

      // Set up level monitoring
      console.log('🎙️ [START] Step 4: Setting up level monitoring...');
      mixerInstance.onLevelUpdate((sourceId, level) => {
        if (sourceId === 'master') {
          setMasterLevel(level);
        }
      });

      // Step 5: Connect microphone (using selected device)
      console.log('🎙️ [START] Step 5: Connecting microphone...');
      console.log('🎙️ [START] Selected mic ID:', selectedMicId);
      await mixerInstance.connectMicrophone(selectedMicId);
      console.log('✅ [START] Microphone connected');
      
      // IMPORTANT: Refresh audio sources so UI updates!
      broadcast.refreshAudioSources();
      console.log('🎚️ [START] Audio sources refreshed');

      // Step 6: Start recording (if enabled)
      if (autoRecord) {
        console.log('🎙️ [START] Step 6: Starting recording...');
        mixerInstance.startRecording();
        setIsRecording(true);
        console.log('✅ [START] Recording started');
      }

      // Step 7: Start Radio.co stream (if enabled and password provided)
      if (autoStream && radioCoPassword) {
        console.log('🎙️ [START] Step 7: Starting Radio.co stream...');
        console.log('   📡 Server: pear.radio.co:5568');
        console.log('   🔐 Password:', radioCoPassword.length > 0 ? '✓ Set' : '✗ Empty');
        
        try {
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
          const outputStream = mixerInstance.getOutputStream();
          
          if (!outputStream) {
            console.error('❌ [START] No output stream from mixer!');
            alert('⚠️ Warning: Could not get audio output stream. Streaming may not work.');
          } else {
            console.log('✅ [START] Got output stream from mixer');
            await encoder.startStreaming(outputStream);
            encoderRef.current = encoder;
            setIsStreaming(true);
            console.log('✅ [START] Streaming to Radio.co ACTIVE');
          }
        } catch (streamError) {
          console.error('❌ [START] Streaming failed:', streamError);
          alert(`⚠️ Failed to start Radio.co stream: ${streamError instanceof Error ? streamError.message : 'Unknown error'}\n\nCheck console for details.`);
        }
      } else {
        if (!autoStream) {
          console.log('ℹ️ [START] Auto-stream disabled - skipping Radio.co');
        } else if (!radioCoPassword) {
          console.log('⚠️ [START] No Radio.co password - skipping stream');
          console.log('   💡 To stream: Enable "Stream to Radio.co" and set password in settings below');
        }
      }

      // Update status in context (persists across pages!)
      const startTime = new Date();
      broadcast.setState({
        isLive: true,
        episodeId: episode.id,
        showId: episode.showId,
        showName: episode.title || 'Live Show',
        startTime: startTime,
        selectedShow: selectedShow
      });

      // Duration timer managed by BroadcastContext now (global!)
      console.log('✅ [START] Global timer will start automatically');

      console.log('🎉 SHOW STARTED! You are LIVE!');

      // AUTOMATICALLY play opener if show has one
      console.log('🎵 [START] Checking for show opener...');
      console.log('   Show:', selectedShow?.name);
      console.log('   Opener URL:', selectedShow?.openerAudioUrl || 'Not set');
      console.log('   Mixer:', mixerInstance ? 'Ready' : 'Not ready');
      
      if (selectedShow?.openerAudioUrl && mixerInstance) {
        console.log('🎵 [START] Playing show opener automatically...');
        setPlayingOpener(true);
        try {
          // Play opener through mixer (broadcasts to listeners AND your speakers!)
          await mixerInstance.playAudioFile(selectedShow.openerAudioUrl);
          console.log('✅ [START] Opener played successfully');
        } catch (openerError) {
          console.error('⚠️ [START] Failed to play opener:', openerError);
          alert(`⚠️ Could not play show opener: ${openerError instanceof Error ? openerError.message : 'Unknown error'}`);
          // Don't fail the whole start if opener fails
        } finally {
          setPlayingOpener(false);
        }
      } else {
        if (!selectedShow?.openerAudioUrl) {
          console.log('ℹ️ [START] No opener configured for this show');
          console.log('   💡 To add an opener: Go to Settings → Upload show opener');
        }
        if (!mixerInstance) {
          console.log('⚠️ [START] Mixer not ready - cannot play opener');
        }
      }

    } catch (error: any) {
      console.error('❌ [START] Failed to start show:', error);
      console.error('❌ [START] Error stack:', error.stack);
      setErrorMessage(error.message || 'Failed to start show');
      
      // Cleanup on error
      console.log('🧹 [START] Cleaning up after error...');
      await broadcast.destroyMixer();
    } finally {
      setIsStarting(false);
      console.log('🏁 [START] Start show sequence finished');
    }
  };

  /**
   * Main "END SHOW" button handler
   * Cleans up EVERYTHING automatically
   */
  const handleEndShow = async () => {
    if (!status.episodeId) {
      console.warn('⚠️ [END] No episode to end');
      return;
    }
    
    if (!status.isLive) {
      console.warn('⚠️ [END] Not currently live');
      return;
    }

    setIsEnding(true);

    try {
      console.log('📴 [END] Ending show...');
      console.log('📴 [END] Episode ID:', status.episodeId);

      // AUTOMATICALLY play end-of-show commercials (up to 3)
      if (selectedShow?.id && broadcast.mixer) {
        try {
          // Fetch assigned commercials for this show
          const commercialsResponse = await fetch(`/api/shows/${selectedShow.id}/commercials`);
          const commercials = await commercialsResponse.json();
          
          if (commercials.length > 0) {
            console.log(`📢 [END] Playing ${commercials.length} end-of-show commercials...`);
            setPlayingAd(true);
            
            for (const commercial of commercials) {
              try {
                console.log(`  ▶️ Playing commercial ${commercial.slot}: ${commercial.audioAsset.name}`);
                await broadcast.mixer.playAudioFile(commercial.audioAsset.fileUrl);
                console.log(`  ✅ Commercial ${commercial.slot} completed`);
              } catch (commercialError) {
                console.error(`  ⚠️ Failed to play commercial ${commercial.slot}:`, commercialError);
                // Continue with next commercial even if one fails
              }
            }
            
            setPlayingAd(false);
            console.log('✅ [END] All commercials played successfully');
          } else {
            console.log('ℹ️ [END] No commercials assigned to this show');
          }
        } catch (commercialsError) {
          console.error('⚠️ [END] Failed to fetch/play commercials:', commercialsError);
          setPlayingAd(false);
          // Continue with ending even if commercials fail
        }
      }

      // Disconnect all active calls first
      if (broadcast.activeCalls.size > 0) {
        console.log('📞 [END] Disconnecting', broadcast.activeCalls.size, 'active calls...');
        const callIds = Array.from(broadcast.activeCalls.keys());
        
        for (const callId of callIds) {
          try {
            await broadcast.disconnectCall(callId);
            
            // Also mark call as completed in database
            await fetch(`/api/calls/${callId}/complete`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ airDuration: 0 })
            });
          } catch (callError) {
            console.error('⚠️ [END] Failed to disconnect call:', callId, callError);
          }
        }
        console.log('✅ [END] All calls disconnected');
      }

      // Duration timer stops automatically via context when isLive becomes false

      // Stop streaming
      if (encoderRef.current && isStreaming) {
        await encoderRef.current.stopStreaming();
        await encoderRef.current.destroy();
        encoderRef.current = null;
        setIsStreaming(false);
        console.log('✅ Streaming stopped');
      }

      // Stop recording and download (S3 upload optional for now)
      if (broadcast.mixer && isRecording) {
        try {
          const now = new Date();
          const showSlug = selectedShow?.slug || status.selectedShow?.slug || 'show';
          const dateStr = now.toISOString().split('T')[0]; // 2025-10-21
          const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // 15-30-00
          const filename = `${showSlug}-${dateStr}-${timeStr}.webm`;
          
          console.log('📴 [END] Stopping recording...');
          await broadcast.mixer.downloadRecording(filename);
          console.log('✅ [END] Recording downloaded:', filename);
        } catch (recordError) {
          console.error('❌ [END] Error with recording:', recordError);
        }
      }

      // Destroy mixer (from context)
      console.log('📴 [END] Destroying mixer...');
      await broadcast.destroyMixer();
      console.log('✅ [END] Mixer cleaned up');

      // End the episode (even if it fails, continue cleanup)
      try {
        console.log('📴 [END] Ending episode in database...');
        const endRes = await fetch(`/api/episodes/${status.episodeId}/end`, { method: 'PATCH' });
        if (endRes.ok) {
          console.log('✅ [END] Episode ended in database');
        } else {
          const errorData = await endRes.json().catch(() => ({}));
          console.warn('⚠️ [END] Episode end failed:', errorData);
        }
      } catch (endError) {
        console.warn('⚠️ [END] Error ending episode:', endError);
      }

      // Reset status in context
      console.log('📴 [END] Resetting state...');
      broadcast.setState({
        isLive: false,
        episodeId: null,
        showId: null,
        showName: '',
        startTime: null,
        selectedShow: null
      });
      
      // Reset local UI states
      setIsRecording(false);
      setIsStreaming(false);
      // Duration resets automatically via context

      console.log('🎉 [END] Show ended successfully!');

    } catch (error) {
      console.error('❌ Error ending show:', error);
      setErrorMessage('Error ending show. Please try again.');
    } finally {
      setIsEnding(false);
    }
  };

  /**
   * Get or create today's episode
   */
  const getOrCreateTodaysEpisode = async () => {
    // Use selected show
    if (!selectedShow) {
      throw new Error('No show selected. Please select a show first.');
    }

    const show = selectedShow;

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

    // Create today's episode with proper naming
    const now = new Date();
    const endTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
    
    // Format date as "Oct 21, 2025"
    const formattedDate = now.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });

    const createRes = await fetch('/api/episodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showId: show.id,
        title: `${show.name} - ${formattedDate}`,
        date: now.toISOString(),
        scheduledStart: now.toISOString(),
        scheduledEnd: endTime.toISOString(),
        description: `Auto-created episode for ${show.name}`
      })
    });

    if (!createRes.ok) {
      throw new Error('Failed to create episode');
    }

    return await createRes.json();
  };

  // Timer and participant management now handled globally in BroadcastContext!

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
              {status.episodeId ? (
                /* Episode exists but mixer not connected */
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></span>
                    <h2 className="text-3xl font-bold">Episode Live</h2>
                  </div>
                  <p className="text-xl text-gray-300 mb-2">{status.showName}</p>
                  <p className="text-gray-400 mb-4">This episode was started earlier</p>
                  <button
                    onClick={async () => {
                      // End the old episode
                      await fetch(`/api/episodes/${status.episodeId}/end`, { method: 'PATCH' });
                      // Reset state
                      broadcast.setState({
                        isLive: false,
                        episodeId: null,
                        showId: null,
                        showName: '',
                        startTime: null,
                        selectedShow: null
                      });
                      console.log('✅ Old episode ended');
                    }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-semibold mb-4"
                  >
                    End Old Episode & Start Fresh
                  </button>
                </div>
              ) : (
                <div className="text-center mb-6">
                  <h2 className="text-3xl font-bold mb-4">Ready to Broadcast</h2>
                  
                  {/* Show Selector */}
                  {selectedShow ? (
                    <div className="inline-block">
                      <div className="flex items-center gap-3 bg-gray-900 rounded-lg px-6 py-3 border-2 border-gray-600">
                        <div className="text-left">
                          <div className="text-xs text-gray-500 mb-1">Today's Show</div>
                          <div className="text-xl font-bold" style={{ color: selectedShow.color }}>
                            {getShowDisplayName(selectedShow)}
                          </div>
                        </div>
                        <button
                          onClick={() => setShowChangeModal(true)}
                          className="ml-4 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                          title="Change show"
                        >
                          ↻
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400">Loading shows...</p>
                  )}
                </div>
              )}

              {/* Audio Device Selection */}
              <div className="bg-gray-900 rounded-lg p-4 mb-6 space-y-3">
                <h3 className="font-semibold mb-3 text-sm text-gray-400">Audio Devices</h3>
                
                {/* Microphone Selection */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Microphone</label>
                  <select
                    value={selectedMicId}
                    onChange={(e) => {
                      setSelectedMicId(e.target.value);
                      localStorage.setItem('selectedMicId', e.target.value);
                      console.log('🎤 Microphone changed to:', e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
                  >
                    <option value="default">Default Microphone</option>
                    {audioDevices
                      .filter(d => d.kind === 'audioinput')
                      .map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microphone ${device.deviceId.slice(0, 8)}...`}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Speaker Selection */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Speakers/Headphones</label>
                  <select
                    value={selectedSpeakerId}
                    onChange={(e) => {
                      setSelectedSpeakerId(e.target.value);
                      localStorage.setItem('selectedSpeakerId', e.target.value);
                      console.log('🔊 Speaker changed to:', e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
                  >
                    <option value="default">Default Speakers</option>
                    {audioDevices
                      .filter(d => d.kind === 'audiooutput')
                      .map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Speakers ${device.deviceId.slice(0, 8)}...`}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {audioDevices.filter(d => d.kind === 'audiooutput').length === 0 
                      ? '⚠️ Speaker selection not supported in this browser' 
                      : 'Select where you want to hear the show'}
                  </p>
                </div>
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
                    <label className="block text-xs text-gray-400 mb-1">
                      Radio.co Password
                      {radioCoPassword && (
                        <span className="ml-2 text-green-500">✓ Saved</span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={radioCoPassword}
                        onChange={(e) => setRadioCoPassword(e.target.value)}
                        placeholder="Enter your Radio.co password"
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
                      />
                      {radioCoPassword && (
                        <button
                          onClick={() => {
                            setRadioCoPassword('');
                            localStorage.removeItem('radioCoPassword');
                          }}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                          title="Clear saved password"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* BIG START BUTTON - Only show if NO old episode */}
              {!status.episodeId && (
                <>
                  <button
                    onClick={handleStartShow}
                    disabled={isStarting || !selectedShow}
                    className="w-full py-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-bold text-2xl transition-all transform hover:scale-105 disabled:scale-100"
                  >
                    {isStarting 
                      ? '⏳ Starting...' 
                      : selectedShow
                      ? `🎙️ START ${selectedShow.name.toUpperCase()} - GO LIVE!`
                      : '⏳ Loading...'}
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
              )}
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
                <p className="text-2xl font-mono text-green-400 mt-2">{duration}</p>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <StatusItem 
                  icon="🎤" 
                  label="Microphone" 
                  value={broadcast.mixer && audioSources.some(s => s.type === 'host') ? 'Connected' : 'Disconnected'}
                  active={!!(broadcast.mixer && audioSources.some(s => s.type === 'host'))}
                />
                <StatusItem 
                  icon="⏺️" 
                  label="Recording" 
                  value={isRecording ? 'Active' : 'Off'}
                  active={isRecording}
                />
                <StatusItem 
                  icon="📡" 
                  label="Radio.co Stream" 
                  value={isStreaming ? 'Live ✓' : 'Off'}
                  active={isStreaming}
                />
              </div>

              {/* Stream Diagnostics (if streaming is supposed to be on but isn't) */}
              {autoStream && radioCoPassword && !isStreaming && status.isLive && (
                <div className="mb-6 p-4 bg-yellow-900/30 border-2 border-yellow-500 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <div className="font-bold text-yellow-400">Radio.co Stream Not Active</div>
                      <div className="text-sm text-gray-300 mt-1">
                        Auto-stream is enabled but not connected. Check console (F12) for errors.
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        Config: pear.radio.co:5568 • Password: {'*'.repeat(radioCoPassword.length)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Audio Playback Indicator */}
              {(playingOpener || playingAd) && (
                <div className="mb-6 p-4 bg-purple-900/30 border-2 border-purple-500 rounded-lg animate-pulse">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-3xl">🎵</span>
                    <div className="text-center">
                      <div className="font-bold text-lg">
                        {playingOpener ? 'Playing Show Opener...' : 'Playing Ad...'}
                      </div>
                      <div className="text-sm text-gray-400">Audio broadcasting now</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Master VU Meter */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Master Output Level</label>
                <VUMeter level={masterLevel} width={600} height={40} />
              </div>

              {/* Multi-Caller Participant Management */}
              {status.episodeId && (
                <div className="mb-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span>👥</span>
                    <span>Active Participants</span>
                  </h2>
                  <ParticipantBoard episodeId={status.episodeId} />
                </div>
              )}

              {/* BIG END BUTTON */}
              <button
                onClick={handleEndShow}
                disabled={isEnding}
                className="w-full py-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-2xl transition-all"
              >
                {isEnding ? '⏳ Ending Show...' : '⏹️ END SHOW'}
              </button>

              <p className="text-center text-xs text-gray-500 mt-4">
                {isEnding ? 'Stopping streaming and saving recording...' : 'This will stop streaming, save your recording, and end the episode'}
              </p>
            </>
          )}
        </div>

        {/* Quick Links */}
        {status.isLive && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/host-dashboard"
                className="block p-4 bg-gray-800 rounded-lg text-center hover:bg-gray-700 transition-colors"
              >
                <div className="text-2xl mb-2">📊</div>
                <div className="text-sm">Full Dashboard</div>
                <div className="text-xs text-gray-500 mt-1">View calls & documents</div>
              </Link>
              <Link
                to="/screening-room"
                className="block p-4 bg-gray-800 rounded-lg text-center hover:bg-gray-700 transition-colors"
              >
                <div className="text-2xl mb-2">🔍</div>
                <div className="text-sm">Screening Room</div>
                <div className="text-xs text-gray-500 mt-1">Screen incoming calls</div>
              </Link>
            </div>
            <p className="text-center text-xs text-gray-500 mt-4">
              💡 Tip: Audio controls are above. Mixer stays connected when you switch pages!
            </p>
          </>
        )}
      </div>

      {/* Show Change Modal */}
      {showChangeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-2xl font-bold mb-4">Select Show</h3>
            <div className="space-y-2 mb-6">
              {allShows.map((show) => (
                <button
                  key={show.id}
                  onClick={() => {
                    setSelectedShow(show);
                    setShowChangeModal(false);
                    console.log('✅ Show changed to:', show.name);
                  }}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    selectedShow?.id === show.id
                      ? 'bg-gray-700 border-2 border-blue-500'
                      : 'bg-gray-900 border-2 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-lg" style={{ color: show.color }}>
                        {show.name}
                      </div>
                      <div className="text-sm text-gray-400">
                        {getShowDisplayName(show)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {show.description}
                      </div>
                    </div>
                    {selectedShow?.id === show.id && (
                      <span className="text-green-500 text-2xl">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowChangeModal(false)}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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

