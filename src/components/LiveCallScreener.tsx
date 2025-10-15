import { useState } from 'react';
import { useTwilioCall } from '../hooks/useTwilioCall';
import DocumentUploadWidget from './DocumentUploadWidget';

interface LiveCallScreenerProps {
  episodeId: string;
  onCallQueued: (callData: any) => void;
}

export default function LiveCallScreener({ episodeId, onCallQueued }: LiveCallScreenerProps) {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    topic: '',
    truckerType: 'OTR',
    priority: 'normal',
    notes: ''
  });

  const {
    isConnected,
    isMuted,
    formattedDuration,
    hangUp,
    toggleMute
  } = useTwilioCall({
    identity: `screener-${episodeId}`,
    onCallConnected: () => {
      console.log('Call connected with caller');
    },
    onCallDisconnected: () => {
      // Reset form
      setFormData({
        name: '',
        location: '',
        topic: '',
        truckerType: 'OTR',
        priority: 'normal',
        notes: ''
      });
    }
  });

  const handleAddToQueue = async () => {
    if (!formData.name || !formData.topic) {
      alert('Please fill in at least Name and Topic');
      return;
    }

    try {
      // Create/update caller
      const callerResponse = await fetch('/api/callers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: `screened-${Date.now()}`,
          name: formData.name,
          location: formData.location,
          truckerType: formData.truckerType
        })
      });
      const caller = await callerResponse.json();

      // Create call record
      const callResponse = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          callerId: caller.id,
          twilioCallSid: `call-${Date.now()}`,
          topic: formData.topic,
          screenerNotes: formData.notes,
          priority: formData.priority,
          status: 'approved'
        })
      });
      const call = await callResponse.json();

      // Notify parent
      onCallQueued({ call, caller });

      // End call with screener, caller goes to hold
      hangUp();

      alert('Call added to queue successfully!');
    } catch (error) {
      console.error('Error adding to queue:', error);
      alert('Failed to add call to queue');
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-6">☎️</div>
        <h3 className="text-2xl font-bold mb-4">Waiting for incoming calls...</h3>
        <p className="text-gray-400">When a caller connects, you'll see them here</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Call Header */}
      <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold">🎙️ Active Call with Caller</h3>
            <p className="text-green-400">Fill in their information while talking</p>
          </div>
          <div className="text-3xl font-mono font-bold text-green-400">
            {formattedDuration}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={toggleMute}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {isMuted ? '🔇 Unmute' : '🔊 Mute'}
          </button>

          <button
            onClick={hangUp}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors"
          >
            ✗ End Call
          </button>
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
          callerId={formData.name ? `temp-${formData.name}` : undefined}
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
    </div>
  );
}

