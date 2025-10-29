/**
 * Public Listen Page
 * 
 * Simple autoplay player - clone of Radio.co embed page
 * For embedding in your custom app
 */

import StreamPlayer from '../components/StreamPlayer';

export default function Listen() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {/* Ultra-simple player - auto-connects when stream goes live */}
      <div className="w-full max-w-2xl">
        <StreamPlayer />
      </div>
    </div>
  );
}

