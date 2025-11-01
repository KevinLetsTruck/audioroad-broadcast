/**
 * Streaming Platforms Management
 * 
 * Configure YouTube, Facebook, X (Twitter) stream keys
 * Enable/disable platforms, set 30-min limits
 */

import { useState, useEffect } from 'react';
import { Card, Button, Input, Checkbox, Spinner } from '../components/ui';

interface Platform {
  id: string;
  name: string;
  enabled: boolean;
  thirtyMinLimit: boolean;
  lastUsed?: Date;
}

export default function StreamingPlatforms() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Form state for each platform
  const [youtubeKey, setYoutubeKey] = useState('');
  const [facebookKey, setFacebookKey] = useState('');
  const [xKey, setXKey] = useState('');

  useEffect(() => {
    loadPlatforms();
  }, []);

  const loadPlatforms = async () => {
    try {
      const response = await fetch('/api/platforms');
      const data = await response.json();
      setPlatforms(data);
    } catch (error) {
      console.error('Error loading platforms:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePlatform = async (name: string, streamKey: string, enabled: boolean, thirtyMinLimit: boolean) => {
    if (!streamKey.trim()) {
      alert('Please enter a stream key');
      return;
    }

    setSaving(name);

    try {
      const response = await fetch('/api/platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          streamKey,
          enabled,
          thirtyMinLimit
        })
      });

      if (response.ok) {
        console.log(`✅ Saved ${name} configuration`);
        loadPlatforms();
      }
    } catch (error) {
      console.error(`Error saving ${name}:`, error);
      alert(`Failed to save ${name} configuration`);
    } finally {
      setSaving(null);
    }
  };

  const togglePlatform = async (id: string, currentEnabled: boolean) => {
    try {
      await fetch(`/api/platforms/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });

      loadPlatforms();
    } catch (error) {
      console.error('Error toggling platform:', error);
    }
  };

  const PlatformCard = ({ 
    name, 
    displayName, 
    icon, 
    streamKey, 
    setStreamKey, 
    instructions,
    rtmpUrl
  }: any) => {
    const platform = platforms.find(p => p.name === name);
    const [localThirtyMin, setLocalThirtyMin] = useState(true);

    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <div>
              <h3 className="text-xl font-bold">{displayName}</h3>
              {platform?.lastUsed && (
                <p className="text-xs text-gray-500">
                  Last used: {new Date(platform.lastUsed).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          
          {platform && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={platform.enabled}
                onChange={() => togglePlatform(platform.id, platform.enabled)}
                className="w-5 h-5"
              />
              <span className="text-sm font-semibold">
                {platform.enabled ? '✅ Enabled' : 'Disabled'}
              </span>
            </label>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Stream Key</label>
            <input
              type="password"
              value={streamKey}
              onChange={(e) => setStreamKey(e.target.value)}
              placeholder="Enter your stream key..."
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              {instructions}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">RTMP Server</label>
            <input
              type="text"
              value={rtmpUrl}
              readOnly
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-400 font-mono text-xs"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={localThirtyMin}
              onChange={(e) => setLocalThirtyMin(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">
              ⏰ Auto-stop after 30 minutes (recommended for teasers)
            </span>
          </label>

          <button
            onClick={() => savePlatform(name, streamKey, true, localThirtyMin)}
            disabled={saving === name || !streamKey}
            className={`w-full px-4 py-2 rounded-lg font-semibold ${
              saving === name
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving === name ? '⏳ Saving...' : '💾 Save Configuration'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">📡 Streaming Platforms</h1>
          <p className="text-gray-400">
            Configure multi-platform streaming to YouTube, Facebook, and X
          </p>
        </div>

        {/* Platform Cards */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-400">Loading platforms...</p>
          </div>
        ) : (
          <div className="grid gap-6">
            <PlatformCard
              name="youtube"
              displayName="YouTube Live"
              icon="📺"
              streamKey={youtubeKey}
              setStreamKey={setYoutubeKey}
              instructions="Get from YouTube Studio → Go Live → Stream Key"
              rtmpUrl="rtmp://a.rtmp.youtube.com/live2/YOUR_KEY"
            />

            <PlatformCard
              name="facebook"
              displayName="Facebook Live"
              icon="📘"
              streamKey={facebookKey}
              setStreamKey={setFacebookKey}
              instructions="Get from Facebook Live Producer → Stream Key"
              rtmpUrl="rtmps://live-api-s.facebook.com:443/rtmp/YOUR_KEY"
            />

            <PlatformCard
              name="x"
              displayName="X (Twitter)"
              icon="✖️"
              streamKey={xKey}
              setStreamKey={setXKey}
              instructions="Get from X Media Studio → Producer"
              rtmpUrl="rtmp://live-video.twitter.com/YOUR_KEY"
            />
          </div>
        )}

        {/* Info */}
        <div className="mt-8 bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h3 className="font-semibold mb-3">💡 How Multi-Platform Streaming Works:</h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li>✅ <strong>Enable platforms above</strong> - Check the boxes for platforms you want to use</li>
            <li>✅ <strong>30-minute limit</strong> - Recommended! Streams first 30 min as teaser, stops automatically</li>
            <li>✅ <strong>Full show on YOUR platform</strong> - Complete broadcast always available at /listen</li>
            <li>✅ <strong>Audio-only safe</strong> - Your HLS stream stays audio-only for truckers driving</li>
            <li>✅ <strong>Video optional</strong> - Enable video in Broadcast Control when ready</li>
            <li>✅ <strong>Automatic</strong> - Just start your show, we handle the rest!</li>
          </ul>
        </div>

        {/* Platform Status */}
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {platforms.map(platform => (
            <div key={platform.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <span className="font-semibold capitalize">{platform.name}</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  platform.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-600 text-gray-400'
                }`}>
                  {platform.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {platform.thirtyMinLimit && platform.enabled && (
                <p className="text-xs text-gray-500 mt-1">⏰ 30-min limit active</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

