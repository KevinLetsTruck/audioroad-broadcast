import { useState, useEffect } from 'react';

export default function ContentDashboard() {
  const [activeTab, setActiveTab] = useState<'commercials' | 'social' | 'library'>('commercials');
  
  // Shopify Products State
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [generatingCommercials, setGeneratingCommercials] = useState(false);
  const [commercialProgress, setCommercialProgress] = useState('');
  
  // Social Content State
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<string>('');
  const [analyzingEpisode, setAnalyzingEpisode] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [generatingContent, setGeneratingContent] = useState(false);
  
  // Content Library State
  const [pendingClips, setPendingClips] = useState<any[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);
  
  // Generated Commercials State
  const [generatedCommercials, setGeneratedCommercials] = useState<any[]>([]);

  // Load initial data
  useEffect(() => {
    loadEpisodes();
    loadPendingClips();
    loadGeneratedCommercials();
  }, []);

  const loadEpisodes = async () => {
    try {
      const response = await fetch('/api/episodes?status=completed');
      const data = await response.json();
      setEpisodes(data.slice(0, 20)); // Last 20 episodes
    } catch (error) {
      console.error('Error loading episodes:', error);
    }
  };

  const loadPendingClips = async () => {
    try {
      setLoadingClips(true);
      const response = await fetch('/api/content/pending');
      const data = await response.json();
      setPendingClips(data.clips || []);
    } catch (error) {
      console.error('Error loading clips:', error);
    } finally {
      setLoadingClips(false);
    }
  };

  // COMMERCIALS TAB FUNCTIONS
  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const response = await fetch('/api/commercials/products');
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Failed to load products from Shopify');
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadGeneratedCommercials = async () => {
    try {
      const response = await fetch('/api/commercials/list');
      const data = await response.json();
      setGeneratedCommercials(data.commercials || []);
    } catch (error) {
      console.error('Error loading commercials:', error);
    }
  };

  const generateCommercials = async () => {
    if (confirm(`Generate commercials for ${selectedProducts.size || 'top 10'} products?\n\nThis will take 2-3 minutes per commercial.`)) {
      try {
        setGeneratingCommercials(true);
        setCommercialProgress('Generating AI scripts and converting to audio...');
        
        const response = await fetch('/api/commercials/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productIds: selectedProducts.size > 0 ? Array.from(selectedProducts) : undefined,
            count: selectedProducts.size || 10
          })
        });
        
        const data = await response.json();
        
        setCommercialProgress(`✅ Generated ${data.generated} commercials!`);
        setSelectedProducts(new Set());
        loadGeneratedCommercials(); // Refresh the list
        
        setTimeout(() => {
          setCommercialProgress('');
          alert(`Success! ${data.generated} commercials generated!\n\nScroll down to see them!`);
        }, 2000);
        
      } catch (error) {
        console.error('Error generating commercials:', error);
        alert('Failed to generate commercials');
      } finally {
        setGeneratingCommercials(false);
      }
    }
  };

  // SOCIAL CONTENT TAB FUNCTIONS
  const analyzeEpisode = async () => {
    if (!selectedEpisode) {
      alert('Please select an episode first');
      return;
    }

    try {
      setAnalyzingEpisode(true);
      const response = await fetch(`/api/content/analyze/${selectedEpisode}`, {
        method: 'POST'
      });
      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      console.error('Error analyzing episode:', error);
      alert('Failed to analyze episode');
    } finally {
      setAnalyzingEpisode(false);
    }
  };

  const generateSocialContent = async () => {
    if (!selectedEpisode) {
      alert('Please select an episode first');
      return;
    }

    if (confirm('Generate social media content for this episode?\n\nThis will create 8-10 clips with AI captions.')) {
      try {
        setGeneratingContent(true);
        const response = await fetch(`/api/content/generate/${selectedEpisode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 8 })
        });
        
        const data = await response.json();
        alert(`✅ Generated ${data.generated} content pieces!\n\nCheck the Content Library tab to review.`);
        setAnalysis(null);
        loadPendingClips(); // Refresh library
      } catch (error) {
        console.error('Error generating content:', error);
        alert('Failed to generate content');
      } finally {
        setGeneratingContent(false);
      }
    }
  };

  // LIBRARY TAB FUNCTIONS
  const approveClip = async (clipId: string) => {
    try {
      await fetch(`/api/content/clips/${clipId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: ['Instagram', 'Facebook', 'YouTube'] })
      });
      
      alert('✅ Clip approved! Ready to post to social media.');
      loadPendingClips(); // Refresh list
    } catch (error) {
      console.error('Error approving clip:', error);
      alert('Failed to approve clip');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🎬 Content Creation Engine</h1>
        <p className="text-gray-400">
          Automate your marketing - Generate commercials and social content with AI
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('commercials')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'commercials'
              ? 'border-green-500 text-green-400'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          🛒 Product Commercials
        </button>
        <button
          onClick={() => setActiveTab('social')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'social'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          📱 Social Content
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'library'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          📚 Content Library ({pendingClips.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto">
        {/* COMMERCIALS TAB */}
        {activeTab === 'commercials' && (
          <div>
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Generate Product Commercials</h2>
              <p className="text-gray-300 mb-6">
                AI will fetch products from your Shopify store, write 30-second radio scripts,
                and convert them to professional voice audio. Commercials are added to your soundboard automatically!
              </p>

              {!products.length && (
                <button
                  onClick={loadProducts}
                  disabled={loadingProducts}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    loadingProducts
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {loadingProducts ? '🔄 Loading Products...' : '🛒 Load Products from Shopify'}
                </button>
              )}

              {products.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-gray-400">
                      {products.length} products found • {selectedProducts.size} selected • {generatedCommercials.length} commercials ready
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setSelectedProducts(new Set())}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                      >
                        Clear Selection
                      </button>
                      <button
                        onClick={loadGeneratedCommercials}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                      >
                        🔄 Refresh Commercials
                      </button>
                      <button
                        onClick={generateCommercials}
                        disabled={generatingCommercials}
                        className={`px-6 py-2 rounded-lg font-semibold ${
                          generatingCommercials
                            ? 'bg-gray-600 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        {generatingCommercials 
                          ? '⏳ Generating...'
                          : `🎬 Generate ${selectedProducts.size || 10} Commercials`
                        }
                      </button>
                    </div>
                  </div>

                  {commercialProgress && (
                    <div className="mb-4 p-4 bg-green-500/10 border border-green-500 rounded-lg">
                      <p className="text-green-400">{commercialProgress}</p>
                    </div>
                  )}

                  {/* Generated Commercials List */}
                  {generatedCommercials.length > 0 && (
                    <div className="mb-6 bg-gray-700 rounded-lg p-6">
                      <h3 className="text-xl font-bold mb-4">🎙️ Generated Commercials ({generatedCommercials.length})</h3>
                      <div className="space-y-3">
                        {generatedCommercials.map(commercial => (
                          <div key={commercial.id} className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{commercial.name}</h4>
                              <p className="text-sm text-gray-400">
                                Duration: {commercial.duration}s • Created: {new Date(commercial.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-3">
                              <audio controls src={commercial.fileUrl} className="h-10">
                                Your browser does not support audio.
                              </audio>
                              <a
                                href={commercial.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                              >
                                ⬇️ Download
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                    {products.slice(0, 50).map(product => (
                      <div
                        key={product.id}
                        onClick={() => {
                          const newSelected = new Set(selectedProducts);
                          if (newSelected.has(product.id)) {
                            newSelected.delete(product.id);
                          } else {
                            newSelected.add(product.id);
                          }
                          setSelectedProducts(newSelected);
                        }}
                        className={`p-4 rounded-lg cursor-pointer transition-colors border-2 ${
                          selectedProducts.has(product.id)
                            ? 'bg-green-500/20 border-green-500'
                            : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                        }`}
                      >
                        {product.images?.[0] && (
                          <img 
                            src={product.images[0].src} 
                            alt={product.title}
                            className="w-full h-32 object-cover rounded mb-2"
                          />
                        )}
                        <h3 className="font-semibold mb-1">{product.title}</h3>
                        <p className="text-green-400 font-bold">${product.price}</p>
                        <p className="text-xs text-gray-400 mt-1">{product.product_type}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">💡 How It Works:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300">
                <li>Load products from your Shopify store (store.letstruck.com)</li>
                <li>Select products or generate for top 10 automatically</li>
                <li>AI writes professional 30-second radio scripts</li>
                <li>ElevenLabs converts to professional voice audio</li>
                <li>Commercials appear in your soundboard - ready to play!</li>
              </ol>
              <p className="text-xs text-gray-500 mt-3">
                Cost: ~$0.10 per commercial • Time: ~2 min per commercial
              </p>
            </div>
          </div>
        )}

        {/* SOCIAL CONTENT TAB */}
        {activeTab === 'social' && (
          <div>
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Generate Social Media Content</h2>
              <p className="text-gray-300 mb-6">
                AI analyzes your show, finds the best moments, and generates ready-to-post social media content
                with captions and hashtags for Instagram, Facebook, YouTube, and TikTok!
              </p>

              {/* Episode Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Select Episode to Analyze:</label>
                <select
                  value={selectedEpisode}
                  onChange={(e) => setSelectedEpisode(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Choose an episode...</option>
                  {episodes.map(ep => (
                    <option key={ep.id} value={ep.id}>
                      {ep.show?.name} - {ep.title} ({new Date(ep.date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={analyzeEpisode}
                  disabled={!selectedEpisode || analyzingEpisode}
                  className={`px-6 py-3 rounded-lg font-semibold flex-1 ${
                    !selectedEpisode || analyzingEpisode
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {analyzingEpisode ? '🔍 Analyzing...' : '🔍 Analyze Show for Content'}
                </button>

                {analysis && (
                  <button
                    onClick={generateSocialContent}
                    disabled={generatingContent}
                    className={`px-6 py-3 rounded-lg font-semibold flex-1 ${
                      generatingContent
                        ? 'bg-gray-600 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {generatingContent ? '⏳ Generating Content...' : '🎬 Generate Social Content'}
                  </button>
                )}
              </div>

              {/* Analysis Results */}
              {analysis && (
                <div className="mt-6 bg-gray-700 rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-4">
                    📊 Analysis Results - {analysis.recommended} High-Potential Clips Found
                  </h3>
                  <div className="space-y-3">
                    {analysis.calls?.map((call: any, idx: number) => (
                      <div key={call.callId} className="bg-gray-800 p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">
                              #{idx + 1} - Score: {call.score}/100
                            </h4>
                            <p className="text-sm text-gray-300">
                              Topics: {call.topics?.join(', ')}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Type: {call.contentType} • Platforms: {call.platforms?.join(', ')}
                            </p>
                          </div>
                          <div className={`px-3 py-1 rounded text-sm font-semibold ${
                            call.socialPotential === 'high' ? 'bg-green-500/20 text-green-400' :
                            call.socialPotential === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {call.socialPotential}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">💡 How It Works:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300">
                <li>Select a completed episode from your show</li>
                <li>AI analyzes all calls and scores them 0-100 for social media potential</li>
                <li>Generate content - AI creates clips with captions for each platform</li>
                <li>Review in Content Library - edit captions if needed</li>
                <li>Post to Instagram, Facebook, YouTube, TikTok!</li>
              </ol>
            </div>
          </div>
        )}

        {/* CONTENT LIBRARY TAB */}
        {activeTab === 'library' && (
          <div>
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">📚 Content Library</h2>
                <button
                  onClick={loadPendingClips}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  🔄 Refresh
                </button>
              </div>

              {loadingClips ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
                  <p className="text-gray-400">Loading content...</p>
                </div>
              ) : pendingClips.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <h3 className="text-xl font-semibold mb-2">No Pending Content</h3>
                  <p className="text-gray-400 mb-4">
                    Generate social content from the "Social Content" tab to see clips here!
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {pendingClips.map(clip => (
                    <div key={clip.id} className="bg-gray-700 rounded-lg p-6">
                      {/* Clip Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold">{clip.title}</h3>
                          <p className="text-sm text-gray-400">
                            {clip.episode?.show?.name} - {new Date(clip.episode?.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded text-sm">
                            {clip.type}
                          </span>
                          <span className="px-3 py-1 bg-gray-600 text-gray-300 rounded text-sm">
                            {clip.duration}s
                          </span>
                        </div>
                      </div>

                      {/* AI Suggestions */}
                      <div className="space-y-4">
                        {/* Instagram */}
                        <div className="bg-gray-800 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">📷</span>
                            <h4 className="font-semibold">Instagram</h4>
                          </div>
                          <p className="text-sm text-gray-300">
                            {clip.aiSuggestions?.instagram || clip.aiCaption}
                          </p>
                        </div>

                        {/* Facebook */}
                        <div className="bg-gray-800 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">👥</span>
                            <h4 className="font-semibold">Facebook</h4>
                          </div>
                          <p className="text-sm text-gray-300">
                            {clip.aiSuggestions?.facebook || clip.aiCaption}
                          </p>
                        </div>

                        {/* YouTube */}
                        <div className="bg-gray-800 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">▶️</span>
                            <h4 className="font-semibold">YouTube</h4>
                          </div>
                          <p className="text-sm text-gray-300">
                            {clip.aiSuggestions?.youtube || clip.title}
                          </p>
                        </div>

                        {/* TikTok */}
                        <div className="bg-gray-800 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">🎵</span>
                            <h4 className="font-semibold">TikTok</h4>
                          </div>
                          <p className="text-sm text-gray-300">
                            {clip.aiSuggestions?.tiktok || clip.aiCaption}
                          </p>
                        </div>

                        {/* Hashtags */}
                        {clip.aiHashtags && clip.aiHashtags.length > 0 && (
                          <div className="bg-gray-800 p-4 rounded-lg">
                            <h4 className="font-semibold mb-2">#️⃣ Hashtags</h4>
                            <div className="flex flex-wrap gap-2">
                              {clip.aiHashtags.map((tag: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-6 flex gap-3">
                        <button
                          onClick={() => approveClip(clip.id)}
                          className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
                        >
                          ✅ Approve & Ready to Post
                        </button>
                        <button
                          className="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

