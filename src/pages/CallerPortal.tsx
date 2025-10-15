import { useState } from 'react';

export default function CallerPortal() {
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    location: '',
    truckerType: 'OTR',
    topic: '',
    document: null as File | null
  });

  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      // Upload document if provided
      let documentUrl = null;
      if (formData.document) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', formData.document);
        formDataUpload.append('documentType', 'other');
        
        // Create/get caller first
        const callerResponse = await fetch('/api/callers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            phoneNumber: formData.phoneNumber,
            email: formData.email,
            location: formData.location,
            truckerType: formData.truckerType
          })
        });
        const caller = await callerResponse.json();
        
        formDataUpload.append('callerId', caller.id);

        const uploadResponse = await fetch('/api/analysis/document', {
          method: 'POST',
          body: formDataUpload
        });
        const document = await uploadResponse.json();
        documentUrl = document.fileUrl;
      }

      // Show success message
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting call request:', error);
      alert('Failed to submit. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-73px)] flex items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-gray-800 rounded-lg p-12 text-center">
          <div className="text-6xl mb-6">📞</div>
          <h1 className="text-3xl font-bold mb-4">Thank You!</h1>
          <p className="text-xl text-gray-300 mb-8">
            Your call request has been submitted successfully.
          </p>
          <div className="bg-gray-900 p-6 rounded-lg mb-8">
            <p className="text-lg font-semibold mb-2">Next Steps:</p>
            <ol className="text-left space-y-2 text-gray-300">
              <li>1. Call the show hotline: <span className="font-bold text-primary-400">(555) 123-4567</span></li>
              <li>2. Our call screener will review your topic</li>
              <li>3. If approved, you'll be put on hold with music</li>
              <li>4. The host will bring you on air!</li>
            </ol>
          </div>
          <button
            onClick={() => {
              setSubmitted(false);
              setFormData({
                name: '',
                phoneNumber: '',
                email: '',
                location: '',
                truckerType: 'OTR',
                topic: '',
                document: null
              });
            }}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded font-semibold"
          >
            Submit Another Call
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-73px)] p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Call In to AudioRoad Network</h1>
          <p className="text-xl text-gray-400">
            Submit your information and topic below, then call our hotline
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Your Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
              placeholder="John Doe"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Phone Number *</label>
              <input
                type="tel"
                required
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Email (optional)</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
                placeholder="City, State"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Trucker Type</label>
              <select
                value={formData.truckerType}
                onChange={(e) => setFormData({ ...formData, truckerType: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
              >
                <option value="OTR">OTR (Over The Road)</option>
                <option value="Regional">Regional</option>
                <option value="Local">Local</option>
                <option value="Owner-Operator">Owner-Operator</option>
                <option value="Fleet">Fleet Manager</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">What would you like to discuss? *</label>
            <textarea
              required
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
              placeholder="Tell us what you'd like to talk about on the show..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Upload Document (for Wednesday Health Show)
            </label>
            <p className="text-sm text-gray-400 mb-2">
              Lab results, blood work, CGM data, or oil analysis reports
            </p>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => setFormData({ ...formData, document: e.target.files?.[0] || null })}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
            />
            {formData.document && (
              <p className="text-sm text-green-400 mt-2">
                ✓ File selected: {formData.document.name}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 rounded font-semibold text-lg transition-colors"
          >
            {uploading ? 'Submitting...' : 'Submit & Call Hotline'}
          </button>

          <p className="text-center text-sm text-gray-400">
            After submitting, call <span className="font-bold text-primary-400">(555) 123-4567</span> to get on air
          </p>
        </form>
      </div>
    </div>
  );
}

