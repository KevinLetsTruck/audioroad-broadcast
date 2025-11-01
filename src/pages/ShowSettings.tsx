import { useState, useEffect } from 'react';
import { Card, Button, Badge, Select, EmptyState } from '../components/ui';

export default function ShowSettings() {
  const [shows, setShows] = useState<any[]>([]);
  const [uploading, setUploading] = useState<{ showId: string; type: 'opener' | 'ad' } | null>(null);
  const [availableCommercials, setAvailableCommercials] = useState<any[]>([]);
  const [assignedCommercials, setAssignedCommercials] = useState<{ [showId: string]: { [slot: number]: any } }>({});

  useEffect(() => {
    fetchShows();
    fetchCommercials();
  }, []);

  const fetchShows = async () => {
    try {
      const response = await fetch('/api/shows');
      const data = await response.json();
      setShows(data);
      
      // Fetch assigned commercials for each show
      for (const show of data) {
        fetchShowCommercials(show.id);
      }
    } catch (error) {
      console.error('Error fetching shows:', error);
    }
  };

  const fetchCommercials = async () => {
    try {
      const response = await fetch('/api/commercials/list');
      const data = await response.json();
      setAvailableCommercials(data.commercials || []);
    } catch (error) {
      console.error('Error fetching commercials:', error);
    }
  };

  const fetchShowCommercials = async (showId: string) => {
    try {
      const response = await fetch(`/api/shows/${showId}/commercials`);
      const data = await response.json();
      
      // Convert array to slot-indexed object
      const slotMap: { [slot: number]: any } = {};
      data.forEach((assignment: any) => {
        slotMap[assignment.slot] = assignment;
      });
      
      setAssignedCommercials(prev => ({
        ...prev,
        [showId]: slotMap
      }));
    } catch (error) {
      console.error('Error fetching show commercials:', error);
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

  const handleAssignCommercial = async (showId: string, slot: number, audioAssetId: string) => {
    try {
      const response = await fetch(`/api/shows/${showId}/commercials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioAssetId, slot })
      });

      if (response.ok) {
        await fetchShowCommercials(showId);
      } else {
        alert('Failed to assign commercial');
      }
    } catch (error) {
      console.error('Error assigning commercial:', error);
      alert('Failed to assign commercial');
    }
  };

  const handleRemoveCommercial = async (showId: string, slot: number) => {
    if (!confirm(`Remove commercial from slot ${slot}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/shows/${showId}/commercials/${slot}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchShowCommercials(showId);
      } else {
        alert('Failed to remove commercial');
      }
    } catch (error) {
      console.error('Error removing commercial:', error);
      alert('Failed to remove commercial');
    }
  };

  return (
    <div className="min-h-screen p-6">
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

                {/* End-of-Show Commercials Section */}
                <div className="bg-gray-900 rounded p-4">
                  <h3 className="font-semibold mb-3">📢 End-of-Show Commercials (3 Slots)</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Play sequentially when you end this show
                  </p>

                  <div className="space-y-4">
                    {[1, 2, 3].map((slot) => {
                      const assignment = assignedCommercials[show.id]?.[slot];
                      
                      return (
                        <div key={slot} className="border border-gray-700 rounded p-3">
                          <label className="block text-xs font-medium mb-2">
                            Commercial {slot}
                          </label>
                          
                          <select
                            value={assignment?.audioAssetId || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssignCommercial(show.id, slot, e.target.value);
                              }
                            }}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm mb-2"
                          >
                            <option value="">-- Select Commercial --</option>
                            {availableCommercials.map((commercial) => (
                              <option key={commercial.id} value={commercial.id}>
                                {commercial.name} ({commercial.duration}s)
                              </option>
                            ))}
                          </select>
                          
                          {assignment && (
                            <div className="space-y-2">
                              <audio
                                src={assignment.audioAsset.fileUrl}
                                controls
                                className="w-full h-8"
                              />
                              <button
                                onClick={() => handleRemoveCommercial(show.id, slot)}
                                className="w-full px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                              >
                                🗑️ Remove from Slot {slot}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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

