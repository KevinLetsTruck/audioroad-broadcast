import { useState } from 'react';
import DocumentUploadWidget from '../components/DocumentUploadWidget';

export default function ScreeningRoomMock() {
  const [callState, setCallState] = useState<'waiting' | 'active'>('waiting');
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    topic: '',
    truckerType: 'OTR',
    priority: 'normal',
    notes: ''
  });
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Simulate incoming call
  const simulateIncomingCall = () => {
    setCallState('active');
    // Start mock timer
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    
    // Auto-fill with example data after 2 seconds (simulating screener filling form)
    setTimeout(() => {
      setFormData({
        name: 'Mike Johnson',
        location: 'Nashville, TN',
        topic: 'Want to discuss new ELD mandates and how they affect owner-operators',
        truckerType: 'Owner-Operator',
        priority: 'normal',
        notes: 'Regular caller, very knowledgeable'
      });
    }, 2000);

    return () => clearInterval(interval);
  };

  const handleAddToQueue = () => {
    alert('Call added to host queue! The caller will now hear the live show while waiting.');
    setCallState('waiting');
    setCallDuration(0);
    setFormData({
      name: '',
      location: '',
      topic: '',
      truckerType: 'OTR',
      priority: 'normal',
      notes: ''
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-[calc(100vh-73px)] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Call Screening Room</h1>
          <p className="text-gray-400">
            The AudioRoad Show • Episode 1
          </p>
        </div>

        {/* Demo Controls */}
        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
          <p className="text-blue-400 font-semibold mb-3">🎬 Demo Mode - Click to Simulate</p>
          <div className="flex gap-4">
            <button
              onClick={simulateIncomingCall}
              disabled={callState === 'active'}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded font-semibold transition-colors"
            >
              📞 Simulate Incoming Call
            </button>
            <button
              onClick={() => {
                setCallState('waiting');
                setCallDuration(0);
                setFormData({ name: '', location: '', topic: '', truckerType: 'OTR', priority: 'normal', notes: '' });
              }}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded font-semibold transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {callState === 'waiting' ? (
          <div className="text-center py-16 bg-gray-800 rounded-lg">
            <div className="text-6xl mb-6">☎️</div>
            <h3 className="text-2xl font-bold mb-4">Waiting for incoming calls...</h3>
            <p className="text-gray-400">When a caller clicks "Call Now", you'll see them here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Call Header */}
            <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold">🎙️ Active Call with Caller</h3>
                  <p className="text-green-400">Fill in their information while talking</p>
                </div>
                <div className="text-3xl font-mono font-bold text-green-400">
                  {formatDuration(callDuration)}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`px-6 py-3 rounded-lg font-bold transition-colors ${
                    isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {isMuted ? '🔇 Unmute' : '🔊 Mute'}
                </button>

                <button
                  onClick={() => {
                    setCallState('waiting');
                    setCallDuration(0);
                  }}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors"
                >
                  ✗ End Call
                </button>
              </div>

              {/* Audio Level Indicator */}
              <div className="mt-4">
                <p className="text-xs text-gray-400 mb-2">AUDIO LEVEL</p>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-green-500 transition-all ${isMuted ? 'w-0' : 'w-3/4 animate-pulse'}`}
                  />
                </div>
              </div>
            </div>

            {/* Caller Information Form */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-xl font-bold mb-4">Caller Information</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
                    placeholder="Caller's name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
                    placeholder="City, State"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold mb-2">What do they want to discuss? *</label>
                <textarea
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
                  placeholder="Brief description of topic..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Trucker Type</label>
                  <select
                    value={formData.truckerType}
                    onChange={(e) => setFormData({ ...formData, truckerType: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
                  >
                    <option value="OTR">OTR (Over The Road)</option>
                    <option value="Regional">Regional</option>
                    <option value="Local">Local</option>
                    <option value="Owner-Operator">Owner-Operator</option>
                    <option value="Fleet">Fleet Manager</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold mb-2">Notes for Host</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
                  placeholder="Any additional notes..."
                />
              </div>
            </div>

            {/* Document Upload */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-xl font-bold mb-4">📄 Document Upload (Optional)</h4>
              <p className="text-sm text-gray-400 mb-4">
                If caller has documents to analyze, upload them here
              </p>
              <DocumentUploadWidget
                callerId="demo-caller"
                maxFiles={3}
              />
            </div>

            {/* Add to Queue Button */}
            <button
              onClick={handleAddToQueue}
              disabled={!formData.name || !formData.topic}
              className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-bold text-xl transition-colors"
            >
              ✓ Add to Host Queue
            </button>

            {(!formData.name || !formData.topic) && (
              <p className="text-center text-yellow-400 text-sm">
                Fill in at least Name and Topic to queue the call
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

