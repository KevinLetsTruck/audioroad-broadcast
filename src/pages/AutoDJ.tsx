/**
 * Auto DJ Management Page
 * 
 * Upload and organize playlist tracks
 * Plays automatically when you're not broadcasting live
 */

import { useState, useEffect } from 'react';

export default function AutoDJ() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [category, setCategory] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/playlist');
      const data = await response.json();
      setTracks(data);
    } catch (error) {
      console.error('Error loading playlist:', error);
      alert('Failed to load playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!audioFile || !title) {
      alert('Please provide title and audio file');
      return;
    }

    setUploading(true);
    setUploadProgress('Uploading...');

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('title', title);
      formData.append('artist', artist);
      formData.append('category', category);

      const response = await fetch('/api/playlist', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setUploadProgress('✅ Track added!');
        
        // Reset form
        setTitle('');
        setArtist('');
        setCategory('');
        setAudioFile(null);
        
        // Reload playlist
        loadTracks();
        
        setTimeout(() => setUploadProgress(''), 2000);
      } else {
        throw new Error('Upload failed');
      }

    } catch (error) {
      console.error('Error uploading track:', error);
      setUploadProgress('❌ Upload failed');
      setTimeout(() => setUploadProgress(''), 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this track from playlist?')) return;

    try {
      const response = await fetch(`/api/playlist/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadTracks();
      }
    } catch (error) {
      console.error('Error deleting track:', error);
      alert('Failed to delete track');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">🎵 Auto DJ</h1>
          <p className="text-gray-400">
            Manage your playlist - plays automatically when you're not live
          </p>
        </div>

        {/* Upload Form */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
          <h2 className="text-2xl font-bold mb-6">➕ Add Track to Playlist</h2>
          
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Track Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Song or content title"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Artist/Creator</label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
              >
                <option value="">Select category...</option>
                <option value="music">Music</option>
                <option value="podcast">Podcast</option>
                <option value="interview">Interview</option>
                <option value="commercial">Commercial</option>
                <option value="jingle">Jingle</option>
                <option value="announcement">Announcement</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Audio File *</label>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-green-600 file:text-white file:cursor-pointer hover:file:bg-green-700"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Supported: MP3, WAV, AAC, OGG • Max 1GB
              </p>
            </div>

            <button
              type="submit"
              disabled={uploading}
              className={`w-full px-6 py-3 rounded-lg font-bold transition-colors ${
                uploading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {uploading ? '⏳ Uploading...' : '⬆️ Upload to Playlist'}
            </button>

            {uploadProgress && (
              <p className="text-center text-sm">
                {uploadProgress}
              </p>
            )}
          </form>
        </div>

        {/* Playlist */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">📀 Playlist ({tracks.length} tracks)</h2>
            <button
              onClick={loadTracks}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              🔄 Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mb-4"></div>
              <p className="text-gray-400">Loading playlist...</p>
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎵</div>
              <p className="text-xl text-gray-400 mb-2">No tracks yet</p>
              <p className="text-sm text-gray-500">
                Upload audio files above to build your Auto DJ playlist
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className="bg-gray-900 p-4 rounded-lg flex items-center gap-4"
                >
                  {/* Track Number */}
                  <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>

                  {/* Track Info */}
                  <div className="flex-1">
                    <h3 className="font-semibold">{track.title}</h3>
                    <p className="text-sm text-gray-400">
                      {track.artist && <span>{track.artist} • </span>}
                      <span>{formatDuration(track.duration)}</span>
                      {track.category && <span> • {track.category}</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Played {track.playCount} times
                      {track.lastPlayed && ` • Last: ${new Date(track.lastPlayed).toLocaleDateString()}`}
                    </p>
                  </div>

                  {/* Audio Preview */}
                  <audio controls src={track.audioUrl} className="h-10">
                    Your browser does not support audio.
                  </audio>

                  {/* Actions */}
                  <button
                    onClick={() => handleDelete(track.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
                  >
                    🗑️ Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-8 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold mb-2">💡 How Auto DJ Works:</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Upload music, podcasts, or audio content to your playlist</li>
            <li>• Auto DJ plays tracks sequentially when you're not broadcasting live</li>
            <li>• Automatically stops when you start a live show</li>
            <li>• Automatically resumes when your show ends</li>
            <li>• Keeps your stream active 24/7!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

