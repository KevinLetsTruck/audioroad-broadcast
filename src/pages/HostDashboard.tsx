import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import ChatPanel from '../components/ChatPanel';
import SimpleCallManager from '../components/SimpleCallManager';
import { useBroadcast } from '../contexts/BroadcastContext';

export default function HostDashboard() {
  const broadcast = useBroadcast(); // Access global mixer
  
  const [activeEpisode, setActiveEpisode] = useState<any>(null);
  const [isLive, setIsLive] = useState(false);
  
  const [approvedCalls, setApprovedCalls] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'calls' | 'documents'>('calls');
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  

  useEffect(() => {
    // Fetch active episode from database
    fetchActiveEpisode();
    
    // Poll every 10 seconds for updates
    const interval = setInterval(fetchActiveEpisode, 10000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeEpisode) {
      fetchApprovedCalls();
      
      // Poll every 2 seconds
      const interval = setInterval(() => {
        fetchApprovedCalls();
      }, 2000);
      
      // Also listen for WebSocket events for immediate updates
      const socket = io();
      socket.emit('join:episode', activeEpisode.id);
      
      socket.on('call:completed', () => {
        console.log('🔔 Call completed event - refreshing queue');
        fetchApprovedCalls();
        // On-air call managed globally now - no need to clear locally
      });
      
      return () => {
        clearInterval(interval);
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

  const fetchApprovedCalls = async () => {
    if (!activeEpisode) return;
    try {
      const response = await fetch(`/api/calls?episodeId=${activeEpisode.id}&status=approved`);
      const calls = await response.json();
      
      // Filter for truly active calls (not ended, recent)
      const now = Date.now();
      const activeCalls = calls.filter((call: any) => {
        if (call.endedAt) return false; // Already ended
        if (call.status === 'completed') return false; // Marked completed
        
        // Only show calls from last 4 hours (prevent ancient calls showing up)
        const callTime = new Date(call.incomingAt || call.createdAt).getTime();
        const age = now - callTime;
        if (age > 4 * 60 * 60 * 1000) return false; // Older than 4 hours
        
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
      console.log('📴 [HOST] Ending episode from Host Dashboard');
      
      const response = await fetch(`/api/episodes/${activeEpisode.id}/end`, {
        method: 'PATCH'
      });
      const episode = await response.json();
      setActiveEpisode(episode);
      setIsLive(false);
      
      // IMPORTANT: Update global broadcast state so Broadcast Control knows!
      broadcast.setState({
        isLive: false,
        episodeId: null,
        showId: null,
        showName: '',
        startTime: null,
        selectedShow: null
      });
      
      console.log('✅ [HOST] Episode ended and global state updated');
    } catch (error) {
      console.error('Error ending episode:', error);
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
        <div className="flex items-center gap-4">
          {/* Tab Switcher */}
          <div className="flex gap-1 bg-gray-900 rounded p-1">
            <button
              onClick={() => setActiveTab('calls')}
              className={`px-3 py-1 rounded text-xs font-semibold ${
                activeTab === 'calls' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Calls
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-3 py-1 rounded text-xs font-semibold ${
                activeTab === 'documents' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Documents
            </button>
          </div>

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

      {/* Main Layout: Content + Chat Sidebar */}
      <div className="flex-1 flex">
        {/* Left: Main Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'calls' ? (
            /* Call Management */
            <div>
              {activeEpisode ? (
                <SimpleCallManager episodeId={activeEpisode.id} />
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <p>No active episode</p>
                </div>
              )}
            </div>
          ) : (
            /* Documents Tab - Show AI Analysis */
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Caller Documents & AI Analysis</h3>
              
              {allDocuments.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p>No documents uploaded yet</p>
                  <p className="text-sm mt-2">Documents will appear here when screener uploads them</p>
                </div>
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
        <div className="flex-1 border-l border-gray-700">
          {activeEpisode && <ChatPanel episodeId={activeEpisode.id} userRole="host" />}
        </div>
      </div>
    </div>
  );
}

export {}

