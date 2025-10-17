import { useState, useEffect } from 'react';

export default function ShowSetup() {
  const [shows, setShows] = useState<any[]>([]);
  const [activeEpisodes, setActiveEpisodes] = useState<any[]>([]);
  const [completedEpisodes, setCompletedEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showingForm, setShowingForm] = useState(false);
  const [showingEpisodeForm, setShowingEpisodeForm] = useState<string | null>(null);
  
  // Form state
  const [showForm, setShowForm] = useState({
    name: '',
    hostName: '',
    description: ''
  });
  
  const [episodeForm, setEpisodeForm] = useState({
    title: '',
    description: ''
  });

  useEffect(() => {
    fetchShows();
    fetchEpisodes();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchEpisodes();
    }, 10000);
    
    return () => clearInterval(interval);
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

  const fetchEpisodes = async () => {
    try {
      const response = await fetch('/api/episodes');
      const data = await response.json();
      
      // Separate active and completed
      const active = data.filter((e: any) => e.status === 'live' || e.status === 'scheduled');
      const completed = data.filter((e: any) => e.status === 'completed');
      
      setActiveEpisodes(active);
      setCompletedEpisodes(completed);
    } catch (error) {
      console.error('Error fetching episodes:', error);
    }
  };

  const createShow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showForm.name || !showForm.hostName) return;

    setLoading(true);
    try {
      const response = await fetch('/api/shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: showForm.name,
          slug: showForm.name.toLowerCase().replace(/\s+/g, '-'),
          hostId: 'host-1',
          hostName: showForm.hostName,
          description: showForm.description || 'Live radio show for the trucking industry',
          schedule: {
            days: ['mon', 'tue', 'wed', 'thu'],
            time: '15:00',
            duration: 180,
            timezone: 'America/New_York'
          }
        })
      });

      if (response.ok) {
        setShowForm({ name: '', hostName: '', description: '' });
        setShowingForm(false);
        fetchShows();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const createEpisode = async (e: React.FormEvent, showId: string) => {
    e.preventDefault();
    if (!episodeForm.title) return;

    setLoading(true);
    try {
      const now = new Date();
      const endTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);

      const response = await fetch('/api/episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId,
          title: episodeForm.title,
          date: now.toISOString(),
          scheduledStart: now.toISOString(),
          scheduledEnd: endTime.toISOString(),
          description: episodeForm.description || 'Live episode'
        })
      });

      if (response.ok) {
        setEpisodeForm({ title: '', description: '' });
        setShowingEpisodeForm(null);
        fetchEpisodes();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const startEpisode = async (episodeId: string) => {
    if (!confirm('Start this episode and go LIVE?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/episodes/${episodeId}/start`, {
        method: 'PATCH'
      });

      if (response.ok) {
        alert('🔴 LIVE! Episode started successfully!');
        fetchEpisodes();
      } else {
        alert('Failed to start episode');
      }
    } catch (error) {
      alert('Error starting episode');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const endEpisode = async (episodeId: string) => {
    if (!confirm('End this episode?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/episodes/${episodeId}/end`, {
        method: 'PATCH'
      });

      if (response.ok) {
        alert('Episode ended successfully!');
        fetchEpisodes();
      } else {
        alert('Failed to end episode');
      }
    } catch (error) {
      alert('Error ending episode');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col">
      {/* Header */}
      <div className="px-6 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">Show Management</h2>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>Active: {activeEpisodes.length}</span>
          <span>•</span>
          <span>Completed: {completedEpisodes.length}</span>
          <span>•</span>
          <span>Shows: {shows.length}</span>
        </div>
      </div>

      {/* Main 50/50 Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Active Shows & Episodes - 50% */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Shows Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Your Shows</h3>
              <button
                onClick={() => setShowingForm(!showingForm)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold text-sm"
              >
                {showingForm ? '✕ Cancel' : '+ New Show'}
              </button>
            </div>

            {/* Create Show Form */}
            {showingForm && (
              <form onSubmit={createShow} className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Show Name *"
                    value={showForm.name}
                    onChange={(e) => setShowForm({ ...showForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Host Name *"
                    value={showForm.hostName}
                    onChange={(e) => setShowForm({ ...showForm, hostName: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                    required
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={showForm.description}
                    onChange={(e) => setShowForm({ ...showForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500 h-20"
                  />
                  <button
                    type="submit"
                    disabled={loading || !showForm.name || !showForm.hostName}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-semibold"
                  >
                    {loading ? 'Creating...' : 'Create Show'}
                  </button>
                </div>
              </form>
            )}

            {/* Shows List */}
            {shows.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400 text-sm">
                No shows yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {shows.map(show => (
                  <div key={show.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold">{show.name}</h4>
                        <p className="text-xs text-gray-400">Host: {show.hostName}</p>
                      </div>
                      <button
                        onClick={() => setShowingEpisodeForm(showingEpisodeForm === show.id ? null : show.id)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs font-semibold"
                      >
                        {showingEpisodeForm === show.id ? '✕' : '+ Episode'}
                      </button>
                    </div>

                    {/* Create Episode Form */}
                    {showingEpisodeForm === show.id && (
                      <form onSubmit={(e) => createEpisode(e, show.id)} className="mt-3 pt-3 border-t border-gray-700">
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder={`${show.name} - ${new Date().toLocaleDateString()}`}
                            value={episodeForm.title}
                            onChange={(e) => setEpisodeForm({ ...episodeForm, title: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-green-500 text-sm"
                            required
                          />
                          <button
                            type="submit"
                            disabled={loading || !episodeForm.title}
                            className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm font-semibold"
                          >
                            {loading ? 'Creating...' : 'Create Episode'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Episodes */}
          <div>
            <h3 className="text-xl font-bold mb-4">Active Episodes</h3>
            
            {activeEpisodes.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400 text-sm">
                No active episodes. Create an episode from a show above.
              </div>
            ) : (
              <div className="space-y-3">
                {activeEpisodes.map(episode => (
                  <div key={episode.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold">{episode.title}</h4>
                          {episode.status === 'live' && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-600 rounded-full text-xs">
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                              LIVE
                            </span>
                          )}
                          {episode.status === 'scheduled' && (
                            <span className="px-2 py-0.5 bg-yellow-600 rounded-full text-xs">Scheduled</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {new Date(episode.date).toLocaleDateString()} • {new Date(episode.date).toLocaleTimeString()}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {episode.status === 'scheduled' && (
                          <button
                            onClick={() => startEpisode(episode.id)}
                            disabled={loading}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded font-bold text-sm"
                          >
                            🔴 GO LIVE
                          </button>
                        )}
                        {episode.status === 'live' && (
                          <button
                            onClick={() => endEpisode(episode.id)}
                            disabled={loading}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded font-bold text-sm"
                          >
                            ⏹ END
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Completed Episodes Archive - 50% */}
        <div className="flex-1 border-l border-gray-700 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Completed Shows</h3>
            <span className="text-sm text-gray-400">{completedEpisodes.length} total</span>
          </div>

          {completedEpisodes.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400 text-sm">
              <div className="text-4xl mb-3">📻</div>
              <p>No completed episodes yet</p>
              <p className="text-xs mt-2">Episodes will appear here after they end</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedEpisodes.map(episode => (
                <div key={episode.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm">{episode.title}</h4>
                    <span className="px-2 py-0.5 bg-gray-700 rounded-full text-xs">Completed</span>
                  </div>
                  
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>📅 {new Date(episode.date).toLocaleDateString()}</p>
                    {episode.actualStart && episode.actualEnd && (
                      <p>
                        ⏱️ {new Date(episode.actualStart).toLocaleTimeString()} - {new Date(episode.actualEnd).toLocaleTimeString()}
                        {' '}({Math.round((new Date(episode.actualEnd).getTime() - new Date(episode.actualStart).getTime()) / 60000)} min)
                      </p>
                    )}
                    {episode.show && <p>🎙️ {episode.show.name}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

