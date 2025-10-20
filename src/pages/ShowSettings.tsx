import { useState, useEffect } from 'react';

export default function ShowSettings() {
  const [shows, setShows] = useState<any[]>([]);
  const [uploading, setUploading] = useState<{ showId: string; type: 'opener' | 'ad' } | null>(null);

  useEffect(() => {
    fetchShows();
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

  const handleUpload = async (showId: string, type: 'opener' | 'ad', file: File) => {
    setUploading({ showId, type });
    
    try {
      const formData = new FormData();
      formData.append('audio', file);

      const response = await fetch(`/api/shows/${showId}/${type}`, {
        method: 'PATCH',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      alert(`✅ ${type === 'opener' ? 'Opener' : 'Ad'} uploaded successfully!`);
      fetchShows(); // Refresh to show new URLs
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      alert(`❌ Failed to upload ${type}. Please try again.`);
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = async (showId: string, type: 'opener' | 'ad') => {
    if (!confirm(`Remove this ${type}? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/shows/${showId}/${type}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert(`✅ ${type === 'opener' ? 'Opener' : 'Ad'} removed`);
        fetchShows();
      }
    } catch (error) {
      console.error(`Error removing ${type}:`, error);
      alert('Failed to remove file');
    }
  };

  return (
    <div className="h-[calc(100vh-73px)] p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Show Settings</h1>
        <p className="text-gray-400 mb-8">Manage show openers and ads for each of your shows</p>

        <div className="space-y-6">
          {shows.map((show) => (
            <div key={show.id} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: show.color || '#fff' }}>
                    {show.name}
                  </h2>
                  <p className="text-sm text-gray-400">{show.description}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Opener Section */}
                <div className="bg-gray-900 rounded p-4">
                  <h3 className="font-semibold mb-3">🎵 Show Opener</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Plays automatically when you start this show
                  </p>

                  {show.openerAudioUrl ? (
                    <div className="space-y-3">
                      <audio
                        src={show.openerAudioUrl}
                        controls
                        className="w-full"
                      />
                      <div className="flex gap-2">
                        <label className="flex-1">
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => e.target.files?.[0] && handleUpload(show.id, 'opener', e.target.files[0])}
                            className="hidden"
                          />
                          <div className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-center cursor-pointer">
                            {uploading?.showId === show.id && uploading?.type === 'opener' ? '⏳ Uploading...' : '🔄 Replace'}
                          </div>
                        </label>
                        <button
                          onClick={() => handleRemove(show.id, 'opener')}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="block">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => e.target.files?.[0] && handleUpload(show.id, 'opener', e.target.files[0])}
                        className="hidden"
                      />
                      <div className="px-4 py-3 bg-green-600 hover:bg-green-700 rounded text-center cursor-pointer font-semibold">
                        {uploading?.showId === show.id && uploading?.type === 'opener' ? '⏳ Uploading...' : '⬆️ Upload Opener'}
                      </div>
                    </label>
                  )}
                </div>

                {/* Ad Section */}
                <div className="bg-gray-900 rounded p-4">
                  <h3 className="font-semibold mb-3">📢 End-of-Show Ad</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Plays automatically when you end this show
                  </p>

                  {show.adAudioUrl ? (
                    <div className="space-y-3">
                      <audio
                        src={show.adAudioUrl}
                        controls
                        className="w-full"
                      />
                      <div className="flex gap-2">
                        <label className="flex-1">
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => e.target.files?.[0] && handleUpload(show.id, 'ad', e.target.files[0])}
                            className="hidden"
                          />
                          <div className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-center cursor-pointer">
                            {uploading?.showId === show.id && uploading?.type === 'ad' ? '⏳ Uploading...' : '🔄 Replace'}
                          </div>
                        </label>
                        <button
                          onClick={() => handleRemove(show.id, 'ad')}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="block">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => e.target.files?.[0] && handleUpload(show.id, 'ad', e.target.files[0])}
                        className="hidden"
                      />
                      <div className="px-4 py-3 bg-green-600 hover:bg-green-700 rounded text-center cursor-pointer font-semibold">
                        {uploading?.showId === show.id && uploading?.type === 'ad' ? '⏳ Uploading...' : '⬆️ Upload Ad'}
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export {}

