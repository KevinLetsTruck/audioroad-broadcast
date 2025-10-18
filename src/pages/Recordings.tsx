/**
 * Recordings Page
 * 
 * Browse and manage all show recordings organized by show
 */

import { useState, useEffect } from 'react';

interface Recording {
  id: string;
  title: string;
  showName: string;
  showColor: string;
  date: Date;
  duration: number;
  recordingUrl: string;
  fileSize?: number;
}

export default function Recordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [shows, setShows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShows();
    fetchRecordings();
  }, []);

  const fetchShows = async () => {
    try {
      const response = await fetch('/api/shows');
      const data = await response.json();
      setShows(data);
    } catch (error) {
      console.error('Error fetching shows:', error);
    }
  };

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/recordings');
      const episodes = await response.json();
      
      // Transform episodes into recordings
      const recordingsList = episodes
        .filter((ep: any) => ep.recordingUrl)
        .map((ep: any) => ({
          id: ep.id,
          title: ep.title,
          showName: ep.show?.name || 'Unknown Show',
          showColor: ep.show?.color || '#3b82f6',
          date: new Date(ep.date),
          duration: ep.duration || 0,
          recordingUrl: ep.recordingUrl,
          fileSize: ep.recordingSize
        }))
        .sort((a: Recording, b: Recording) => b.date.getTime() - a.date.getTime());

      setRecordings(recordingsList);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecordings = filter === 'all' 
    ? recordings 
    : recordings.filter(r => r.showName === filter);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold">📁 Show Recordings</h1>
        <p className="text-sm text-gray-400 mt-1">Browse and download past broadcasts</p>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded whitespace-nowrap ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All Shows ({recordings.length})
          </button>
          {shows.map((show) => {
            const count = recordings.filter(r => r.showName === show.name).length;
            return (
              <button
                key={show.id}
                onClick={() => setFilter(show.name)}
                className={`px-4 py-2 rounded whitespace-nowrap ${
                  filter === show.name
                    ? 'text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
                style={filter === show.name ? { backgroundColor: show.color } : {}}
              >
                {show.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Recordings List */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <p>Loading recordings...</p>
          </div>
        ) : filteredRecordings.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-6xl mb-4">📁</div>
            <p className="text-xl mb-2">No recordings yet</p>
            <p className="text-sm">Recordings will appear here after you broadcast shows</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecordings.map((recording) => (
              <div
                key={recording.id}
                className="bg-gray-800 rounded-lg p-4 border-2 border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: recording.showColor }}
                      />
                      <h3 className="text-lg font-semibold">{recording.title}</h3>
                    </div>
                    
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>📅 {recording.date.toLocaleDateString('en-US', { 
                        weekday: 'long',
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric' 
                      })}</span>
                      {recording.duration > 0 && (
                        <span>⏱️ {formatDuration(recording.duration)} hrs</span>
                      )}
                      {recording.fileSize && (
                        <span>💾 {formatFileSize(recording.fileSize)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={recording.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold"
                    >
                      🎧 Listen
                    </a>
                    <a
                      href={recording.recordingUrl}
                      download
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-semibold"
                    >
                      ⬇️ Download
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

