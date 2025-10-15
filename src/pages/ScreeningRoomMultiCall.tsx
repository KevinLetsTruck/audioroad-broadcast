import { useState } from 'react';
import DocumentUploadWidget from '../components/DocumentUploadWidget';

interface QueuedCall {
  id: string;
  name: string;
  location: string;
  topic: string;
  duration: number;
}

export default function ScreeningRoomMultiCall() {
  const [activeCall, setActiveCall] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    topic: ''
  });
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [queuedCalls, setQueuedCalls] = useState<QueuedCall[]>([]);

  // Demo: Simulate incoming call
  const simulateIncomingCall = () => {
    if (activeCall) {
      return; // Silently ignore if already on a call
    }

    setActiveCall({ id: Date.now().toString() });
    setFormData({ name: '', location: '', topic: '' });
    setCallDuration(0);
    
    // Start timer
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    // Simulate caller providing info after 2 seconds
    setTimeout(() => {
      const mockCallers = [
        { name: 'Mike Johnson', location: 'Nashville, TN', topic: 'ELD mandate compliance questions' },
        { name: 'Sarah Martinez', location: 'Phoenix, AZ', topic: 'Healthy eating on the road - need meal prep tips' },
        { name: 'Tom Williams', location: 'Dallas, TX', topic: 'Oil analysis showing high wear metals, what to do?' },
        { name: 'Lisa Chen', location: 'Seattle, WA', topic: 'Team driving schedules and work-life balance' },
      ];
      const randomCaller = mockCallers[Math.floor(Math.random() * mockCallers.length)];
      setFormData(randomCaller);
    }, 2000);

    return () => clearInterval(interval);
  };

  const handleAddToQueue = () => {
    if (!formData.name || !formData.topic) {
      return; // Button is disabled anyway
    }

    // Add to queue
    const newQueuedCall = {
      id: activeCall.id,
      name: formData.name,
      location: formData.location,
      topic: formData.topic,
      duration: 0
    };
    
    setQueuedCalls([...queuedCalls, newQueuedCall]);
    
    // Reset for next call
    setActiveCall(null);
    setFormData({ name: '', location: '', topic: '' });
    setCallDuration(0);
  };

  const removeFromQueue = (id: string) => {
    setQueuedCalls(queuedCalls.filter(c => c.id !== id));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-[calc(100vh-73px)] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Call Screening Room</h1>
              <p className="text-gray-400">The AudioRoad Show • Live Now</p>
            </div>
            
            {/* Call Queue Counter */}
            <div className="text-center">
              <p className="text-sm text-gray-400">Calls in Queue</p>
              <p className="text-4xl font-bold text-green-400">{queuedCalls.length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Active Call (2/3 width) */}
          <div className="col-span-2">
            {/* Demo Controls */}
            <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
              <p className="text-blue-400 font-semibold mb-3">🎬 Demo Mode</p>
              <button
                onClick={simulateIncomingCall}
                disabled={activeCall !== null}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded font-semibold transition-colors"
              >
                📞 Simulate Incoming Call
              </button>
            </div>

            {!activeCall ? (
              <div className="text-center py-16 bg-gray-800 rounded-lg">
                <div className="text-6xl mb-6">☎️</div>
                <h3 className="text-2xl font-bold mb-4">Waiting for incoming calls...</h3>
                <p className="text-gray-400">Callers will appear here when they click "Call Now"</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active Call Header */}
                <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold">🎙️ Live Call - Fill Info While Talking</h3>
                      <p className="text-green-400 text-sm">Ask: Name, Location, What they want to discuss</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-mono font-bold text-green-400">
                        {formatDuration(callDuration)}
                      </div>
                      <p className="text-xs text-gray-400">Call Duration</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={`px-6 py-3 rounded-lg font-bold transition-colors ${
                        isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {isMuted ? '🔇 Unmute' : '🔊 Mute'}
                    </button>

                    <button
                      onClick={() => setActiveCall(null)}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors"
                    >
                      ✗ End Call
                    </button>

                    {/* Audio Level Meter */}
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-xs text-gray-400">AUDIO</span>
                      <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-green-500 transition-all ${isMuted ? 'w-0' : 'w-3/4 animate-pulse'}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simplified Caller Form */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h4 className="text-lg font-bold mb-4">Caller Information</h4>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500 text-lg"
                        placeholder="Caller's name"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Location</label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500 text-lg"
                        placeholder="City, State"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">What do they want to discuss? *</label>
                      <textarea
                        value={formData.topic}
                        onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500 text-lg"
                        placeholder="Brief topic description..."
                      />
                    </div>
                  </div>
                </div>

                {/* Document Upload (Collapsible) */}
                <details className="bg-gray-800 rounded-lg overflow-hidden">
                  <summary className="px-6 py-4 cursor-pointer hover:bg-gray-700 font-semibold">
                    📄 Upload Document (Optional)
                  </summary>
                  <div className="px-6 pb-6">
                    <DocumentUploadWidget
                      callerId="demo-caller"
                      maxFiles={3}
                    />
                  </div>
                </details>

                {/* Add to Queue Button */}
                <button
                  onClick={handleAddToQueue}
                  disabled={!formData.name || !formData.topic}
                  className="w-full py-5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-bold text-2xl transition-colors"
                >
                  ✓ Add to Host Queue
                </button>
              </div>
            )}
          </div>

          {/* Right: Queued Calls */}
          <div className="col-span-1">
            <div className="bg-gray-800 rounded-lg p-6 sticky top-4">
              <h4 className="text-lg font-bold mb-4 flex items-center justify-between">
                <span>Queued for Host</span>
                <span className="text-2xl font-bold text-green-400">{queuedCalls.length}</span>
              </h4>

              {queuedCalls.length === 0 ? (
                <p className="text-gray-500 text-center py-8 text-sm">
                  No calls in queue
                </p>
              ) : (
                <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                  {queuedCalls.map(call => (
                    <div key={call.id} className="bg-gray-900 p-4 rounded border border-green-700">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h5 className="font-bold">{call.name}</h5>
                          <p className="text-xs text-gray-400">{call.location}</p>
                        </div>
                        <button
                          onClick={() => removeFromQueue(call.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                          title="Remove from queue"
                        >
                          ✗
                        </button>
                      </div>
                      
                      <p className="text-sm text-gray-300 mb-2 line-clamp-2">{call.topic}</p>
                      
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 bg-green-900 text-green-400 rounded">
                          🔊 Hearing show
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {queuedCalls.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400 text-center">
                    Host can take these calls on-air from their dashboard
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

