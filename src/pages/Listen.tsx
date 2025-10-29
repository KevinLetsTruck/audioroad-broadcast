/**
 * Public Listen Page
 * 
 * Anyone can listen to the live stream here
 * No authentication required
 */

import { useState, useEffect } from 'react';
import StreamPlayer from '../components/StreamPlayer';

export default function Listen() {
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // Check stream status
    checkStreamStatus();
    
    // Poll for status every 30 seconds
    const interval = setInterval(checkStreamStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkStreamStatus = async () => {
    try {
      const response = await fetch('/api/stream/status');
      const data = await response.json();
      setIsLive(data.live);
    } catch (error) {
      console.error('Error checking stream status:', error);
      setIsLive(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <h1 className="text-5xl font-bold mb-4">
            🎙️ Listen Live
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            AudioRoad Network - The Trucking Community's Voice
          </p>
          <p className="text-gray-400">
            Health, Business, and Life on the Road
          </p>
        </div>
      </div>

      {/* Player Section */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <StreamPlayer autoplay={false} showControls={true} />

        {/* Stream Info */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {/* Current Show */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4">📻 Now Playing</h2>
            {isLive ? (
              <>
                <p className="text-green-400 mb-2">🔴 LIVE NOW</p>
                <p className="text-lg font-semibold">DestinationHealth</p>
                <p className="text-sm text-gray-400">Health & Wellness for Professional Drivers</p>
              </>
            ) : (
              <>
                <p className="text-gray-400 mb-2">Stream Offline</p>
                <p className="text-sm text-gray-500">
                  Check back during show times or listen to past episodes!
                </p>
              </>
            )}
          </div>

          {/* How to Call In */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4">📞 Call In</h2>
            <p className="text-gray-300 mb-4">
              Want to share your story or ask a question?
            </p>
            <a
              href="/call-now"
              className="block w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-center transition-colors"
            >
              Call Into The Show
            </a>
            <p className="text-xs text-gray-500 mt-2">
              No sign-up required • Free to call
            </p>
          </div>
        </div>

        {/* Show Schedule */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4">📅 Show Schedule</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-900 rounded">
              <p className="font-semibold text-blue-400">Monday - Industry Insights</p>
              <p className="text-sm text-gray-400">8:00 AM PT • Business & Regulations</p>
            </div>
            <div className="p-4 bg-gray-900 rounded">
              <p className="font-semibold text-orange-400">Tuesday - The PowerHour</p>
              <p className="text-sm text-gray-400">8:00 AM PT • Success Strategies</p>
            </div>
            <div className="p-4 bg-gray-900 rounded">
              <p className="font-semibold text-green-400">Wednesday - DestinationHealth</p>
              <p className="text-sm text-gray-400">8:00 AM PT • Health & Wellness</p>
            </div>
            <div className="p-4 bg-gray-900 rounded">
              <p className="font-semibold text-purple-400">Thursday - Trucking Tech</p>
              <p className="text-sm text-gray-400">8:00 AM PT • Technology & Efficiency</p>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="mt-8 text-center text-gray-400">
          <p className="text-sm">
            AudioRoad Network provides valuable insights, health tips, and community connection
            for professional truck drivers across North America.
          </p>
          <p className="text-xs mt-4 text-gray-600">
            © 2025 AudioRoad Network • All Rights Reserved
          </p>
        </div>
      </div>
    </div>
  );
}

