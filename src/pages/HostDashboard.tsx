import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import ChatPanel from '../components/ChatPanel';
import ParticipantBoard from '../components/ParticipantBoard';
import { useBroadcast } from '../contexts/BroadcastContext';
import { Card, Button, Badge, Tabs, Tab, EmptyState } from '../components/ui';

export default function HostDashboard() {
  const broadcast = useBroadcast(); // Access global mixer
  
  const [activeEpisode, setActiveEpisode] = useState<any>(null);
  const [isLive, setIsLive] = useState(false);
  
  const [approvedCalls, setApprovedCalls] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'calls' | 'documents' | 'announcements' | 'history'>('calls');
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [todaysAnnouncements, setTodaysAnnouncements] = useState<any[]>([]);
  const [completedCalls, setCompletedCalls] = useState<any[]>([]);
  const [autoPlayAnnouncements, setAutoPlayAnnouncements] = useState(() => 
    localStorage.getItem('autoPlayAnnouncements') !== 'false'
  );
  const activeAudioElementsRef = useRef<HTMLAudioElement[]>([]); // Track audio elements to stop them if needed
  

  useEffect(() => {
    // Fetch active episode from database
    fetchActiveEpisode();
    fetchTodaysAnnouncements();
    
    // Poll every 10 seconds for updates
    const interval = setInterval(fetchActiveEpisode, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Fetch completed calls when history tab is active
  useEffect(() => {
    if (activeTab === 'history' && activeEpisode) {
      fetchCompletedCalls();
      // Refresh every 5 seconds to catch new transcriptions/analysis
      const interval = setInterval(fetchCompletedCalls, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, activeEpisode]);

  const fetchCompletedCalls = async () => {
    if (!activeEpisode) return;
    try {
      // Get all calls for the episode (we'll filter for completed/ended)
      const allCallsResponse = await fetch(`/api/calls?episodeId=${activeEpisode.id}`);
      const allCalls = await allCallsResponse.json();
      
      // Filter for completed/ended calls
      const completed = allCalls.filter((call: any) => 
        call.status === 'completed' || call.endedAt !== null
      );
      
      // Sort by most recent first
      completed.sort((a: any, b: any) => {
        const aTime = new Date(a.endedAt || a.onAirAt || a.incomingAt).getTime();
        const bTime = new Date(b.endedAt || b.onAirAt || b.incomingAt).getTime();
        return bTime - aTime;
      });
      
      setCompletedCalls(completed);
    } catch (error) {
      console.error('Error fetching completed calls:', error);
    }
  };

  // Also check broadcast context for episode updates (in case screener opened lines)
  useEffect(() => {
    const contextEpisodeId = broadcast.state.episodeId;
    const contextIsLive = broadcast.state.isLive;
    
    // DEFENSIVE: If context has an episode we don't know about, fetch it immediately
    if (contextEpisodeId && (!activeEpisode || activeEpisode.id !== contextEpisodeId)) {
      console.log('📡 [HOST] Broadcast context has new episode, fetching:', contextEpisodeId);
      fetch(`/api/episodes/${contextEpisodeId}`)
        .then(res => res.json())
        .then(episode => {
          console.log('✅ [HOST] Loaded episode from context:', episode.title);
          setActiveEpisode(episode);
          setIsLive(episode.status === 'live' || contextIsLive);
        })
        .catch(err => console.error('❌ [HOST] Error fetching episode from context:', err));
    }
    
    // RECOVERY: If we lost our episode but context says we're live, recover it
    // BUT: Don't trigger if we just ended the show (context updates async)
    if (!activeEpisode && contextEpisodeId && contextIsLive) {
      // Wait a moment to see if this is a legitimate end or accidental loss
      const checkTimeout = setTimeout(() => {
        // Double-check: if context STILL says live after 2 seconds, recover
        if (broadcast.state.isLive && broadcast.state.episodeId) {
          console.warn('🔄 [HOST] RECOVERY: Lost episode during live show, restoring from context...');
          fetch(`/api/episodes/${broadcast.state.episodeId}`)
            .then(res => res.json())
            .then(episode => {
              console.log('✅ [HOST] RECOVERED episode:', episode.title);
              setActiveEpisode(episode);
              setIsLive(true);
              // Show alert silently in console, not popup (less disruptive)
              console.log('⚠️ [HOST] Episode state recovered automatically');
            })
            .catch(err => {
              console.error('❌ [HOST] RECOVERY FAILED:', err);
            });
        } else {
          console.log('ℹ️ [HOST] Episode cleared intentionally, no recovery needed');
        }
      }, 2000);
      
      return () => clearTimeout(checkTimeout);
    }
  }, [broadcast.state.episodeId, broadcast.state.isLive, activeEpisode]);

  useEffect(() => {
    if (activeEpisode) {
      fetchApprovedCalls();
      
      // Poll every 2 seconds
      const interval = setInterval(() => {
        fetchApprovedCalls();
      }, 2000);
      
      // Also listen for WebSocket events for immediate updates
      const socket = io();
      
      console.log('🔌 [HOST] Joining episode room:', activeEpisode.id);
      socket.emit('join:episode', activeEpisode.id);
      
      socket.on('call:approved', (data) => {
        console.log('🔔 [HOST] Call approved event received:', data);
        fetchApprovedCalls();
      });
      
      socket.on('call:completed', () => {
        console.log('🔔 Call completed event - refreshing queue');
        fetchApprovedCalls();
        // On-air call managed globally now - no need to clear locally
      });
      
      socket.on('episode:lines-opened', (episode) => {
        console.log('📞 [HOST] Lines opened event:', episode);
        setActiveEpisode(episode);
        setIsLive(false);
      });
      
      socket.on('episode:start', (episode) => {
        console.log('🎙️ [HOST] Episode started event:', episode);
        setActiveEpisode(episode);
        setIsLive(true);
      });
      
      socket.on('episode:end', (episode) => {
        console.log('📴 [HOST] Episode ended event:', episode);
        // DEFENSIVE: Only clear if this is actually OUR episode
        if (episode.id === activeEpisode.id) {
          console.log('   Clearing active episode (confirmed match)');
          setActiveEpisode(null);
          setIsLive(false);
          setApprovedCalls([]);
        } else {
          console.warn('   ⚠️ Received episode:end for different episode, ignoring');
        }
      });
      
      return () => {
        clearInterval(interval);
        socket.off('call:completed');
        socket.off('call:approved');
        socket.off('episode:lines-opened');
        socket.off('episode:lines-closed');
        socket.off('episode:start');
        socket.off('episode:end');
        socket.close();
      };
    }
  }, [activeEpisode]);

  // Fetch documents whenever approved calls change
  useEffect(() => {
    if (approvedCalls.length > 0) {
      fetchAllDocuments();
    }
  }, [approvedCalls]);

  const fetchAllDocuments = async () => {
    if (!activeEpisode) return;
    
    try {
      // Fetch documents for CURRENT approved calls only (by callId, not callerId)
      const callIds = approvedCalls.map(c => c.id).filter(Boolean);
      console.log('📄 Fetching documents for current approved calls:', callIds.length);
      
      if (callIds.length === 0) {
        console.log('⚠️ No approved calls yet');
        setAllDocuments([]);
        return;
      }

      const promises = callIds.map(callId =>
        fetch(`/api/analysis/documents?callId=${callId}`).then(r => r.json())
      );
      
      const results = await Promise.all(promises);
      const allDocs = results.flat();
      console.log('📄 Fetched documents for current calls:', allDocs.length, 'total');
      setAllDocuments(allDocs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchTodaysAnnouncements = async () => {
    try {
      const response = await fetch('/api/announcements/today');
      const data = await response.json();
      setTodaysAnnouncements(data.announcements || []);
      console.log(`📢 [HOST] Loaded ${data.announcements?.length || 0} announcements for today`);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  const fetchApprovedCalls = async () => {
    if (!activeEpisode) return;
    try {
      const response = await fetch(`/api/calls?episodeId=${activeEpisode.id}&status=approved`);
      const calls = await response.json();
      
      console.log(`📞 [HOST] Fetching approved calls for episode: ${activeEpisode.id}`);
      console.log(`   API returned ${calls.length} calls with status=approved`);
      
      // Filter for truly active calls (not ended, recent)
      const now = Date.now();
      const activeCalls = calls.filter((call: any) => {
        const isEnded = call.endedAt !== null;
        const isCompleted = call.status === 'completed';
        const callTime = new Date(call.incomingAt || call.createdAt).getTime();
        const age = now - callTime;
        const isTooOld = age > 4 * 60 * 60 * 1000;
        
        if (isEnded) {
          console.log(`   🗑️ Filtering out ended call: ${call.id}`);
          return false;
        }
        if (isCompleted) {
          console.log(`   🗑️ Filtering out completed call: ${call.id}`);
          return false;
        }
        if (isTooOld) {
          console.log(`   🗑️ Filtering out old call: ${call.id} (age: ${Math.round(age/1000/60)} min)`);
          return false;
        }
        
        console.log(`   ✅ Active call: ${call.caller?.name || 'Unknown'} (${call.id})`);
        return true;
      });
      
      console.log(`📞 [HOST] Approved calls: ${activeCalls.length} (filtered from ${calls.length} total)`);
      setApprovedCalls(activeCalls);
    } catch (error) {
      console.error('Error fetching approved calls:', error);
    }
  };

  const fetchActiveEpisode = async () => {
    try {
      // Use episode from broadcast context first
      const contextEpisodeId = broadcast.state.episodeId;
      
      if (contextEpisodeId) {
        const response = await fetch(`/api/episodes/${contextEpisodeId}`);
        const episode = await response.json();
        setActiveEpisode(episode);
        setIsLive(episode.status === 'live');
        console.log('✅ Found episode from context:', episode.title);
        return;
      }
      
      // Fallback: fetch live episodes
      const response = await fetch('/api/episodes?status=live');
      const episodes = await response.json();
      
      if (episodes.length > 0) {
        setActiveEpisode(episodes[0]);
        setIsLive(true);
        console.log('✅ Found live episode:', episodes[0].title);
      } else {
        setActiveEpisode(null);
        setIsLive(false);
        console.log('⚠️ No live episodes found');
      }
    } catch (error) {
      console.error('Error fetching episode:', error);
      setActiveEpisode(null);
      setIsLive(false);
    }
  };

  const startBroadcast = async () => {
    if (!activeEpisode) return;
    
    try {
      console.log('🎙️ [START-BROADCAST] Starting show broadcast...');
      
      // CRITICAL: Disconnect any existing calls first (e.g., if you were on Screening Room)
      if (broadcast.activeCalls.size > 0) {
        console.log('📞 [START-BROADCAST] Disconnecting existing calls before starting show...');
        await broadcast.disconnectCurrentCall();
        // Wait for disconnect to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ [START-BROADCAST] Existing calls disconnected');
      }
      
      // Get show for opener
      const showResponse = await fetch(`/api/shows/${activeEpisode.showId}`);
      const show = showResponse.ok ? await showResponse.json() : null;
      
      // Step 1: Connect host to conference (using session device)
      console.log('🔄 [START-BROADCAST] Connecting host to conference...');
      await broadcast.connectToCall(`host-${activeEpisode.id}`, 'Host', activeEpisode.id, 'host');
      
      // Step 2: Initialize mixer
      const mixerInstance = await broadcast.initializeMixer();
      
      // Step 3: Connect host mic
      await mixerInstance.connectMicrophone('default');
      broadcast.refreshAudioSources();
      
      // Step 4: Start recording
      const autoRecord = localStorage.getItem('autoRecord') !== 'false';
      if (autoRecord) {
        mixerInstance.startRecording();
      }
      
      // Step 5: Start streaming (if enabled)
      const autoStream = localStorage.getItem('autoStream') !== 'false';
      const radioCoPassword = localStorage.getItem('radioCoPassword') || '';
      
      if (autoStream && radioCoPassword) {
        const { StreamEncoder } = await import('../services/streamEncoder');
        const encoder = new StreamEncoder();
        encoder.configure({
          serverUrl: 's923c25be7.dj.radio.co',
          port: 80,
          password: radioCoPassword,
          streamName: activeEpisode.title || 'AudioRoad Network LIVE',
          genre: 'Trucking',
          url: 'http://audioroad.letstruck.com',
          bitrate: 256,
          mode: 'radio.co' as const
        });
        const outputStream = mixerInstance.getOutputStream();
        if (outputStream) {
          await encoder.startStreaming(outputStream);
        }
      }
      
      // Step 6: Mark episode as live
      const response = await fetch(`/api/episodes/${activeEpisode.id}/start`, { method: 'PATCH' });
      
      if (!response.ok) {
        throw new Error('Failed to start episode');
      }
      
      const episode = await response.json();
      setActiveEpisode(episode);
      setIsLive(true);
      
      // Update global state
      broadcast.setState({
        isLive: true,
        linesOpen: false,  // Lines were open, now show is live
        episodeId: episode.id,
        showId: episode.showId,
        showName: episode.title || 'Live Show',
        startTime: new Date(),
        selectedShow: show
      });
      
      // Step 6b: Take all approved callers OFF hold so they hear the live show
      console.log('📞 [START-BROADCAST] Taking approved callers off hold...');
      try {
        const approvedResponse = await fetch(`/api/calls?episodeId=${activeEpisode.id}&status=approved`);
        console.log(`   Response status: ${approvedResponse.status}`);
        
        if (approvedResponse.ok) {
          const approvedCallers = await approvedResponse.json();
          console.log(`   Found ${approvedCallers.length} approved callers in queue`);
          console.log(`   Caller IDs:`, approvedCallers.map((c: any) => c.id));
          
          // Take each off hold sequentially (not concurrent) for better logging
          for (const caller of approvedCallers) {
            try {
              console.log(`   📞 Taking ${caller.caller?.name || caller.id} off hold...`);
              const offHoldRes = await fetch(`/api/participants/${caller.id}/off-hold`, { method: 'PATCH' });
              console.log(`   Response: ${offHoldRes.status} - ${offHoldRes.ok ? 'Success' : 'Failed'}`);
              
              if (offHoldRes.ok) {
                console.log(`   ✅ ${caller.caller?.name || 'Caller'} can now hear live show`);
              } else {
                const errorText = await offHoldRes.text();
                console.error(`   ❌ Failed to take ${caller.id} off hold: ${errorText}`);
              }
            } catch (err) {
              console.error(`   ⚠️ Exception taking ${caller.id} off hold:`, err);
            }
          }
        } else {
          console.error(`   ❌ Failed to fetch approved callers: ${approvedResponse.status}`);
        }
      } catch (err) {
        console.error('⚠️ Failed to process approved callers:', err);
        // Continue anyway - not critical to show starting
      }
      
      // IMPORTANT: Wait a moment for hold state to fully clear in Twilio
      // Without this delay, callers won't hear announcements/opener
      console.log('⏳ [START-BROADCAST] Waiting for hold state to clear...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✅ [START-BROADCAST] Ready to play audio');
      
      // Step 7: Play today's announcements (if enabled)
      // NOTE: Announcements play through mixer (for stream) AND Twilio conference (for callers)
      if (autoPlayAnnouncements && todaysAnnouncements.length > 0) {
        console.log(`📢 [ANNOUNCEMENTS] Playing ${todaysAnnouncements.length} announcement(s)...`);
        
        for (const announcement of todaysAnnouncements) {
          try {
            console.log(`  ▶️ Playing: ${announcement.name}`);
            
            // Play through mixer (for stream/recording)
            const mixerPlayPromise = mixerInstance.playAudioFile(announcement.fileUrl);
            
            // Play locally for host
            const localAudio = new Audio(announcement.fileUrl);
            localAudio.volume = 0.7;
            activeAudioElementsRef.current.push(localAudio); // Track for potential stopping
            const localPlayPromise = localAudio.play();
            
            // Clean up when done
            localAudio.onended = () => {
              activeAudioElementsRef.current = activeAudioElementsRef.current.filter(a => a !== localAudio);
            };
            
            // CRITICAL: Play directly to Twilio conference so CALLERS hear it
            // Mixer output doesn't go to Twilio - only host mic does
            // So we need to play audio file directly in the conference
            const twilioPlayPromise = fetch(`/api/twilio/play-in-conference`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                episodeId: activeEpisode.id,
                audioUrl: announcement.fileUrl
              })
            });
            
            // Wait for all to finish
            await Promise.all([mixerPlayPromise, localPlayPromise, twilioPlayPromise]).catch(err => {
              console.warn(`  ⚠️ Announcement playback warning:`, err);
            });
            
            console.log(`  ✅ Announcement played: ${announcement.name}`);
          } catch (announcementError) {
            console.error(`  ❌ Failed to play announcement:`, announcementError);
            // Continue with next announcement
          }
        }
        
        console.log('✅ [ANNOUNCEMENTS] All announcements played');
      } else if (autoPlayAnnouncements && todaysAnnouncements.length === 0) {
        console.log('ℹ️ [ANNOUNCEMENTS] Auto-play enabled but no announcements for today');
      }
      
      // Step 8: Play show opener 
      if (show?.openerAudioUrl) {
        console.log('🎵 [OPENER] Playing show opener...');
        const sourcesBefore = mixerInstance.getSources();
        console.log('🔍 [DEBUG] Active audio sources before opener:', JSON.stringify(sourcesBefore.map(s => ({ id: s.id, type: s.type, label: s.label, volume: s.volume, muted: s.muted })), null, 2));
        
        // Play through mixer (for stream/recording)
        const mixerPlayPromise = mixerInstance.playAudioFile(show.openerAudioUrl);
        
        // Play locally for host
        const localAudio = new Audio(show.openerAudioUrl);
        localAudio.volume = 0.7;
        activeAudioElementsRef.current.push(localAudio); // Track for potential stopping
        const localPlayPromise = localAudio.play();
        
        // Clean up when done
        localAudio.onended = () => {
          activeAudioElementsRef.current = activeAudioElementsRef.current.filter(a => a !== localAudio);
        };
        
        // CRITICAL: Play directly to Twilio conference so CALLERS hear it
        const twilioPlayPromise = fetch(`/api/twilio/play-in-conference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            episodeId: activeEpisode.id,
            audioUrl: show.openerAudioUrl
          })
        });
        
        // Wait for all to finish
        await Promise.all([mixerPlayPromise, localPlayPromise, twilioPlayPromise]).catch(err => {
          console.warn('⚠️ Opener playback warning:', err);
        });
        
        console.log('✅ [OPENER] Opener played');
        const sourcesAfter = mixerInstance.getSources();
        console.log('🔍 [DEBUG] Active audio sources after opener:', JSON.stringify(sourcesAfter.map(s => ({ id: s.id, type: s.type, label: s.label, volume: s.volume, muted: s.muted })), null, 2));
        
        // Check for any unexpected audio sources
        const unexpectedSources = sourcesAfter.filter(s => s.id !== 'host-mic' && s.type !== 'file');
        if (unexpectedSources.length > 0) {
          console.warn('⚠️ [DEBUG] Found unexpected audio sources:', unexpectedSources);
        }
      }
      
      console.log('🎉 SHOW STARTED! You are LIVE!');
      
      // Cleanup: Stop any lingering audio elements (in case of errors)
      setTimeout(() => {
        activeAudioElementsRef.current.forEach(audio => {
          if (!audio.paused) {
            console.log('🛑 [START-BROADCAST] Stopping lingering audio element');
            audio.pause();
            audio.currentTime = 0;
          }
        });
        activeAudioElementsRef.current = [];
      }, 60000); // After 60 seconds, clean up any stuck audio
      
    } catch (error) {
      console.error('❌ [START-BROADCAST] Error:', error);
      alert(`Failed to start show: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const endEpisode = async () => {
    if (!activeEpisode) return;
    
    try {
      console.log('📴 [HOST] Ending episode from Host Dashboard');
      
      // Step 1: Stop and download recording if it was recording
      let recordingUrl = null;
      if (broadcast.mixer) {
        try {
          console.log('🔴 [END] Stopping recording...');
          const blob = await broadcast.mixer.stopRecording();
          console.log(`✅ [END] Recording stopped (${blob.size} bytes)`);
          
          // Generate filename
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const filename = `audioroad-${activeEpisode.title.replace(/[^a-z0-9]/gi, '-')}-${timestamp}.webm`;
          
          // Download to user's computer
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(downloadUrl);
          console.log('✅ [END] Recording downloaded to computer');
          
          // ALSO upload to S3 for cloud storage and playback
          console.log('☁️ [END] Uploading recording to S3...');
          try {
            const formData = new FormData();
            formData.append('recording', blob, filename);
            formData.append('episodeId', activeEpisode.id);
            formData.append('showSlug', activeEpisode.show?.slug || 'show');
            
            const uploadRes = await fetch('/api/recordings/upload', {
              method: 'POST',
              body: formData
            });
            
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              recordingUrl = uploadData.url;
              console.log('✅ [END] Recording uploaded to S3:', recordingUrl);
            } else {
              console.warn('⚠️ [END] S3 upload failed, saving local reference');
              recordingUrl = `local://${filename}`;
            }
          } catch (uploadError) {
            console.error('⚠️ [END] S3 upload error:', uploadError);
            recordingUrl = `local://${filename}`;
          }
        } catch (recordError) {
          console.error('⚠️ [END] Error with recording:', recordError);
          // Continue anyway - don't block episode ending
        }
      }
      
      // Step 2: Destroy mixer to clean up audio resources
      console.log('📴 [END] Destroying mixer...');
      await broadcast.destroyMixer();
      console.log('✅ [END] Mixer cleaned up');
      
      // Step 3: End the episode in database
      const response = await fetch(`/api/episodes/${activeEpisode.id}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingUrl
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to end episode');
      }
      
      await response.json();
      setActiveEpisode(null);
      setIsLive(false);
      
      // Step 4: Update global broadcast state so Broadcast Control knows!
      broadcast.setState({
        isLive: false,
        linesOpen: false,
        episodeId: null,
        showId: null,
        showName: '',
        startTime: null,
        selectedShow: null
      });
      
      console.log('✅ [HOST] Episode ended and global state updated');
      
      if (recordingUrl) {
        alert('✅ Show ended! Recording has been downloaded to your computer.');
      }
      
    } catch (error) {
      console.error('Error ending episode:', error);
      alert(`Error ending episode: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  const tabs: Tab[] = [
    { id: 'calls', label: 'Calls' },
    { id: 'history', label: 'Call History' },
    { id: 'documents', label: 'Documents' },
    { id: 'announcements', label: `Announcements ${todaysAnnouncements.length > 0 ? `(${todaysAnnouncements.length})` : ''}` },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-2 dark:bg-dark overflow-hidden">
      {/* TailAdmin Header */}
      <div className="px-6 py-4 bg-white dark:bg-gray-dark border-b border-stroke dark:border-dark-3 shadow-1">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {isLive && <Badge variant="danger" dot className="animate-pulse">LIVE</Badge>}
            <h2 className="text-title-md text-dark dark:text-white">
              {activeEpisode?.title || 'Host Control Center'}
            </h2>
            {activeEpisode && <Badge variant="neutral">Episode {activeEpisode.episodeNumber}</Badge>}
          </div>
          <div className="flex items-center gap-3">
            <Tabs
              tabs={tabs}
              defaultTab={activeTab}
              onChange={(id) => setActiveTab(id as 'calls' | 'documents' | 'announcements' | 'history')}
              variant="pills"
              className="[&>div]:m-0 [&>div>div]:mb-0 [&>div>div]:flex [&>div>div]:items-center"
            />
            {!isLive && activeEpisode && activeEpisode.conferenceActive && activeEpisode.status === 'scheduled' && (
              <Button variant="success" size="sm" onClick={startBroadcast} className="!py-2.5 !gap-2 !justify-start !text-left">
                START SHOW
              </Button>
            )}
            {isLive && (
              <Button variant="danger" size="sm" onClick={endEpisode} className="!py-2.5 !gap-2 !justify-start !text-left">
                END SHOW
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Layout: Content + Chat Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Main Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'calls' ? (
            /* Call Management */
            <div>
              {activeEpisode ? (
                <ParticipantBoard episodeId={activeEpisode.id} />
              ) : (
                <Card variant="default" padding="lg">
                  <EmptyState
                    title="No Active Episode"
                    description="Start an episode to manage calls"
                  />
                </Card>
              )}
            </div>
          ) : activeTab === 'history' ? (
            /* Call History Tab - Show completed calls with transcription/analysis */
            <div className="space-y-4">
              <h3 className="text-title-sm text-dark dark:text-white mb-4">📞 Call History</h3>
              
              {!activeEpisode ? (
                <Card variant="default" padding="lg">
                  <EmptyState
                    title="No Active Episode"
                    description="Select an episode to view call history"
                  />
                </Card>
              ) : completedCalls.length === 0 ? (
                <Card variant="default" padding="lg">
                  <EmptyState
                    title="No Completed Calls Yet"
                    description="Completed calls will appear here with transcription and AI analysis"
                  />
                </Card>
              ) : (
                <div className="space-y-3">
                  {completedCalls.map((call: any) => {
                    const hasRecording = !!call.recordingSid;
                    const hasTranscript = !!call.transcriptText;
                    const hasAnalysis = !!call.aiSummary;
                    
                    return (
                      <Card key={call.id} variant="default" padding="md">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-dark dark:text-white">
                                {call.caller?.name || 'Unknown Caller'}
                              </h4>
                              {call.caller?.location && (
                                <span className="text-xs text-gray-500">{call.caller.location}</span>
                              )}
                              {/* Status Indicators */}
                              <div className="flex items-center gap-2 ml-2">
                                {hasRecording ? (
                                  <span className="text-xs text-green-400" title="Recording captured">🎙️</span>
                                ) : (
                                  <span className="text-xs text-gray-500" title="No recording">⏸️</span>
                                )}
                                {hasTranscript ? (
                                  <span className="text-xs text-green-400" title="Transcribed">📝</span>
                                ) : hasRecording ? (
                                  <span className="text-xs text-yellow-400" title="Transcription in progress...">⏳</span>
                                ) : null}
                                {hasAnalysis ? (
                                  <span className="text-xs text-blue-400" title="AI analyzed">🤖</span>
                                ) : hasTranscript ? (
                                  <span className="text-xs text-yellow-400" title="Analysis in progress...">⏳</span>
                                ) : null}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                              {call.onAirAt && (
                                <span>
                                  On Air: {new Date(call.onAirAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                              {call.endedAt && (
                                <span>
                                  Ended: {new Date(call.endedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                              {call.airDuration && (
                                <span className="text-green-400">
                                  Duration: {Math.floor(call.airDuration / 60)}m {call.airDuration % 60}s
                                </span>
                              )}
                            </div>
                            
                            {call.topic && (
                              <div className="text-sm text-gray-400 mb-2">Topic: "{call.topic}"</div>
                            )}
                            
                            {/* Transcript Preview */}
                            {hasTranscript && (
                              <div className="bg-gray-800 rounded p-3 mb-2">
                                <div className="text-xs font-semibold text-gray-400 mb-1">📝 Transcript</div>
                                <p className="text-xs text-gray-300 line-clamp-3">
                                  {call.transcriptText.substring(0, 300)}
                                  {call.transcriptText.length > 300 ? '...' : ''}
                                </p>
                              </div>
                            )}
                            
                            {/* AI Analysis */}
                            {hasAnalysis && (
                              <div className="bg-blue-900/30 border border-blue-600 rounded p-3">
                                <div className="text-xs font-semibold text-blue-300 mb-1">🤖 AI Analysis</div>
                                <p className="text-xs text-gray-300 mb-2">{call.aiSummary}</p>
                                <div className="flex items-center gap-4 text-xs text-gray-400">
                                  {call.aiSentiment && (
                                    <span>
                                      Sentiment: <span className="capitalize text-white">{call.aiSentiment}</span>
                                    </span>
                                  )}
                                  {call.contentRating !== null && call.contentRating !== undefined && (
                                    <span>
                                      Rating: <span className="text-white">{call.contentRating}/100</span>
                                    </span>
                                  )}
                                  {call.aiTopics && Array.isArray(call.aiTopics) && call.aiTopics.length > 0 && (
                                    <span>
                                      Topics: <span className="text-white">{call.aiTopics.join(', ')}</span>
                                    </span>
                                  )}
                                </div>
                                {call.aiKeyPoints && Array.isArray(call.aiKeyPoints) && call.aiKeyPoints.length > 0 && (
                                  <div className="mt-2">
                                    <div className="text-xs font-semibold text-gray-400 mb-1">Key Points:</div>
                                    <ul className="text-xs text-gray-300 list-disc list-inside space-y-1">
                                      {call.aiKeyPoints.slice(0, 3).map((point: string, idx: number) => (
                                        <li key={idx}>{point}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Recording Link */}
                            {call.recordingUrl && (
                              <div className="mt-2">
                                <a
                                  href={call.recordingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300"
                                >
                                  🎧 Listen to Recording
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'announcements' ? (
            /* Today's Announcements Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-title-sm text-dark dark:text-white">📢 Today's Announcements</h3>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={autoPlayAnnouncements}
                      onChange={(e) => {
                        setAutoPlayAnnouncements(e.target.checked);
                        localStorage.setItem('autoPlayAnnouncements', e.target.checked.toString());
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-dark dark:text-white">Auto-play at show start</span>
                  </label>
                </div>
              </div>
              
              {todaysAnnouncements.length === 0 ? (
                <Card variant="default" padding="lg">
                  <EmptyState
                    title="No Announcements Yet"
                    description="Your screener can create announcements for today's show"
                  />
                </Card>
              ) : (
                <div className="space-y-3">
                  {todaysAnnouncements.map((announcement) => (
                    <Card key={announcement.id} variant="default" padding="md">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-dark dark:text-white mb-1">
                            {announcement.name}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-body">
                            <span>~{announcement.duration}s</span>
                            <span className="capitalize">{announcement.category}</span>
                            {announcement.tags?.includes('music-upbeat') && <span>⚡ Upbeat</span>}
                            {announcement.tags?.includes('music-professional') && <span>💼 Professional</span>}
                            {announcement.tags?.includes('music-smooth') && <span>✨ Smooth</span>}
                            {announcement.tags?.includes('voice-only') && <span>🎙️ Voice Only</span>}
                          </div>
                        </div>
                      </div>
                      
                      <audio 
                        src={announcement.fileUrl} 
                        controls 
                        className="w-full"
                        style={{ height: '36px' }}
                      />
                      
                      {autoPlayAnnouncements && (
                        <p className="text-xs text-success mt-2">
                          ✅ Will auto-play at show start
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              )}
              
              {autoPlayAnnouncements && todaysAnnouncements.length > 0 && (
                <Card variant="default" padding="md">
                  <p className="text-sm text-dark dark:text-white">
                    💡 These announcements will play automatically after you start the show, before your opener.
                  </p>
                </Card>
              )}
            </div>
          ) : (
            /* Documents Tab - Show AI Analysis */
            <div className="space-y-4">
              <h3 className="text-title-sm text-dark dark:text-white mb-4">Caller Documents & AI Analysis</h3>
              
              {allDocuments.length === 0 ? (
                <Card variant="default" padding="lg">
                  <EmptyState
                    title="No Documents Yet"
                    description="Documents will appear here when screener uploads them"
                  />
                </Card>
              ) : (
                allDocuments.map((doc: any) => {
                  // Handle aiAnalysis - might be object or string
                  let analysis = null;
                  try {
                    analysis = typeof doc.aiAnalysis === 'string' 
                      ? JSON.parse(doc.aiAnalysis) 
                      : doc.aiAnalysis;
                  } catch (e) {
                    console.error('Error parsing analysis:', e);
                  }
                  
                  const caller = approvedCalls.find(c => c.callerId === doc.callerId);
                  
                  return (
                    <div key={doc.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold">{caller?.caller?.name || 'Unknown Caller'}</h4>
                          <p className="text-xs text-gray-500">{doc.fileName}</p>
                        </div>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold"
                        >
                          View File
                        </a>
                      </div>

                      {analysis ? (
                        <div className="bg-gray-900 rounded p-3 text-sm space-y-2">
                          <div>
                            <strong className="text-gray-400">Summary:</strong>
                            <p className="text-gray-300 mt-1">{analysis.summary}</p>
                          </div>
                          
                          {analysis.keyFindings && analysis.keyFindings.length > 0 && (
                            <div>
                              <strong className="text-gray-400">Key Findings:</strong>
                              <ul className="list-disc list-inside text-gray-400 ml-2 mt-1">
                                {analysis.keyFindings.map((finding: string, i: number) => (
                                  <li key={i}>{finding}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {analysis.recommendations && analysis.recommendations.length > 0 && (
                            <div>
                              <strong className="text-gray-400">Recommendations:</strong>
                              <ul className="list-disc list-inside text-gray-400 ml-2 mt-1">
                                {analysis.recommendations.map((rec: string, i: number) => (
                                  <li key={i}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {analysis.confidence && (
                            <p className="text-xs text-gray-500 mt-2">
                              Confidence: {analysis.confidence}%
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Analysis pending...</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Right: Chat Sidebar - 50/50 Split */}
        <div className="flex-1 border-l border-gray-700 flex flex-col overflow-hidden">
          {activeEpisode && <ChatPanel episodeId={activeEpisode.id} userRole="host" />}
        </div>
      </div>
    </div>
  );
}

export {}

