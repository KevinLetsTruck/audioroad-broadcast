/**
 * Announcements Page
 * Screeners create AI-enhanced audio announcements for show openers
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Announcements() {
  // Form state
  const [announcementText, setAnnouncementText] = useState('');
  const [category, setCategory] = useState<'product' | 'sale' | 'event' | 'guest' | 'other'>('product');
  const [musicStyle, setMusicStyle] = useState<'upbeat' | 'professional' | 'smooth' | 'none'>('none');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  
  // Voice selection
  const [voices, setVoices] = useState<any[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  
  // Generation states
  const [step, setStep] = useState<'input' | 'preview' | 'generated'>('input');
  const [enhancedScript, setEnhancedScript] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Result state
  const [generatedAudio, setGeneratedAudio] = useState<{
    audioUrl: string;
    title: string;
    duration: number;
    audioAssetId: string;
  } | null>(null);
  
  // Today's announcements
  const [todaysAnnouncements, setTodaysAnnouncements] = useState<any[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

  useEffect(() => {
    loadVoices();
    loadTodaysAnnouncements();
  }, []);

  const loadVoices = async () => {
    try {
      setLoadingVoices(true);
      const response = await fetch('/api/voices');
      const data = await response.json();
      setVoices(data.voices || []);
      if (data.voices?.length > 0) {
        setSelectedVoiceId(data.voices[0].voiceId);
      }
    } catch (error) {
      console.error('Error loading voices:', error);
    } finally {
      setLoadingVoices(false);
    }
  };

  const loadTodaysAnnouncements = async () => {
    try {
      setLoadingAnnouncements(true);
      const response = await fetch('/api/announcements/today');
      const data = await response.json();
      setTodaysAnnouncements(data.announcements || []);
    } catch (error) {
      console.error('Error loading announcements:', error);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const handleEnhanceScript = async () => {
    if (!announcementText.trim()) {
      alert('Please enter announcement text first');
      return;
    }

    setEnhancing(true);
    try {
      const response = await fetch('/api/announcements/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: announcementText,
          category
        })
      });

      const data = await response.json();
      setEnhancedScript(data.enhanced);
      setStep('preview');
      console.log('✅ Script enhanced');
    } catch (error) {
      console.error('Error enhancing script:', error);
      alert('Failed to enhance script. Please try again.');
    } finally {
      setEnhancing(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!enhancedScript.trim()) {
      alert('No script to generate');
      return;
    }

    setGenerating(true);
    try {
      console.log('🎤 Generating announcement audio...');
      const response = await fetch('/api/announcements/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: announcementText,
          category,
          voiceId: selectedVoiceId,
          musicStyle
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate announcement');
      }

      const data = await response.json();
      
      setGeneratedAudio({
        audioUrl: data.audioUrl,
        title: data.title,
        duration: data.duration,
        audioAssetId: data.audioAssetId
      });
      
      setStep('generated');
      
      // Refresh today's announcements list
      loadTodaysAnnouncements();
      
      console.log('✅ Announcement generated successfully');
      
      // Auto-play the generated audio
      const audio = new Audio(data.audioUrl);
      audio.play().catch(e => console.warn('Auto-play blocked:', e));
      
    } catch (error) {
      console.error('Error generating audio:', error);
      alert('Failed to generate announcement. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleStartNew = () => {
    setStep('input');
    setAnnouncementText('');
    setEnhancedScript('');
    setGeneratedAudio(null);
    setCategory('product');
    setMusicStyle('professional');
  };

  const getCategoryInfo = () => {
    const categories = {
      product: { icon: '📦', label: 'Product', color: 'blue' },
      sale: { icon: '💰', label: 'Sale', color: 'green' },
      event: { icon: '📅', label: 'Event', color: 'purple' },
      guest: { icon: '🎤', label: 'Guest', color: 'pink' },
      other: { icon: '📢', label: 'Other', color: 'gray' }
    };
    return categories[category];
  };

  const getMusicStyleInfo = () => {
    const styles = {
      upbeat: { icon: '⚡', label: 'Upbeat', desc: 'Energetic' },
      professional: { icon: '💼', label: 'Professional', desc: 'Clean' },
      smooth: { icon: '✨', label: 'Smooth', desc: 'Warm' },
      none: { icon: '🎙️', label: 'No Music', desc: 'Voice only' }
    };
    return styles[musicStyle];
  };

  const charCount = announcementText.length;
  const maxChars = 500;
  const wordCount = announcementText.trim().split(/\s+/).length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">📢 Announcements Generator</h1>
            <Link
              to="/screening-room"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              ← Back to Screening Room
            </Link>
          </div>
          <p className="text-gray-400">
            Create professional audio announcements with AI - Perfect for show openers!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Creation Form */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg p-6">
              
              {/* Step 1: Input */}
              {step === 'input' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-4">Step 1: Enter Your Announcement</h2>
                    
                    {/* Category Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">Category</label>
                      <div className="grid grid-cols-5 gap-2">
                        {(['product', 'sale', 'event', 'guest', 'other'] as const).map((cat) => {
                          const info = { product: { icon: '📦', label: 'Product' }, sale: { icon: '💰', label: 'Sale' }, event: { icon: '📅', label: 'Event' }, guest: { icon: '🎤', label: 'Guest' }, other: { icon: '📢', label: 'Other' } }[cat];
                          return (
                            <button
                              key={cat}
                              onClick={() => setCategory(cat)}
                              className={`p-3 rounded-lg border-2 transition-colors ${
                                category === cat
                                  ? 'border-blue-500 bg-blue-900/30'
                                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                              }`}
                            >
                              <div className="text-2xl mb-1">{info.icon}</div>
                              <div className="text-xs">{info.label}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Text Input */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">
                        Announcement Text
                        <span className="text-gray-400 ml-2">
                          ({charCount}/{maxChars} chars, ~{wordCount} words)
                        </span>
                      </label>
                      <textarea
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value.slice(0, maxChars))}
                        placeholder={`Enter your announcement... (e.g., "We have a huge sale on protein powder this week - 30% off all flavors through Friday")`}
                        className="w-full h-32 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Keep it brief! AI will expand this into a professional {getCategoryInfo().label.toLowerCase()} announcement.
                      </p>
                    </div>

                    {/* Voice Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">🎙️ Voice</label>
                      {loadingVoices ? (
                        <p className="text-gray-400">Loading voices...</p>
                      ) : (
                        <select
                          value={selectedVoiceId}
                          onChange={(e) => setSelectedVoiceId(e.target.value)}
                          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                        >
                          {voices.length === 0 ? (
                            <option value="">No voices available</option>
                          ) : (
                            voices.map(voice => (
                              <option key={voice.voiceId} value={voice.voiceId}>
                                {voice.name} {voice.category ? `- ${voice.category}` : ''}
                              </option>
                            ))
                          )}
                        </select>
                      )}
                    </div>

                    {/* Music Style Selection - HIDDEN (voice-only for now) */}
                    <input type="hidden" value={musicStyle} />

                    {/* Generate Button */}
                    <button
                      onClick={handleEnhanceScript}
                      disabled={!announcementText.trim() || enhancing || !selectedVoiceId}
                      className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
                    >
                      {enhancing ? '⏳ AI is enhancing your script...' : '✨ Enhance with AI & Preview'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Preview Enhanced Script */}
              {step === 'preview' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-4">Step 2: Review AI-Enhanced Script</h2>
                    
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Original Text:
                      </label>
                      <p className="text-gray-300 italic">"{announcementText}"</p>
                    </div>

                    <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-4">
                      <label className="block text-sm font-medium text-blue-400 mb-2">
                        AI-Enhanced Script:
                      </label>
                      <textarea
                        value={enhancedScript}
                        onChange={(e) => setEnhancedScript(e.target.value)}
                        className="w-full h-32 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                      />
                      <p className="text-xs text-gray-400 mt-2">
                        You can edit this script before generating audio
                      </p>
                    </div>

                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Category:</span>{' '}
                          <span className="font-semibold">{getCategoryInfo().icon} {getCategoryInfo().label}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Music:</span>{' '}
                          <span className="font-semibold">{getMusicStyleInfo().icon} {getMusicStyleInfo().label}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Voice:</span>{' '}
                          <span className="font-semibold">
                            {voices.find(v => v.voiceId === selectedVoiceId)?.name || 'Default'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Est. Duration:</span>{' '}
                          <span className="font-semibold">~{Math.ceil(enhancedScript.split(' ').length / 2.5)} seconds</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('input')}
                      className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
                    >
                      ← Back to Edit
                    </button>
                    <button
                      onClick={handleGenerateAudio}
                      disabled={generating || !enhancedScript.trim()}
                      className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
                    >
                      {generating ? '⏳ Generating Audio...' : '🎤 Generate Audio'}
                    </button>
                  </div>

                  {generating && (
                    <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
                      <p className="text-sm text-yellow-200">
                        ⏳ Generating your announcement... This takes 10-15 seconds.
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        AI is creating voice audio and mixing with music...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Generated Audio */}
              {step === 'generated' && generatedAudio && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-4">✅ Announcement Ready!</h2>
                    
                    <div className="bg-green-900/30 border border-green-500 rounded-lg p-6 mb-4">
                      <h3 className="text-lg font-bold mb-3">{generatedAudio.title}</h3>
                      
                      <audio 
                        src={generatedAudio.audioUrl} 
                        controls 
                        className="w-full mb-4"
                        autoPlay
                      />
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Duration:</span>{' '}
                          <span className="font-semibold">~{generatedAudio.duration} seconds</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Status:</span>{' '}
                          <span className="font-semibold text-green-400">✅ Saved Globally</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
                      <p className="text-sm font-semibold mb-2">Script Used:</p>
                      <p className="text-gray-300 italic text-sm">"{enhancedScript}"</p>
                    </div>

                    <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4">
                      <p className="text-sm font-semibold mb-2">✅ What Happens Next:</p>
                      <ul className="text-sm text-gray-300 space-y-1">
                        <li>• This announcement is now available globally (all shows can use it)</li>
                        <li>• Appears in host's "Today's Announcements" section</li>
                        <li>• Can be auto-played at show start (if host enables)</li>
                        <li>• Also available in soundboard for manual play</li>
                      </ul>
                    </div>
                  </div>

                  <button
                    onClick={handleStartNew}
                    className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition-colors"
                  >
                    ➕ Create Another Announcement
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* Right: Today's Announcements List */}
          <div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4">📋 Today's Announcements</h3>
              
              {loadingAnnouncements ? (
                <p className="text-gray-400 text-sm">Loading...</p>
              ) : todaysAnnouncements.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">No announcements yet</p>
                  <p className="text-gray-500 text-xs mt-2">Create one to get started!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todaysAnnouncements.map((announcement) => (
                    <div 
                      key={announcement.id}
                      className="bg-gray-900 border border-gray-700 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="text-sm font-semibold mb-1">{announcement.name}</p>
                          <p className="text-xs text-gray-400">~{announcement.duration}s</p>
                        </div>
                        <div className="text-lg">
                          {announcement.tags?.includes('music-upbeat') && '⚡'}
                          {announcement.tags?.includes('music-professional') && '💼'}
                          {announcement.tags?.includes('music-smooth') && '✨'}
                          {announcement.tags?.includes('voice-only') && '🎙️'}
                        </div>
                      </div>
                      
                      <audio 
                        src={announcement.fileUrl} 
                        controls 
                        className="w-full"
                        style={{ height: '32px' }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {todaysAnnouncements.length > 0 && (
                <div className="mt-4 p-3 bg-blue-900/30 border border-blue-500 rounded-lg">
                  <p className="text-xs text-blue-200">
                    💡 The host can auto-play these at show start or play them manually during the show
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

