import { useState, useEffect } from 'react';
import CallQueueMock from '../components/CallQueueMock';
import AudioMixer from '../components/AudioMixer';
import Soundboard from '../components/Soundboard';
import CallerInfo from '../components/CallerInfo';
import ChatPanel from '../components/ChatPanel';

export default function HostDashboard() {
  const [activeEpisode, setActiveEpisode] = useState<any>({
    id: 'episode-1',
    title: 'The AudioRoad Show - October 15, 2025',
    episodeNumber: 1,
    status: 'live',
    show: { name: 'The AudioRoad Show' },
    showId: 'show-1'
  });
  const [onAirCall, setOnAirCall] = useState<any>(null); // Currently on-air
  const [isLive, setIsLive] = useState(true);

  // Mock document analysis data
  const mockDocumentAnalysis = {
    summary: 'Patient shows elevated glucose levels averaging 145 mg/dL with significant spikes after meals. HbA1c at 6.2% indicates pre-diabetic range. Fasting glucose consistently above optimal range.',
    keyFindings: [
      'Post-meal glucose spikes to 180+ mg/dL (should be <140)',
      'Fasting glucose 110-115 mg/dL (optimal <100)',
      'HbA1c 6.2% - pre-diabetic range (5.7-6.4%)',
      'Poor overnight glucose control - staying elevated'
    ],
    recommendations: [
      'Discuss meal timing and carb intake correlation',
      'Ask about current diet - likely too many refined carbs',
      'Recommend protein-first meals to stabilize blood sugar',
      'Consider supplement protocol for insulin sensitivity'
    ],
    confidence: 92
  };

  useEffect(() => {
    // Try to fetch active episode from API, fallback to mock
    fetch('/api/episodes?status=live')
      .then(res => res.json())
      .then(episodes => {
        if (episodes.length > 0) {
          setActiveEpisode(episodes[0]);
          setIsLive(true);
        }
      })
      .catch(error => {
        console.log('Using mock episode data', error);
        // Already set to mock data above
      });
  }, []);

  const startEpisode = async () => {
    if (!activeEpisode) return;
    
    try {
      const response = await fetch(`/api/episodes/${activeEpisode.id}/start`, {
        method: 'PATCH'
      });
      const episode = await response.json();
      setActiveEpisode(episode);
      setIsLive(true);
    } catch (error) {
      console.error('Error starting episode:', error);
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
              onSelectCaller={() => {}} // No preview needed
              onTakeCall={(call) => {
                setOnAirCall(call); // Put caller on-air
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
                  onClick={() => setOnAirCall(null)}
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
                documentAnalysis={onAirCall.documentAnalyzed ? mockDocumentAnalysis : null}
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

