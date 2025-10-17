import { useState, useEffect } from 'react';
import CallQueueMock from '../components/CallQueueMock';
import AudioMixer from '../components/AudioMixer';
import Soundboard from '../components/Soundboard';
import CallerInfo from '../components/CallerInfo';
import ChatPanel from '../components/ChatPanel';
import { useTwilioCall } from '../hooks/useTwilioCall';

export default function HostDashboard() {
  const [activeEpisode, setActiveEpisode] = useState<any>(null);
  const [onAirCall, setOnAirCall] = useState<any>(null); // Currently on-air
  const [isLive, setIsLive] = useState(false);
  const [hostIdentity] = useState(`host-${Date.now()}`);

  // Twilio Device for host
  const {
    isReady: hostReady,
    makeCall: connectToConference
  } = useTwilioCall({
    identity: hostIdentity,
    onCallConnected: () => {
      console.log('✅ Host connected to caller!');
    },
    onCallDisconnected: () => {
      console.log('📴 Host disconnected from caller');
      // Clear on-air call when audio ends
      setOnAirCall(null);
    }
  });

  useEffect(() => {
    // Fetch active episode from database
    fetchActiveEpisode();
    
    // Poll every 10 seconds for updates
    const interval = setInterval(fetchActiveEpisode, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchActiveEpisode = async () => {
    try {
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

  const startEpisode = async () => {
    if (!activeEpisode) return;
    
    try {
      // Try to start the episode in the database
      const response = await fetch(`/api/episodes/${activeEpisode.id}/start`, {
        method: 'PATCH'
      });
      
      if (response.ok) {
        const episode = await response.json();
        setActiveEpisode(episode);
        setIsLive(true);
        console.log('✅ Episode started in database:', episode.title);
      } else {
        // If episode doesn't exist, create show and episode
        console.log('📝 Creating new show and episode in database...');
        
        // First, ensure show exists
        let showId = activeEpisode.showId || 'show-1';
        try {
          const showResponse = await fetch(`/api/shows/${showId}`);
          if (!showResponse.ok) {
            // Create the show first
            const newShowResponse = await fetch('/api/shows', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: 'The AudioRoad Show',
                slug: 'audioroad-show',
                hostId: 'default-host',
                hostName: 'Host',
                description: 'Live broadcast for the trucking community',
                schedule: { days: ['mon', 'wed', 'fri'], time: '15:00', duration: 180 },
                color: '#3b82f6'
              })
            });
            if (newShowResponse.ok) {
              const newShow = await newShowResponse.json();
              showId = newShow.id;
              console.log('✅ Show created:', newShow.name);
            }
          }
        } catch (err) {
          console.log('Show check failed, continuing with default ID');
        }
        
        // Now create episode
        const now = new Date();
        const createResponse = await fetch('/api/episodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            showId,
            title: activeEpisode.title,
            date: now.toISOString(),
            scheduledStart: now.toISOString(),
            scheduledEnd: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
            description: 'Live show created from Host Dashboard'
          })
        });
        
        if (createResponse.ok) {
          const newEpisode = await createResponse.json();
          
          // Now start the episode to make it live
          const startResponse = await fetch(`/api/episodes/${newEpisode.id}/start`, {
            method: 'PATCH'
          });
          
          if (startResponse.ok) {
            const liveEpisode = await startResponse.json();
            setActiveEpisode(liveEpisode);
            setIsLive(true);
            console.log('✅ Episode created and started:', liveEpisode.title);
          } else {
            throw new Error('Failed to start episode');
          }
        } else {
          const error = await createResponse.json().catch(() => ({}));
          console.error('Create episode error:', error);
          throw new Error(error.error || 'Failed to create episode');
        }
      }
    } catch (error) {
      console.error('Error starting episode:', error);
      alert('Failed to start episode. Check console for details.');
    }
  };

  const endEpisode = async () => {
    if (!activeEpisode) return;
    
    try {
      const response = await fetch(`/api/episodes/${activeEpisode.id}/end`, {
        method: 'PATCH'
      });
      const episode = await response.json();
      setActiveEpisode(episode);
      setIsLive(false);
    } catch (error) {
      console.error('Error ending episode:', error);
    }
  };

  const handleEndCall = async () => {
    if (!onAirCall) return;

    if (!confirm('End this call? The caller will be disconnected.')) {
      return;
    }

    try {
      console.log('📴 Ending on-air call:', onAirCall.id);

      // End the call in database - this will trigger Twilio to end it
      const response = await fetch(`/api/calls/${onAirCall.id}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airDuration: Math.floor((Date.now() - new Date(onAirCall.onAirAt || Date.now()).getTime()) / 1000)
        })
      });

      if (response.ok) {
        console.log('✅ Call ended successfully');
        setOnAirCall(null);
        // Queue will auto-refresh via polling
      } else {
        throw new Error('Failed to end call');
      }
    } catch (error) {
      console.error('❌ Error ending call:', error);
      alert('Failed to end call properly. Please try again.');
    }
  };

  return (
    <div className="h-[calc(100vh-73px)] flex">
      {/* Left Panel: Call Queue & Caller Info */}
      <div className="w-1/3 border-r border-gray-700 flex flex-col">
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold">
              {isLive && <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2" />}
              {activeEpisode?.title || 'Host Control Center'}
            </h2>
            {!isLive && activeEpisode && (
              <button
                onClick={startEpisode}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-semibold"
              >
                GO LIVE
              </button>
            )}
            {isLive && (
              <button
                onClick={endEpisode}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold"
              >
                END SHOW
              </button>
            )}
          </div>
          {activeEpisode && (
            <p className="text-sm text-gray-400">
              {activeEpisode.show?.name} • Episode {activeEpisode.episodeNumber}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeEpisode && (
          <CallQueueMock 
            episodeId={activeEpisode.id}
            onSelectCaller={() => {}} // No preview needed
            onTakeCall={async (call) => {
              console.log('📞 Taking call on-air, full data:', call);
              setOnAirCall(call); // Put caller on-air
              
              // Connect host's audio to the conference
              if (hostReady && activeEpisode) {
                console.log('🎙️ Connecting host to conference...');
                try {
                  await connectToConference({
                    callId: call.id,
                    episodeId: activeEpisode.id,
                    role: 'host'
                  });
                  console.log('✅ Host audio connection initiated');
                } catch (error) {
                  console.error('❌ Error connecting host audio:', error);
                  alert('Failed to connect audio. You can still see caller info.');
                }
              } else if (!hostReady) {
                alert('⚠️ Audio system not ready. Caller info shown but no audio.');
              }
            }}
          />
          )}
        </div>
      </div>

      {/* Center Panel: Caller Info (when on-air) OR Audio Controls */}
      <div className="flex-1 flex flex-col bg-gray-850">
        {onAirCall ? (
          /* CALLER ON-AIR - Show caller info and analysis */
          <div className="flex-1 overflow-y-auto">
            <div className="bg-red-900/30 border-2 border-red-500 p-6 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-block w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                  <h2 className="text-2xl font-bold">ON AIR: {onAirCall.caller.name}</h2>
                </div>
                <button
                  onClick={handleEndCall}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded font-bold transition-colors"
                >
                  End Call
                </button>
              </div>
            </div>

            <div className="px-6 pb-6">
              <CallerInfo 
                caller={{
                  ...onAirCall.caller,
                  topic: onAirCall.topic,
                  screenerNotes: onAirCall.screenerNotes
                }}
                hasDocuments={onAirCall.hasDocuments}
                documentAnalysis={onAirCall.documentAnalysis || null}
              />
            </div>
          </div>
        ) : (
          /* NO CALL ON-AIR - Show audio controls */
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Audio Mixer</h3>
              {activeEpisode && <AudioMixer episodeId={activeEpisode.id} />}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Soundboard</h3>
              {activeEpisode && <Soundboard showId={activeEpisode.showId} />}
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Audio Controls (when on-air) OR Chat */}
      <div className="w-1/3 border-l border-gray-700 flex flex-col">
        {onAirCall ? (
          /* CALLER ON-AIR - Show audio controls */
          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Audio Controls</h3>
            {activeEpisode && <AudioMixer episodeId={activeEpisode.id} />}
            
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Soundboard</h3>
              {activeEpisode && <Soundboard showId={activeEpisode.showId} />}
            </div>
          </div>
        ) : (
          /* NO CALL - Show chat */
          <div className="flex-1 overflow-y-auto">
            {activeEpisode && (
              <ChatPanel episodeId={activeEpisode.id} userRole="host" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

