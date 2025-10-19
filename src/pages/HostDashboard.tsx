/**
 * Host Dashboard - Simplified
 * 
 * Shows documents and chat for reference during broadcast
 * Call management moved to Broadcast Control
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ChatPanel from '../components/ChatPanel';
import { useBroadcast } from '../contexts/BroadcastContext';

export default function HostDashboard() {
  const broadcast = useBroadcast();
  
  const [activeEpisode, setActiveEpisode] = useState<any>(null);
  const [isLive, setIsLive] = useState(false);
  const [allDocuments, setAllDocuments] = useState<any[]>([]);

  useEffect(() => {
    fetchActiveEpisode();
    const interval = setInterval(fetchActiveEpisode, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeEpisode) {
      fetchAllDocuments();
      const interval = setInterval(fetchAllDocuments, 30000); // Every 30 sec
      return () => clearInterval(interval);
    }
  }, [activeEpisode]);

  const fetchAllDocuments = async () => {
    if (!activeEpisode) return;
    
    try {
      const response = await fetch(`/api/analysis/documents?episodeId=${activeEpisode.id}`);
      const docs = await response.json();
      setAllDocuments(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchActiveEpisode = async () => {
    try {
      const response = await fetch('/api/episodes?status=live');
      const episodes = await response.json();
      
      if (episodes.length > 0) {
        setActiveEpisode(episodes[0]);
        setIsLive(true);
      } else {
        setActiveEpisode(null);
        setIsLive(false);
      }
    } catch (error) {
      console.error('Error fetching episode:', error);
      setActiveEpisode(null);
      setIsLive(false);
    }
  };

  const endEpisode = async () => {
    if (!activeEpisode) return;
    
    try {
      await fetch(`/api/episodes/${activeEpisode.id}/end`, { method: 'PATCH' });
      setActiveEpisode(null);
      setIsLive(false);
      
      // Update global state
      broadcast.setState({
        isLive: false,
        episodeId: null,
        showId: null,
        showName: '',
        startTime: null,
        selectedShow: null
      });
    } catch (error) {
      console.error('Error ending episode:', error);
    }
  };

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col">
      {/* Header */}
      <div className="px-6 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isLive && <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
          <h2 className="text-lg font-bold">{activeEpisode?.title || 'Host Dashboard'}</h2>
        </div>
        <div className="flex items-center gap-4">
          {/* Info Banner */}
          <div className="bg-blue-900/30 border border-blue-500 rounded px-3 py-2 text-xs">
            💡 Manage calls in <Link to="/" className="text-blue-400 underline hover:text-blue-300">Broadcast Control</Link>
          </div>

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

      {/* Main Layout: Documents + Chat */}
      <div className="flex-1 flex">
        {/* Left: Documents */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-lg font-semibold mb-4">Caller Documents & AI Analysis</h3>
          
          {allDocuments.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p>No documents uploaded yet</p>
              <p className="text-sm mt-2">Documents will appear here when screener uploads them</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allDocuments.map((doc: any) => {
                let analysis = null;
                try {
                  analysis = typeof doc.aiAnalysis === 'string' ? JSON.parse(doc.aiAnalysis) : doc.aiAnalysis;
                } catch (e) {
                  console.error('Error parsing analysis:', e);
                }
                
                return (
                  <div key={doc.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{doc.caller?.name || 'Unknown Caller'}</h4>
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
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Analysis pending...</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Chat Sidebar */}
        <div className="flex-1 border-l border-gray-700">
          {activeEpisode && <ChatPanel episodeId={activeEpisode.id} userRole="host" />}
        </div>
      </div>
    </div>
  );
}

export {}
