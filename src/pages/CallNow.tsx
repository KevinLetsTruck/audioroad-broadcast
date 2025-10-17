import { useState, useEffect } from 'react';
import { useTwilioCall } from '../hooks/useTwilioCall';
import DocumentUploadWidget from '../components/DocumentUploadWidget';

export default function CallNow() {
  const [showStatus, setShowStatus] = useState<'live' | 'offline'>('offline');
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'queued'>('idle');
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [callerId, setCallerId] = useState<string | null>(null);
  const [isCreatingCaller, setIsCreatingCaller] = useState(false);
  const [twilioIdentity] = useState(`caller-${Date.now()}`); // Create identity ONCE, not on every render

  const {
    isReady,
    isMuted,
    formattedDuration,
    makeCall,
    hangUp,
    toggleMute
  } = useTwilioCall({
    identity: twilioIdentity,
    onCallConnected: () => {
      console.log('✅ Call connected!');
      setCallState('connected');
      // Note: Call record is created by /api/twilio/voice endpoint
    },
    onCallDisconnected: () => {
      console.log('📴 Call disconnected');
      setCallState('idle');
    }
  });

  // Create caller record on page load so documents can be uploaded
  useEffect(() => {
    const createCaller = async () => {
      if (callerId || isCreatingCaller) return;
      
      setIsCreatingCaller(true);
      try {
        const response = await fetch('/api/callers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: `web-${Date.now()}`,
            name: 'Web Caller',
          })
        });
        const caller = await response.json();
        setCallerId(caller.id);
        console.log('✅ Caller ID created:', caller.id);
      } catch (error) {
        console.error('Error creating caller:', error);
      } finally {
        setIsCreatingCaller(false);
      }
    };

    createCaller();
  }, []);

  useEffect(() => {
    // Check if show is live (poll every 10 seconds)
    const checkLiveStatus = () => {
      fetch('/api/episodes?status=live')
        .then(res => res.json())
        .then(episodes => {
          const newStatus = episodes.length > 0 ? 'live' : 'offline';
          setShowStatus(newStatus);
          console.log('📡 Live status check:', newStatus, episodes.length, 'episodes');
        })
        .catch(() => setShowStatus('offline'));
    };

    // Check immediately
    checkLiveStatus();

    // Then poll every 10 seconds
    const interval = setInterval(checkLiveStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleCallNow = async () => {
    if (!isReady) {
      alert('Phone system not ready. Please refresh and try again.');
      return;
    }

    if (!callerId) {
      alert('Setting up caller profile. Please try again in a moment.');
      return;
    }

    setCallState('calling');

    try {
      // Initiate call with existing caller ID
      await makeCall({ callerId });
    } catch (error) {
      console.error('Error initiating call:', error);
      setCallState('idle');
      alert('Failed to connect. Please try again.');
    }
  };

  const handleDocumentsUploaded = (docs: any[]) => {
    setUploadedDocs([...uploadedDocs, ...docs]);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">
            🎙️ Call Into The AudioRoad Show
          </h1>
          <div className="flex items-center justify-center gap-3">
            {showStatus === 'live' ? (
              <>
                <span className="inline-block w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                <span className="text-2xl font-bold text-red-400">LIVE NOW</span>
              </>
            ) : (
              <>
                <span className="inline-block w-4 h-4 bg-gray-500 rounded-full" />
                <span className="text-2xl text-gray-400">Show Offline</span>
              </>
            )}
          </div>
        </div>

        {/* Call States */}
        {callState === 'idle' && (
          <div className="space-y-8">
            {/* Document Upload Section */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">
                📄 Have Labs or Reports to Discuss?
              </h2>
              <p className="text-gray-400 mb-6">
                Upload your documents before calling. Our AI will analyze them and prepare talking points for the host.
              </p>
              <DocumentUploadWidget
                callerId={callerId || undefined}
                onUploadComplete={handleDocumentsUploaded}
              />
            </div>

            {/* Call Now Button */}
            <div className="text-center">
              <button
                onClick={handleCallNow}
                disabled={!isReady || showStatus === 'offline'}
                className="px-12 py-6 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 rounded-lg text-3xl font-bold transition-colors shadow-lg"
              >
                {!isReady ? '⏳ Loading...' : showStatus === 'offline' ? '⚫ Show Offline' : '📞 Call Now'}
              </button>
              <p className="text-sm text-gray-400 mt-4">
                {showStatus === 'live' 
                  ? 'Click to connect with our call screener'
                  : 'Call button will activate when show is live'}
              </p>
            </div>

            {/* Info Section */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">What Happens Next?</h3>
              <ol className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="text-primary-500 font-bold">1.</span>
                  <span>You'll connect with our call screener who will ask what you'd like to discuss</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary-500 font-bold">2.</span>
                  <span>If approved, you'll be placed in the queue and hear the live show</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary-500 font-bold">3.</span>
                  <span>When it's your turn, you'll hear a tone and you're LIVE on-air!</span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {callState === 'calling' && (
          <div className="text-center py-16">
            <div className="text-6xl mb-6 animate-pulse">📞</div>
            <h2 className="text-3xl font-bold mb-4">Connecting to Call Screener...</h2>
            <p className="text-gray-400">Please wait while we connect your call</p>
          </div>
        )}

        {callState === 'connected' && (
          <div className="space-y-6">
            <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-8 text-center">
              <div className="text-6xl mb-4">🎙️</div>
              <h2 className="text-3xl font-bold mb-2">You're Speaking with Our Call Screener</h2>
              <p className="text-xl text-gray-300 mb-4">Tell them what you'd like to discuss</p>
              <div className="text-2xl font-mono font-bold text-green-400">{formattedDuration}</div>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={toggleMute}
                className={`px-8 py-4 rounded-lg font-bold text-lg transition-colors ${
                  isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {isMuted ? '🔇 Unmute' : '🔊 Mute'}
              </button>

              <button
                onClick={hangUp}
                className="px-8 py-4 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-lg transition-colors"
              >
                ✗ Hang Up
              </button>
            </div>

            {uploadedDocs.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <p className="text-green-400 font-semibold mb-2">
                  ✓ {uploadedDocs.length} document{uploadedDocs.length > 1 ? 's' : ''} uploaded and analyzing
                </p>
                <p className="text-sm text-gray-400">
                  The host will see your analysis when they take your call
                </p>
              </div>
            )}
          </div>
        )}

        {callState === 'queued' && (
          <div className="space-y-6">
            <div className="bg-yellow-900/30 border-2 border-yellow-500 rounded-lg p-8 text-center">
              <div className="text-6xl mb-4">⏳</div>
              <h2 className="text-3xl font-bold mb-2">You're in the Queue!</h2>
              <p className="text-xl text-gray-300 mb-4">
                Listen to the show while you wait. You'll hear a tone when you're live.
              </p>
              <div className="text-2xl font-mono font-bold text-yellow-400">{formattedDuration}</div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <p className="text-gray-300 mb-4">
                🔊 You can now hear the live show. Stay on the line!
              </p>
              <button
                onClick={hangUp}
                className="px-8 py-4 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-lg transition-colors"
              >
                Leave Queue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

