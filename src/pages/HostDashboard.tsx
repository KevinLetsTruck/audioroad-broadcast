import { useState, useEffect } from 'react';
import CallQueueMock from '../components/CallQueueMock';
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
    <div className="h-[calc(100vh-73px)] flex flex-col">
      {/* Compact Header */}
      <div className="px-6 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isLive && <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
          <h2 className="text-lg font-bold">{activeEpisode?.title || 'Host Control Center'}</h2>
          {activeEpisode && <span className="text-sm text-gray-500">Episode {activeEpisode.episodeNumber}</span>}
        </div>
        <div className="flex items-center gap-3">
          {!isLive && activeEpisode && (
            <button
              onClick={startEpisode}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold"
            >
              GO LIVE
            </button>
          )}
          {isLive && (
            <button
              onClick={endEpisode}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-semibold"
            >
              END SHOW
            </button>
          )}
        </div>
      </div>

      {/* Main Content: All Call Cards in Single Column */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          
          {/* Host Mic Card - Always Visible */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
                    <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold">Host Mic</h3>
                  <p className="text-sm text-gray-400">Volume: 80%</p>
                </div>
              </div>
              <div className="text-3xl font-bold">80</div>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              defaultValue="80"
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          {/* ON AIR Caller Card - If Call Active */}
          {onAirCall && (
            <div className="bg-red-900/30 border-2 border-red-500 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="inline-block w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                  <div>
                    <h3 className="text-xl font-bold">ON AIR: {onAirCall.caller?.name || 'Web Caller'}</h3>
                    <p className="text-sm text-gray-400">{onAirCall.caller?.location || 'Location not provided'}</p>
                  </div>
                </div>
                <button
                  onClick={handleEndCall}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-bold transition-colors"
                >
                  End Call
                </button>
              </div>
              
              {onAirCall.topic && (
                <div className="bg-gray-900/50 rounded p-3 mb-4">
                  <p className="text-sm font-semibold text-gray-400 mb-1">Topic:</p>
                  <p className="text-gray-200">{onAirCall.topic}</p>
                </div>
              )}
              
              {onAirCall.screenerNotes && (
                <div className="bg-gray-900/50 rounded p-3 mb-4">
                  <p className="text-sm font-semibold text-gray-400 mb-1">Screener Notes:</p>
                  <p className="text-gray-200">{onAirCall.screenerNotes}</p>
                </div>
              )}

              {/* Inline Audio Controls for Caller */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-red-700">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a.75.75 0 01.75.75v12.5a.75.75 0 01-1.5 0V2.75A.75.75 0 0110 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold">Caller - Muted</span>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-gray-400">0</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    defaultValue="0"
                    disabled
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none"
                  />
                  <span className="text-xs text-gray-400">100</span>
                </div>
              </div>
            </div>
          )}

          {/* Call Queue - Waiting Callers */}
          {activeEpisode && (
            <CallQueueMock 
              episodeId={activeEpisode.id}
              onSelectCaller={() => {}}
              onTakeCall={async (call) => {
                console.log('📞 Taking call on-air, full data:', call);
                setOnAirCall(call);
                
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

          {/* Co-host Card - Always Visible */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold">Co-host</h3>
                  <p className="text-sm text-gray-400">Muted</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-500">--</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

