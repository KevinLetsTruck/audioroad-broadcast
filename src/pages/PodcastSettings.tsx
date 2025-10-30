/**
 * Podcast Settings Page
 * 
 * View and share podcast RSS feed URLs
 * Submit to podcast directories
 */

import { useState } from 'react';

export default function PodcastSettings() {
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = window.location.origin;
  const fullFeedUrl = `${baseUrl}/api/podcast/feed.xml`;
  const teaserFeedUrl = `${baseUrl}/api/podcast/teaser-feed.xml`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">🎙️ Podcast Distribution</h1>
          <p className="text-gray-400">
            Your podcast RSS feeds for Apple Podcasts, Spotify, and more
          </p>
        </div>

        {/* RSS Feed URLs */}
        <div className="space-y-6">
          {/* Full Episodes Feed */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4">📻 Full Episodes Feed</h2>
            <p className="text-gray-400 mb-4">
              Complete episodes for subscribers who want the full experience
            </p>
            
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <p className="text-xs text-gray-500 mb-2">RSS Feed URL:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fullFeedUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm font-mono"
                />
                <button
                  onClick={() => copyToClipboard(fullFeedUrl, 'full')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold"
                >
                  {copied === 'full' ? '✅ Copied!' : '📋 Copy'}
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <a
                href="https://podcastsconnect.apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg hover:from-pink-700 hover:to-purple-700 transition-all"
              >
                <p className="font-bold mb-1">🎵 Apple Podcasts</p>
                <p className="text-xs opacity-90">Submit your podcast</p>
              </a>

              <a
                href="https://podcasters.spotify.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 bg-gradient-to-r from-green-600 to-green-700 rounded-lg hover:from-green-700 hover:to-green-800 transition-all"
              >
                <p className="font-bold mb-1">🎧 Spotify</p>
                <p className="text-xs opacity-90">Submit your podcast</p>
              </a>
            </div>
          </div>

          {/* 30-Minute Teasers Feed */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4">⏰ 30-Minute Teasers Feed</h2>
            <p className="text-gray-400 mb-4">
              Free previews - perfect for discovery and distribution to other platforms
            </p>
            
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <p className="text-xs text-gray-500 mb-2">RSS Feed URL:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={teaserFeedUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm font-mono"
                />
                <button
                  onClick={() => copyToClipboard(teaserFeedUrl, 'teaser')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold"
                >
                  {copied === 'teaser' ? '✅ Copied!' : '📋 Copy'}
                </button>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-200 text-sm">
                💡 <strong>Pro Tip:</strong> Distribute this feed to partner sites and directories 
                to attract new listeners with free previews!
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h3 className="font-semibold mb-4">📝 How to Submit Your Podcast:</h3>
          
          <div className="space-y-4 text-sm text-gray-300">
            <div>
              <p className="font-semibold text-white mb-2">Apple Podcasts:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Visit Apple Podcasts Connect</li>
                <li>Sign in with your Apple ID</li>
                <li>Click "Add a Show"</li>
                <li>Paste your RSS feed URL (full or teaser)</li>
                <li>Wait 24-48 hours for approval</li>
              </ol>
            </div>

            <div>
              <p className="font-semibold text-white mb-2">Spotify:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Visit Spotify for Podcasters</li>
                <li>Click "Get Started"</li>
                <li>Paste your RSS feed URL</li>
                <li>Verify ownership via email</li>
                <li>Usually live within hours!</li>
              </ol>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="font-semibold text-white mb-2">✨ Your Feeds Auto-Update:</p>
              <p>Every time you complete a show, your RSS feeds automatically update with the new episode. Podcast platforms check your feed regularly and will show new episodes within a few hours!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

