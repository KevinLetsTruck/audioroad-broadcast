import { useState, useEffect } from 'react';

interface Recording {
  id: string;
  title: string;
  episodeNumber: number;
  showName: string;
  showColor: string;
  date: Date;
  duration: number;
  recordingUrl: string;
  fileSize?: number;
  status: string;
  actualStart?: Date;
  actualEnd?: Date;
}

export default function Recordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [shows, setShows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

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
      
      if (!response.ok) {
        console.error('Failed to fetch recordings:', response.status);
        setRecordings([]);
        return;
      }
      
      const episodes = await response.json();
      console.log('[Recordings] Fetched episodes:', episodes.length);
      
      // Transform episodes into recordings
      const recordingsList = episodes
        .filter((ep: any) => ep.recordingUrl)
        .map((ep: any) => ({
          id: ep.id,
          title: ep.title,
          episodeNumber: ep.episodeNumber,
          showName: ep.show?.name || 'Unknown Show',
          showColor: ep.show?.color || '#3b82f6',
          date: new Date(ep.date),
          duration: ep.duration || 0,
          recordingUrl: ep.recordingUrl,
          fileSize: ep.recordingSize,
          status: ep.status,
          actualStart: ep.actualStart ? new Date(ep.actualStart) : undefined,
          actualEnd: ep.actualEnd ? new Date(ep.actualEnd) : undefined
        }))
        .sort((a: Recording, b: Recording) => b.date.getTime() - a.date.getTime());

      console.log('[Recordings] Processed recordings:', recordingsList.length);
      setRecordings(recordingsList);
    } catch (error) {
      console.error('Error fetching recordings:', error);
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter recordings
  const filteredRecordings = recordings.filter(r => {
    // Filter by show
    if (filter !== 'all' && r.showName !== filter) {
      return false;
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        r.title.toLowerCase().includes(query) ||
        r.showName.toLowerCase().includes(query) ||
        r.episodeNumber.toString().includes(query)
      );
    }
    
    return true;
  });

  const formatDuration = (minutes: number) => {
    if (!minutes || minutes === 0) return 'Unknown';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    if (mb > 1000) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Statistics
  const totalDuration = recordings.reduce((sum, r) => sum + (r.duration || 0), 0);
  const totalHours = Math.floor(totalDuration / 60);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Stats */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">📁 Show Recordings</h1>
          <p className="text-gray-400 mb-4">
            Browse, listen, and download your past broadcasts
          </p>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400">Total Recordings</p>
              <p className="text-2xl font-bold text-blue-400">{recordings.length}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400">Total Content</p>
              <p className="text-2xl font-bold text-green-400">{totalHours}h</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400">Shows</p>
              <p className="text-2xl font-bold text-purple-400">{shows.length}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400">Filtered</p>
              <p className="text-2xl font-bold text-orange-400">{filteredRecordings.length}</p>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <input
                type="text"
                placeholder="🔍 Search by episode title, show name, or episode number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Shows ({recordings.length})</option>
                {shows.map((show) => {
                  const count = recordings.filter(r => r.showName === show.name).length;
                  return (
                    <option key={show.id} value={show.name}>
                      {show.name} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          
          {searchQuery && (
            <p className="text-sm text-gray-400 mt-3">
              Found {filteredRecordings.length} recordings matching "{searchQuery}"
            </p>
          )}
        </div>

        {/* Recordings List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-400">Loading recordings...</p>
          </div>
        ) : filteredRecordings.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-xl font-semibold mb-2">No recordings found</h3>
            {searchQuery ? (
              <p className="text-gray-400">Try adjusting your search or filter</p>
            ) : (
              <p className="text-gray-400">Recordings will appear here after you broadcast shows</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecordings.map((recording) => (
              <div
                key={recording.id}
                className="bg-gray-800 rounded-lg p-6 border-2 border-gray-700 hover:border-gray-600 transition-all"
              >
                {/* Recording Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: recording.showColor }}
                      />
                      <h3 className="text-xl font-bold">{recording.title}</h3>
                      <span className="px-2 py-1 bg-gray-700 rounded text-xs">
                        Ep. {recording.episodeNumber}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <span style={{ color: recording.showColor }}>●</span>
                        {recording.showName}
                      </span>
                      <span>📅 {formatDateTime(recording.date)}</span>
                      {recording.duration > 0 && (
                        <span>⏱️ {formatDuration(recording.duration)}</span>
                      )}
                      {recording.fileSize && (
                        <span>💾 {formatFileSize(recording.fileSize)}</span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        recording.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        recording.status === 'live' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {recording.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Audio Player (if currently playing this recording) */}
                {playingId === recording.id && (
                  <div className="mb-4 bg-gray-900 rounded-lg p-4">
                    <audio 
                      controls 
                      autoPlay
                      src={recording.recordingUrl}
                      className="w-full"
                      onEnded={() => setPlayingId(null)}
                    >
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setPlayingId(playingId === recording.id ? null : recording.id)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      playingId === recording.id
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {playingId === recording.id ? '⏸️ Close Player' : '🎧 Play'}
                  </button>
                  <a
                    href={recording.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
                  >
                    🔗 Open in New Tab
                  </a>
                  <a
                    href={recording.recordingUrl}
                    download={`${recording.showName}-${recording.title}.webm`}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
                  >
                    ⬇️ Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Debug Info (only show if loading failed or empty) */}
        {!loading && recordings.length === 0 && (
          <div className="mt-6 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h3 className="font-semibold mb-2 text-gray-400">🔍 Troubleshooting</h3>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>• Recordings are automatically created when you end a show</li>
              <li>• Check if episodes have recordingUrl set in database</li>
              <li>• Verify the episode status is 'completed'</li>
              <li>• Check browser console for API errors (F12)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
