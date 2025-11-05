import { useState, useEffect } from 'react';
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
      
      return () => {
        clearInterval(interval);
        socket.off('call:completed');
        socket.off('episode:lines-opened');
        socket.off('episode:start');
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
      
      // Step 5: Start streaming
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
        if (approvedResponse.ok) {
          const approvedCallers = await approvedResponse.json();
          console.log(`   Found ${approvedCallers.length} approved callers in queue`);
          
          // Take each off hold concurrently
          await Promise.all(approvedCallers.map(async (caller: any) => {
            try {
              await fetch(`/api/participants/${caller.id}/off-hold`, { method: 'PATCH' });
              console.log(`   ✅ ${caller.caller?.name || 'Caller'} can now hear live show`);
            } catch (err) {
              console.error(`   ⚠️ Failed to take ${caller.id} off hold:`, err);
            }
          }));
        }
      } catch (err) {
        console.error('⚠️ Failed to process approved callers:', err);
        // Continue anyway - not critical to show starting
      }
      
      // Step 7: Play show opener (goes to mixer → conference → callers hear it)
      if (show?.openerAudioUrl) {
        await mixerInstance.playAudioFile(show.openerAudioUrl);
      }
      
      console.log('🎉 SHOW STARTED! You are LIVE!');
      
    } catch (error) {
      console.error('❌ [START-BROADCAST] Error:', error);
      alert(`Failed to start show: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        linesOpen: false,
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


  const tabs: Tab[] = [
    { id: 'calls', label: 'Calls' },
    { id: 'documents', label: 'Documents' },
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
              onChange={(id) => setActiveTab(id as 'calls' | 'documents')}
              variant="pills"
            />
            {!isLive && activeEpisode && activeEpisode.conferenceActive && activeEpisode.status === 'scheduled' && (
              <Button variant="success" size="sm" onClick={startBroadcast}>
                START SHOW
              </Button>
            )}
            {isLive && (
              <Button variant="danger" size="sm" onClick={endEpisode}>
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

