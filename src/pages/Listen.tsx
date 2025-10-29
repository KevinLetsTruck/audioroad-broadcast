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
      {/* Simple centered player with autoplay */}
      <div className="w-full max-w-2xl">
        <StreamPlayer autoplay={true} showControls={true} />
      </div>
    </div>
  );
}

