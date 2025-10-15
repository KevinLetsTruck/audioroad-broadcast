import { useState, useEffect } from 'react';

export default function ShowSetupMock() {
  const [shows, setShows] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [usesMock, setUsesMock] = useState(false);

  // Try to load from API, fallback to mock
  useEffect(() => {
    fetchShows();
    fetchEpisodes();
  }, []);

  const fetchShows = async () => {
    try {
      const response = await fetch('/api/shows');
      const data = await response.json();
      if (Array.isArray(data)) {
        setShows(data);
        setUsesMock(false);
      } else {
        useMockData();
      }
    } catch (error) {
      console.log('API error, using mock data', error);
      useMockData();
    }
  };

  const fetchEpisodes = async () => {
    try {
      const response = await fetch('/api/episodes');
      const data = await response.json();
      if (Array.isArray(data)) {
        setEpisodes(data);
      }
    } catch (error) {
      console.log('API error for episodes');
    }
  };

  const useMockData = () => {
    setUsesMock(true);
    setShows([
      {
        id: 'show-1',
        name: 'The AudioRoad Show',
        hostName: 'Your Name',
        slug: 'audioroad-show',
        isActive: true
      }
    ]);
    setEpisodes([
      {
        id: 'episode-1',
        showId: 'show-1',
        episodeNumber: 1,
        title: 'The AudioRoad Show - October 15, 2025',
        date: new Date().toISOString(),
        status: 'scheduled',
        show: {
          name: 'The AudioRoad Show'
        }
      }
    ]);
  };

  const createShow = async () => {
    const name = prompt('Show Name:', 'The AudioRoad Show');
    if (!name) return;

    const hostName = prompt('Host Name:', 'Your Name');
    if (!hostName) return;

    setLoading(true);

    if (usesMock) {
      // Mock mode
      const newShow = {
        id: `show-${Date.now()}`,
        name,
        hostName,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        isActive: true
      };
      setShows([...shows, newShow]);
      setLoading(false);
    } else {
      // Real API
      try {
        const response = await fetch('/api/shows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
            hostId: 'host-1',
            hostName,
            description: 'Live radio show for the trucking industry',
            schedule: {
              days: ['mon', 'tue', 'wed', 'thu'],
              time: '15:00',
              duration: 180,
              timezone: 'America/New_York'
            }
          })
        });

        if (response.ok) {
          fetchShows();
        }
      } catch (error) {
        console.error('Error creating show:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const createEpisode = async (showId: string, showName: string) => {
    const title = prompt('Episode Title:', `${showName} - ${new Date().toLocaleDateString()}`);
    if (!title) return;

    setLoading(true);

    if (usesMock) {
      // Mock mode
      const show = shows.find(s => s.id === showId);
      const newEpisode = {
        id: `episode-${Date.now()}`,
        showId,
        episodeNumber: episodes.filter(e => e.showId === showId).length + 1,
        title,
        date: new Date().toISOString(),
        status: 'scheduled',
        show
      };
      setEpisodes([...episodes, newEpisode]);
      setLoading(false);
    } else {
      // Real API
      try {
        const now = new Date();
        const endTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);

        const response = await fetch('/api/episodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            showId,
            title,
            date: now.toISOString(),
            scheduledStart: now.toISOString(),
            scheduledEnd: endTime.toISOString(),
            description: 'Live episode'
          })
        });

        if (response.ok) {
          fetchEpisodes();
        }
      } catch (error) {
        console.error('Error creating episode:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const startEpisode = async (episodeId: string) => {
    if (!confirm('Start this episode and go LIVE?')) return;

    setLoading(true);

    if (usesMock) {
      setEpisodes(episodes.map(ep =>
        ep.id === episodeId ? { ...ep, status: 'live' } : ep
      ));
      setLoading(false);
    } else {
      try {
        const response = await fetch(`/api/episodes/${episodeId}/start`, {
          method: 'PATCH'
        });

        if (response.ok) {
          fetchEpisodes();
        }
      } catch (error) {
        console.error('Error starting episode:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const endEpisode = async (episodeId: string) => {
    if (!confirm('End this episode?')) return;

    setLoading(true);

    if (usesMock) {
      setEpisodes(episodes.map(ep =>
        ep.id === episodeId ? { ...ep, status: 'completed' } : ep
      ));
      setLoading(false);
    } else {
      try {
        const response = await fetch(`/api/episodes/${episodeId}/end`, {
          method: 'PATCH'
        });

        if (response.ok) {
          fetchEpisodes();
        }
      } catch (error) {
        console.error('Error ending episode:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-73px)] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Show Management</h1>
          <p className="text-gray-400">Create shows and episodes to start broadcasting</p>
          {usesMock && (
            <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
              <p className="text-yellow-400 text-sm">
                ⚠️ Mock Mode: Database connection failed. Data won't persist. Perfect for testing the UI!
              </p>
            </div>
          )}
          {!usesMock && (
            <div className="mt-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
              <p className="text-green-400 text-sm">
                ✅ Connected to Database: Data will be saved and persist!
              </p>
            </div>
          )}
        </div>

        {/* Shows Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Your Shows</h2>
            <button
              onClick={createShow}
              disabled={loading}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 rounded font-semibold transition-colors"
            >
              + Create New Show
            </button>
          </div>

          <div className="grid gap-4">
            {shows.map(show => (
              <div key={show.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{show.name}</h3>
                    <p className="text-gray-400">Host: {show.hostName}</p>
                  </div>
                  <button
                    onClick={() => createEpisode(show.id, show.name)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-semibold transition-colors"
                  >
                    + New Episode
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Episodes Section */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Episodes</h2>

          <div className="grid gap-4">
            {episodes.map(episode => (
              <div key={episode.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">{episode.title}</h3>
                      {episode.status === 'live' && (
                        <span className="flex items-center gap-2 px-3 py-1 bg-red-600 rounded-full text-sm">
                          <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
                          LIVE
                        </span>
                      )}
                      {episode.status === 'scheduled' && (
                        <span className="px-3 py-1 bg-yellow-600 rounded-full text-sm">
                          Scheduled
                        </span>
                      )}
                      {episode.status === 'completed' && (
                        <span className="px-3 py-1 bg-gray-600 rounded-full text-sm">
                          Completed
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">
                      Episode #{episode.episodeNumber} • {new Date(episode.date).toLocaleDateString()}
                    </p>
                    {episode.show && (
                      <p className="text-gray-500 text-sm">{episode.show.name}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    {episode.status === 'scheduled' && (
                      <button
                        onClick={() => startEpisode(episode.id)}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded font-bold text-lg transition-colors"
                      >
                        🔴 GO LIVE
                      </button>
                    )}
                    {episode.status === 'live' && (
                      <button
                        onClick={() => endEpisode(episode.id)}
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded font-bold text-lg transition-colors"
                      >
                        ⏹ END SHOW
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

