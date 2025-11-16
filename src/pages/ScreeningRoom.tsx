import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useBroadcast } from '../contexts/BroadcastContext';
import ChatPanel from '../components/ChatPanel';
import DocumentUploadWidget from '../components/DocumentUploadWidget';
import ParticipantBoard from '../components/ParticipantBoard';
import { useEpisodeCallState } from '../hooks/useEpisodeCallState';

export default function ScreeningRoom() {
  const broadcast = useBroadcast(); // Use global broadcast context
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<any>(null);
  const [incomingCalls, setIncomingCalls] = useState<any[]>([]);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [screenerNotes, setScreenerNotes] = useState({
    name: '',
    location: '',
    topic: '',
    truckerType: 'OTR',
    priority: 'normal',
    notes: ''
  });
  
  // State for opening phone lines
  const [selectedShow, setSelectedShow] = useState<any | null>(null);
  const [isOpeningLines, setIsOpeningLines] = useState(false);
  const [openLinesError, setOpenLinesError] = useState('');

  // Don't auto-initialize - let "Open Phone Lines" handle device setup based on mode
  const screenerReady = true; // Always ready - connection happens when clicking "Open Phone Lines"
  const screenerConnected = activeCall !== null;
  const { buckets: callBuckets, refresh: refreshCallBuckets } = useEpisodeCallState(
    activeEpisode ? activeEpisode.id : null,
  );

  useEffect(() => {
    console.log('🚀 ScreeningRoom mounted - initializing...');
    
    // ALWAYS fetch from database first (don't rely on context for remote screeners)
    // Context might be empty on remote screener's computer
    const fetchActiveEpisode = async () => {
      try {
        // Try live episodes first
        const liveRes = await fetch('/api/episodes?status=live');
        const liveEpisodes = await liveRes.json();
        
        if (liveEpisodes.length > 0) {
          setActiveEpisode(liveEpisodes[0]);
          console.log('✅ [SCREENER] Active episode loaded (live):', liveEpisodes[0].title);
          return;
        }
        
        // If no live, try lines open
        const scheduledRes = await fetch('/api/episodes?status=scheduled&conferenceActive=true');
        const scheduledEpisodes = await scheduledRes.json();
        
        if (scheduledEpisodes.length > 0) {
          setActiveEpisode(scheduledEpisodes[0]);
          console.log('✅ [SCREENER] Episode with lines open loaded:', scheduledEpisodes[0].title);
          return;
        }
        
        console.log('⚠️ [SCREENER] No active episodes found');
      } catch (err) {
        console.error('❌ [SCREENER] Error fetching episode:', err);
      }
    };
    
    fetchActiveEpisode();

    // Setup socket connection with auto-reconnect
    console.log('🔌 Creating Socket.IO connection...');
    const newSocket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });
    setSocket(newSocket);
    
    let lastEpisodeId: string | null = null;
    
    newSocket.on('connect', () => {
      console.log('✅ [SCREENER] Socket connected, ID:', newSocket.id);
      // Rejoin episode room if we have one (for reconnections)
      const currentEpisodeId = activeEpisode?.id || null;
      if (currentEpisodeId && currentEpisodeId !== lastEpisodeId) {
        console.log('🔄 [SCREENER] Joining episode room:', currentEpisodeId);
        newSocket.emit('join:episode', currentEpisodeId);
        lastEpisodeId = currentEpisodeId;
      }
    });
    
    newSocket.on('disconnect', (reason) => {
      console.log('📴 [SCREENER] Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected us - manually reconnect
        console.log('🔄 [SCREENER] Server disconnected, reconnecting...');
        newSocket.connect();
      }
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`✅ [SCREENER] Reconnected after ${attemptNumber} attempts`);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('❌ [SCREENER] Reconnection error:', error);
    });

    return () => {
      console.log('🧹 ScreeningRoom unmounting, closing socket');
      newSocket.close();
    };
  }, []);

  // RECOVERY: Check if we lost episode state but context still has it
  useEffect(() => {
    const contextEpisodeId = broadcast.state.episodeId;
    
    // If we lost our episode but context says there's one, recover it
    if (!activeEpisode && contextEpisodeId) {
      console.warn('🔄 [SCREENER] RECOVERY: Lost episode, restoring from context...');
      fetch(`/api/episodes/${contextEpisodeId}`)
        .then(res => res.json())
        .then(episode => {
          console.log('✅ [SCREENER] RECOVERED episode:', episode.title);
          setActiveEpisode(episode);
        })
        .catch(err => {
          console.error('❌ [SCREENER] RECOVERY FAILED:', err);
        });
    }
  }, [broadcast.state.episodeId, activeEpisode]);

  useEffect(() => {
    if (!socket || !activeEpisode) return;

    console.log('🔌 [SCREENER] Joining episode room:', activeEpisode.id);
    socket.emit('join:episode', activeEpisode.id);

    // Wait for join confirmation
    socket.on('joined:episode', (data) => {
      console.log('✅ [SCREENER] Successfully joined episode room:', data.episodeId);
      // Now fetch existing calls
      fetchQueuedCalls();
    });

    socket.on('call:incoming', (data) => {
      console.log('📞 [SCREENER] Incoming call event received:', data);
      // Refresh immediately
      fetchQueuedCalls();
      // And again after 1 second to catch any database lag
      setTimeout(fetchQueuedCalls, 1000);
    });

    socket.on('call:approved', (data) => {
      console.log('✅ Call approved:', data);
      // Remove from queue if it was picked up by this screener
      if (activeCall && activeCall.id === data.id) {
        setActiveCall(null);
      }
      fetchQueuedCalls();
    });

    socket.on('call:rejected', (data) => {
      console.log('❌ Call rejected:', data);
      // Remove from queue
      if (activeCall && activeCall.id === data.id) {
        setActiveCall(null);
      }
      fetchQueuedCalls();
    });

    socket.on('call:completed', async (data) => {
      console.log('📴 Call completed:', data);
      
      // If this is the call being screened, close the form
      if (activeCall && data.callId === activeCall.id) {
        console.log('🔴 Active call completed - closing form');
        setActiveCall(null);
        setScreenerNotes({
          name: '',
          location: '',
          topic: '',
          truckerType: 'OTR',
          priority: 'normal',
          notes: ''
        });
        if (screenerConnected) {
          await broadcast.disconnectCurrentCall();
        }
      }
      
      fetchQueuedCalls(); // Refresh the list
    });

    socket.on('call:hungup', async (data) => {
      console.log('📴 Caller hung up event:', data);
      console.log('   Current active call:', activeCall?.id);
      console.log('   Hung up call ID:', data.callId);
      
      // Close form if this is active call (check both callId formats)
      const isActiveCall = activeCall && (
        data.callId === activeCall.id || 
        data.id === activeCall.id ||
        data.callId === activeCall.twilioCallSid
      );
      
      if (isActiveCall) {
        console.log('🔴 Active call hung up - closing form and disconnecting');
        
        // Disconnect screener audio immediately
        if (screenerConnected) {
          try {
            await broadcast.disconnectCurrentCall();
            console.log('✓ Screener disconnected');
          } catch (error) {
            console.error('Error disconnecting screener:', error);
          }
        }
        
        // Clear the form
        setActiveCall(null);
        setScreenerNotes({
          name: '',
          location: '',
          topic: '',
          truckerType: 'OTR',
          priority: 'normal',
          notes: ''
        });
      }
      
      // Always refresh the call list to remove hung up calls
      fetchQueuedCalls();
    });

    socket.on('participant:state-changed', (data) => {
      console.log('🔄 [SCREENER] Participant state changed:', data);
      // Refresh call list when host sends call back to screening
      fetchQueuedCalls();
    });

    socket.on('call:screening', async (data) => {
      console.log('🔍 [SCREENER] Call sent back to screening from host:', data);
      
      // CRITICAL: If this is our active call being sent back, clear it
      if (activeCall && (data.id === activeCall.id || data.callId === activeCall.id)) {
        console.log('🔴 Active call sent back to screening - clearing active state');
        
        // CRITICAL: Disconnect screener audio FIRST before clearing state
        if (screenerConnected) {
          try {
            await broadcast.disconnectCurrentCall();
            console.log('✅ Screener disconnected from call');
          } catch (e) {
            console.error('⚠️ Error disconnecting screener:', e);
          }
        }
        
        // Now clear state
        setActiveCall(null);
      }
      
      // Immediately refresh to show the call
      fetchQueuedCalls();
    });
    
    socket.on('episode:lines-opened', (episode) => {
      console.log('📞 [SCREENER] Lines opened event:', episode);
      setActiveEpisode(episode);
    });
    
    socket.on('episode:lines-closed', (episode) => {
      console.log('📴 [SCREENER] Lines closed event:', episode);
      if (activeEpisode && episode.id === activeEpisode.id) {
        setActiveEpisode(null);
        setIncomingCalls([]);
        setActiveCall(null);
      }
    });
    
    socket.on('episode:start', (episode) => {
      console.log('🎙️ [SCREENER] Episode started event:', episode);
      setActiveEpisode(episode);
    });
    
    socket.on('episode:end', (episode) => {
      console.log('📴 [SCREENER] Episode ended event:', episode);
      // DEFENSIVE: Only clear if this is actually OUR episode
      if (activeEpisode && episode.id === activeEpisode.id) {
        console.log('   Clearing active episode (confirmed match)');
        setActiveEpisode(null);
        setIncomingCalls([]);
        setActiveCall(null);
      } else {
        console.warn('   ⚠️ Received episode:end for different episode, ignoring');
      }
    });

    // Auto-refresh every 2 seconds to catch missed events (more frequent!)
    const refreshInterval = setInterval(() => {
      fetchQueuedCalls();
    }, 2000);

    return () => {
      socket.off('call:incoming');
      socket.off('call:approved');
      socket.off('call:rejected');
      socket.off('call:completed');
      socket.off('call:hungup');
      socket.off('participant:state-changed');
      socket.off('call:screening');
      socket.off('episode:lines-opened');
      socket.off('episode:lines-closed');
      socket.off('episode:start');
      socket.off('episode:end');
      clearInterval(refreshInterval);
    };
  }, [socket, activeEpisode]);

  const fetchQueuedCalls = async () => {
    // Kept for WebSocket event handlers, but ParticipantBoard shows the calls
    if (!activeEpisode) return;
    try {
      const response = await fetch(`/api/calls?episodeId=${activeEpisode.id}`);
      const data = await response.json();
      
      // CRITICAL: Only show recent calls (last 30 minutes) to avoid showing old test calls
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
      
      const activeCalls = data.filter((call: any) => {
        const callTime = new Date(call.incomingAt).getTime();
        const isRecent = callTime > thirtyMinutesAgo;
        
        const isActive = (call.status === 'queued' || call.status === 'screening') && 
          !call.endedAt && 
          call.status !== 'completed' && 
          call.status !== 'rejected';
        
        if (!isRecent) {
          console.log(`⏰ [FILTER] Skipping old call ${call.id} from ${new Date(call.incomingAt).toLocaleTimeString()}`);
        }
        
        return isActive && isRecent;
      });
      
      console.log(`📞 [FETCH] Found ${activeCalls.length} active recent calls (filtered ${data.length - activeCalls.length} old calls)`);
      setIncomingCalls(activeCalls);
    } catch (error) {
      console.error('Error fetching queued calls:', error);
    }
  };

  // Fetch shows on mount and auto-select first one
  useEffect(() => {
    const fetchShows = async () => {
      try {
        const response = await fetch('/api/shows');
        const shows = await response.json();
        // Auto-select first show if available
        if (shows.length > 0) {
          setSelectedShow(shows[0]);
          console.log('✅ Auto-selected show:', shows[0].name);
        }
      } catch (error) {
        console.error('Error fetching shows:', error);
      }
    };
    fetchShows();
  }, []);

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

    // Find today's episode that's NOT completed
    const todaysEpisode = episodes.find((ep: any) => {
      const epDate = new Date(ep.date).toISOString().split('T')[0];
      return epDate === today && ep.status !== 'completed';
    });

    if (todaysEpisode) {
      console.log('✅ Found existing episode:', todaysEpisode.title, 'Status:', todaysEpisode.status);
      return todaysEpisode;
    }
    
    console.log('📝 No active episode for today - creating new one...');

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
        date: now.toISOString(),  // Add date field
        scheduledStart: now.toISOString(),
        scheduledEnd: endTime.toISOString(),
        status: 'scheduled'
      })
    });

    if (!createRes.ok) {
      const errorData = await createRes.json();
      throw new Error(errorData.error || 'Failed to create episode');
    }

    const newEpisode = await createRes.json();
    console.log('✅ Created episode:', newEpisode.title);
    return newEpisode;
  };

  const handleOpenLines = async () => {
    setIsOpeningLines(true);
    setOpenLinesError('');

    try {
      console.log('📞 [OPEN-LINES] Opening phone lines...');

      // Always create a fresh episode (don't reuse old ones)
      const episode = await getOrCreateTodaysEpisode();
      console.log('✅ Episode ready:', episode.id, 'Status:', episode.status);

      // Open phone lines (creates conference, does NOT start recording/streaming)
      const openLinesRes = await fetch(`/api/episodes/${episode.id}/open-lines`, { method: 'PATCH' });
      
      if (!openLinesRes.ok) {
        const error = await openLinesRes.json();
        throw new Error(error.error || 'Failed to open lines');
      }
      
      const updatedEpisode = await openLinesRes.json();
      console.log('✅ Phone lines opened');

      // Initialize connection system (WebRTC or Twilio) based on mode
      const useWebRTC = broadcast.useWebRTC;
      console.log(`🔌 [OPEN-LINES] Connection mode: ${useWebRTC ? 'WebRTC (LiveKit)' : 'Twilio Device'}`);
      
      if (useWebRTC) {
        // Initialize WebRTC/LiveKit
        console.log('🔌 [OPEN-LINES] Initializing LiveKit WebRTC...');
        try {
          await broadcast.initializeWebRTC();
          console.log('✅ [OPEN-LINES] LiveKit ready - screener can take calls via WebRTC');
        } catch (webrtcError) {
          console.error('⚠️ [OPEN-LINES] LiveKit init failed:', webrtcError);
          // Continue anyway - they can try Twilio or try again later
        }
      } else {
        // Initialize Twilio device (original flow)
        console.log('📞 [OPEN-LINES] Initializing Twilio device...');
        try {
          if (!broadcast.twilioDevice) {
            await broadcast.initializeTwilio(`session-${Date.now()}`);
            console.log('✅ [OPEN-LINES] Twilio device ready - host can now manage calls');
          } else {
            console.log('✅ [OPEN-LINES] Twilio device already initialized');
          }
        } catch (twilioError) {
          console.error('⚠️ [OPEN-LINES] Twilio init failed:', twilioError);
          // Continue anyway - they can try again later
        }
      }

      // Update local state
      setActiveEpisode(updatedEpisode);

      // Update context so other pages can see it
      broadcast.setState({
        isLive: false,
        linesOpen: true,
        episodeId: episode.id,
        showId: episode.showId,
        showName: episode.title || 'Pre-Show',
        startTime: null,
        selectedShow: selectedShow
      });

      console.log(`🎉 PHONE LINES OPEN! Screener ready to take calls via ${useWebRTC ? 'WebRTC' : 'Twilio'}.`);
    } catch (error: any) {
      console.error('❌ Failed to open phone lines:', error);
      setOpenLinesError(error.message || 'Failed to open phone lines');
    } finally {
      setIsOpeningLines(false);
    }
  };

  const handlePickUpCall = async (call: any) => {
    console.log('📞 Picking up call:', call.id);
    console.log('🔍 [PICKUP] Call details:');
    console.log(`   ID: ${call.id}`);
    console.log(`   Episode ID: ${call.episodeId}`);
    console.log(`   Twilio Call SID: ${call.twilioCallSid}`);
    console.log(`   Status: ${call.status}`);
    console.log(`   Incoming at: ${new Date(call.incomingAt).toLocaleTimeString()}`);
    console.log(`   Expected screening room: screening-${call.episodeId}-${call.id}`);
    
    // Check if using WebRTC mode
    // IMPORTANT: SIP calls (from LiveKit) MUST use WebRTC mode
    const isSIPCall = call.twilioCallSid && call.twilioCallSid.startsWith('PA_'); // LiveKit SIP participant IDs start with PA_
    const useWebRTC = broadcast.useWebRTC || isSIPCall;
    console.log(`🔌 [SCREENING] Connection mode: ${useWebRTC ? 'WebRTC (LiveKit)' : 'Twilio Device'}`);
    if (isSIPCall) {
      console.log(`   📞 Detected SIP call - forcing WebRTC mode`);
    }
    
    // CRITICAL: ALWAYS disconnect any existing calls
    if (useWebRTC) {
      // Disconnect WebRTC if active
      if (broadcast.webrtcService && broadcast.webrtcService.isInRoom()) {
        console.warn('⚠️ [WEBRTC] Already in a room - leaving first');
        await broadcast.leaveRoomWebRTC();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } else {
      // Disconnect Twilio Device if active
      const deviceHasActiveCalls = broadcast.twilioDevice?.calls && broadcast.twilioDevice.calls.length > 0;
      if (broadcast.activeCalls.size > 0 || deviceHasActiveCalls) {
        console.warn('⚠️ Active call detected - disconnecting before pickup');
        try {
          await broadcast.disconnectCurrentCall();
          setActiveCall(null);
          await new Promise(resolve => setTimeout(resolve, 1500));
          console.log('✅ Previous call disconnected, device free');
        } catch (e) {
          console.error('❌ Failed to disconnect:', e);
        }
      }
    }
    
    // Update call status to 'screening' via API 
    // For SIP calls, skip the stream move (caller is already in LiveKit)
    if (!isSIPCall) {
      try {
        await fetch(`/api/screening/${call.id}/pickup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screenerId: 'screener-current' })
        });
        console.log('✅ Call moved to screening room');
      } catch (error) {
        console.error('⚠️ Error updating call status:', error);
        // Continue anyway
      }
      } else {
        console.log('📞 SIP call - skipping backend stream move (caller already in LiveKit lobby)');
        // Just update the call status to 'screening' in database
        try {
          await fetch(`/api/calls/${call.id}/screen`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ screenerUserId: 'screener-current' })
          });
          console.log('✅ Call status updated to screening');
        } catch (error) {
          console.error('⚠️ Error updating call status:', error);
        }
      }
    
    // Set active call first
    setActiveCall(call);
    
    // CLEAR form for fresh entry each call
    setScreenerNotes({
      name: '',
      location: '',
      topic: '',
      truckerType: 'OTR',
      priority: 'normal',
      notes: ''
    });
    
    // Refresh queues
    fetchQueuedCalls();
    
    // Connect based on mode
    if (useWebRTC) {
      // WebRTC/SIP mode: Join the LiveKit lobby room where the SIP caller is
      console.log('📞 [SCREENING] Connecting via LiveKit WebRTC to lobby room...');
      
      try {
        // Initialize WebRTC if needed
        if (!broadcast.webrtcService || !broadcast.webrtcService.isConnected()) {
          await broadcast.initializeWebRTC();
          console.log('✅ [SCREENING] LiveKit initialized');
        }
        
        // CRITICAL: Get local audio stream (microphone) first
        console.log('🎤 [SCREENING] Getting microphone audio...');
        await broadcast.webrtcService!.setLocalAudioStream();
        console.log('✅ [SCREENING] Microphone ready');
        
        // Join the exact lobby room where the SIP caller is waiting
        // Use new joinRoomByName method to join non-episode-specific rooms
        const roomName = 'lobby';
        await broadcast.webrtcService!.joinRoomByName(roomName, `screener-${Date.now()}`, 'Screener');
        console.log('✅ [SCREENING] Joined lobby room - should now hear SIP caller!');
        
      } catch (error) {
        console.error('❌ [SCREENING] Failed to join LiveKit room:', error);
        alert('Failed to join call room. Check browser console.');
        setActiveCall(null);
        return;
      }
    } else {
      // Twilio Device mode (legacy)
      console.log('📞 [SCREENING] Connecting to call via Twilio Device...');
      
      // Ensure Twilio Device is initialized
      if (!broadcast.twilioDevice) {
        try {
          await broadcast.initializeTwilio(`screener-${Date.now()}`);
          console.log('✅ [SCREENING] Twilio Device initialized');
        } catch (initError) {
          console.error('❌ [SCREENING] Failed to initialize Twilio Device:', initError);
          alert('Failed to initialize phone system. Please refresh and try again.');
          setActiveCall(null);
          return;
        }
      }
      
      try {
        // Connect to conference where the caller is (screening conference)
        const callerName = call.caller?.name || 'Caller';
        console.log(`📞 [SCREENING] Connecting to screening conference for call ${call.id}...`);
        
        await broadcast.connectToCall(call.id, callerName, activeEpisode.id, 'screener');
        console.log('✅ [SCREENING] Connected to phone via Twilio Device!');
      
      // Wait for Twilio to fully establish connection
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Unmute the caller so they can hear you
      console.log('📞 [SCREENING] Unmuting caller for bidirectional audio...');
      try {
        const unmuteRes = await fetch(`/api/participants/${call.id}/unmute`, { method: 'PATCH' });
        if (unmuteRes.ok) {
          console.log('✅ [SCREENING] Caller unmuted - bidirectional audio active!');
        } else {
          const errorText = await unmuteRes.text();
          console.warn('⚠️ [SCREENING] Unmute failed:', errorText);
        }
      } catch (unmuteError) {
        console.warn('⚠️ [SCREENING] Unmute error:', unmuteError);
      }
      
        // Verify connection
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('🎉 [SCREENING] Connection complete!');
        console.log('   You should hear the caller now');
        console.log('   Caller should hear you');
        
      } catch (error) {
        console.error('❌ [SCREENING] Failed to connect:', error);
        alert(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setActiveCall(null);
        return;
      }
    } // End of else (Twilio Device mode)
    
    // Legacy Twilio-only flow (kept for reference, but hybrid approach above is used)
    if (false) {
      // === Twilio Device Flow (Original) ===
      
      if (!screenerReady) {
        console.error('⚠️ Phone system not ready');
        setActiveCall(null);
        return;
      }

      console.log('🎙️ Connecting screener to caller...');
      try {
        const callerName = call.caller?.name || 'Caller';
        
        // Connect screener to conference
        await broadcast.connectToCall(call.id, callerName, activeEpisode.id, 'screener');
        console.log('✅ Screener audio connection initiated');
        
        // Wait a moment for screener to fully connect to conference
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // CRITICAL: Unmute caller so screener can talk to them (keep in screening state)
        console.log('📞 Unmuting caller for screening...');
        try {
          // Use unmute endpoint to just unmute (keeps participant in screening state)
          const onAirRes = await fetch(`/api/participants/${call.id}/unmute`, { method: 'PATCH' });
          if (onAirRes.ok) {
            console.log('✅ Caller unmuted for screening');
          } else {
            const errorText = await onAirRes.text();
            console.error('⚠️ on-air endpoint failed:', onAirRes.status, errorText);
          }
          
          // Extra safety: Wait then verify they're actually unmuted
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('✅ Screening connection complete');
        } catch (holdError) {
          console.error('⚠️ Failed to unmute caller:', holdError);
        }
      } catch (error) {
        console.error('❌ Error connecting to caller:', error);
        setActiveCall(null);
      }
    }
  };

  const handleApproveAndQueue = async () => {
    if (!activeCall) return;
    
    if (!screenerNotes.name || !screenerNotes.topic) {
      console.warn('⚠️ Name and Topic required before approving');
      return; // Silently prevent - button should be disabled anyway
    }

    setApproving(true);
    try {
      const callToApprove = activeCall;
      
      // NOTE: In conference mode, DON'T disconnect the call!
      // The caller stays in the conference (muted in HOLD state)
      // Only disconnect screener's local audio connection
      if (screenerConnected) {
        console.log('📴 Screener ending local connection (caller stays in conference)');
        
        // Disconnect based on connection mode
        if (broadcast.useWebRTC && broadcast.webrtcService) {
          // WebRTC: Leave the LiveKit lobby room
          console.log('📴 [WEBRTC] Screener leaving LiveKit lobby room');
          await broadcast.leaveRoomWebRTC();
        } else if (broadcast.twilioDevice) {
          // Twilio Device: Disconnect
          broadcast.twilioDevice.disconnectAll();
        }
      }
      
      // Clear active call FIRST to trigger document widget unmount
      setActiveCall(null);

      // Update caller info
      const callerResponse = await fetch(`/api/callers/${callToApprove.callerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: screenerNotes.name,
          location: screenerNotes.location,
          truckerType: screenerNotes.truckerType
        })
      });

      if (!callerResponse.ok) {
        throw new Error('Failed to update caller info');
      }

      // Update call with screening info and approve
      const callResponse = await fetch(`/api/calls/${callToApprove.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: screenerNotes.topic,
          screenerNotes: screenerNotes.notes,
          priority: screenerNotes.priority
        })
      });

      if (!callResponse.ok) {
        throw new Error('Failed to approve call');
      }

      console.log('✅ Call approved and added to host queue');
      
      // Clear form data
      const resetNotes = {
        name: '',
        location: '',
        topic: '',
        truckerType: 'OTR',
        priority: 'normal',
        notes: ''
      };
      setScreenerNotes(resetNotes);
      
      // Force immediate refresh
      fetchQueuedCalls();
      
      console.log('✅ Call approved and queued for host');
    } catch (error) {
      console.error('❌ Error approving call:', error);
    } finally {
      setApproving(false);
    }
  };

  const handleRejectCall = async () => {
    if (!activeCall) return;

    // No confirmation popup - just reject immediately
    console.log('🚫 Rejecting call:', activeCall.id);

    setRejecting(true);
    try{
      // End screener's audio connection first
      if (screenerConnected) {
        await broadcast.disconnectCurrentCall();
      }

      const callToReject = activeCall;
      
      // Clear active call FIRST to unmount document widget
      setActiveCall(null);

      // Reject the call in database and end caller's Twilio call
      const response = await fetch(`/api/calls/${callToReject.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Rejected by screener'
        })
      });

      if (response.ok) {
        console.log('✅ Call rejected successfully');
      }

      // Clear form
      setScreenerNotes({
        name: '',
        location: '',
        topic: '',
        truckerType: 'OTR',
        priority: 'normal',
        notes: ''
      });
      fetchQueuedCalls();
    } catch (error) {
      console.error('Error rejecting call:', error);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Single Header Bar */}
      <div className="px-6 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            {activeEpisode && <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
            <h2 className="text-lg font-bold">Call Screening Room</h2>
            {activeEpisode && <span className="text-sm text-gray-500">{activeEpisode.title}</span>}
          </div>
          
          {/* WebRTC Mode Toggle */}
          {!activeCall && activeEpisode && (
            <>
              <div className="h-6 w-px bg-gray-600"></div>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={broadcast.useWebRTC}
                  onChange={(e) => broadcast.setUseWebRTC(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Use WebRTC</span>
                {broadcast.webrtcConnected && (
                  <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded">Connected</span>
                )}
              </label>
            </>
          )}
          
          {!activeCall && activeEpisode && (
            <>
              <div className="h-6 w-px bg-gray-600"></div>
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-gray-300">Queued for Host</h3>
                <span className="text-xl font-bold text-green-400">{incomingCalls.filter(c => c.status !== 'rejected').length}</span>
              </div>
            </>
          )}
        </div>
        
        {/* Announcements Link */}
        <Link
          to="/announcements"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          📢 Announcements
        </Link>
      </div>

      {/* Main Layout: Content + Chat - 50/50 Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Screening Content - 50% */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">

            {/* Active Screening Session - Compact */}
            {activeCall && activeEpisode && (
              <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {screenerConnected ? (
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    ) : (
                      <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                    )}
                    <span className="text-sm text-gray-400">
                      {screenerConnected ? 'Connected' : 'Connecting...'}
                    </span>
                  </div>
        </div>

                {/* Compact Screening Form - Single Line */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <input
                    type="text"
                    value={screenerNotes.name}
                    onChange={(e) => setScreenerNotes({ ...screenerNotes, name: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-green-500 text-sm"
                    placeholder="Name *"
                  />
                  <input
                    type="text"
                    value={screenerNotes.location}
                    onChange={(e) => setScreenerNotes({ ...screenerNotes, location: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-green-500 text-sm"
                    placeholder="Location"
                  />
                  <input
                    type="text"
                    value={screenerNotes.topic}
                    onChange={(e) => setScreenerNotes({ ...screenerNotes, topic: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-green-500 text-sm"
                    placeholder="Topic *"
                  />
                </div>

                {/* Document Upload - Compact */}
                {activeCall.callerId && (
                  <div className="mb-3">
                    <DocumentUploadWidget
                      key={activeCall.id}
                      callerId={activeCall.callerId}
                      callId={activeCall.id}
                      maxFiles={3}
                    />
                  </div>
                )}

                {/* Compact Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleApproveAndQueue}
                    disabled={!screenerNotes.name || !screenerNotes.topic || approving || rejecting}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-semibold transition-colors"
                  >
                    {approving ? '⏳ Approving...' : '✓ Approve'}
                  </button>
                  <button
                    onClick={handleRejectCall}
                    disabled={approving || rejecting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-semibold transition-colors"
                  >
                    {rejecting ? '⏳ Rejecting...' : '✗ Reject'}
                  </button>
                </div>
              </div>
            )}

            {/* Queued Calls Waiting to be Screened */}
            {!activeCall && activeEpisode && incomingCalls.length > 0 && (
              <div className="space-y-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-300">📞 Incoming Calls ({incomingCalls.length})</h3>
                {incomingCalls.map((call) => {
                  const waitTime = Math.floor((Date.now() - new Date(call.incomingAt).getTime()) / 1000 / 60);
                  const waitSeconds = Math.floor((Date.now() - new Date(call.incomingAt).getTime()) / 1000) % 60;
                  const borderColor = waitTime >= 5 ? 'border-red-500' :
                                     waitTime >= 2 ? 'border-yellow-500' :
                                     'border-gray-700';
                  
                  return (
                    <div
                      key={call.id}
                      className={`bg-gray-800 border-2 ${borderColor} rounded-lg p-6 transition-colors`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-xl font-bold">{call.caller?.name || 'Unknown Caller'}</h4>
                          <p className="text-sm text-gray-400">{call.caller?.location || 'Location not provided'}</p>
                          {call.caller?.phoneNumber && (
                            <p className="text-sm text-gray-500">{call.caller.phoneNumber}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-yellow-400">
                            {waitTime}:{waitSeconds.toString().padStart(2, '0')}
                          </div>
                          <p className="text-xs text-gray-500">Waiting</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handlePickUpCall(call)}
                        disabled={!!activeCall || !screenerReady}
                        className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
                      >
                        {!screenerReady ? '⏳ Phone System Loading...' : '📞 Pick Up & Screen This Call'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* All Other Calls - Show complete status using ParticipantBoard */}
            {activeEpisode && !activeCall && (
              <div>
                <h3 className="text-lg font-semibold text-gray-300 mb-4">📊 All Call States</h3>
                <ParticipantBoard
                  episodeId={activeEpisode.id}
                  callBuckets={callBuckets}
                  refreshCalls={refreshCallBuckets}
                />
              </div>
            )}

            {!activeEpisode && (
          <div className="text-center py-16 bg-gray-800 rounded-lg">
            <p className="text-gray-400 text-lg mb-4">No active episode</p>
            <p className="text-gray-500 text-sm mb-6">Open phone lines to start taking calls</p>
            
            {openLinesError && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm max-w-md mx-auto">
                {openLinesError}
              </div>
            )}
            
            {/* WebRTC Mode Toggle - BEFORE Opening Lines */}
            <div className="mb-6 flex justify-center">
              <label className="flex items-center gap-2 cursor-pointer text-sm bg-gray-700 px-4 py-2 rounded-lg">
                <input
                  type="checkbox"
                  checked={broadcast.useWebRTC}
                  onChange={(e) => broadcast.setUseWebRTC(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Use WebRTC</span>
                {broadcast.webrtcConnected && (
                  <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded ml-2">Connected</span>
                )}
              </label>
            </div>
            
            <button
              onClick={handleOpenLines}
              disabled={isOpeningLines || !selectedShow}
              className="px-8 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
            >
              {isOpeningLines ? '⏳ Opening Lines...' : `📞 OPEN PHONE LINES ${broadcast.useWebRTC ? '(WebRTC)' : '(Twilio)'}`}
            </button>
            
            {!selectedShow && (
              <p className="text-yellow-500 text-sm mt-3">Loading shows...</p>
            )}
          </div>
        )}

          </div>
        </div>

        {/* Right: Chat Sidebar - 50% */}
        <div className="flex-1 border-l border-gray-700 flex flex-col overflow-hidden">
          {activeEpisode && <ChatPanel episodeId={activeEpisode.id} userRole="screener" />}
        </div>
      </div>
    </div>
  );
}

