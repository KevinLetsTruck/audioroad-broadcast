import { useState, useEffect } from 'react';

export default function Commercials() {
  // Products state
  const [products, setProducts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategory] = useState('all');
  
  // Voices state
  const [voices, setVoices] = useState<any[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  
  // Script preview modal state
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<any>(null);
  const [editedScript, setEditedScript] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  
  // Generated commercials state
  const [commercials, setCommercials] = useState<any[]>([]);
  const [loadingCommercials, setLoadingCommercials] = useState(false);
  
  // Shows state (for assignment)
  const [shows, setShows] = useState<any[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningCommercial, setAssigningCommercial] = useState<any>(null);

  useEffect(() => {
    loadProducts();
    loadVoices();
    loadCommercials();
    loadShows();
  }, []);

  // Filter products based on search and category
  useEffect(() => {
    let filtered = allProducts;
    
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.product_type?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.product_type === categoryFilter);
    }
    
    setProducts(filtered);
  }, [searchQuery, categoryFilter, allProducts]);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const response = await fetch('/api/commercials/products');
      const data = await response.json();
      setAllProducts(data.products || []);
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Failed to load products from Shopify');
    } finally {
      setLoadingProducts(false);
    }
  };

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

  const loadCommercials = async () => {
    try {
      setLoadingCommercials(true);
      const response = await fetch('/api/commercials/list');
      const data = await response.json();
      setCommercials(data.commercials || []);
    } catch (error) {
      console.error('Error loading commercials:', error);
    } finally {
      setLoadingCommercials(false);
    }
  };

  const loadShows = async () => {
    try {
      const response = await fetch('/api/shows');
      const data = await response.json();
      setShows(data);
    } catch (error) {
      console.error('Error loading shows:', error);
    }
  };

  const handlePreviewScript = async (product: any) => {
    setCurrentProduct(product);
    setShowScriptModal(true);
    setGeneratingScript(true);
    setEditedScript('');

    try {
      const response = await fetch('/api/commercials/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id })
      });

      const data = await response.json();
      setEditedScript(data.script);
    } catch (error) {
      console.error('Error generating script:', error);
      alert('Failed to generate script');
      setShowScriptModal(false);
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleGenerateCommercial = async () => {
    if (!editedScript || !currentProduct) return;

    setGeneratingAudio(true);
    try {
      const response = await fetch('/api/commercials/generate-with-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: currentProduct.id,
          script: editedScript,
          voiceId: selectedVoiceId
        })
      });

      if (response.ok) {
        alert(`✅ Commercial generated successfully!\n\n"${currentProduct.title}"\n\nAdded to your library.`);
        setShowScriptModal(false);
        loadCommercials(); // Refresh library
      } else {
        alert('Failed to generate commercial');
      }
    } catch (error) {
      console.error('Error generating commercial:', error);
      alert('Failed to generate commercial');
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handleAssignToShow = async (showId: string, slot: number) => {
    if (!assigningCommercial) return;

    try {
      const response = await fetch(`/api/shows/${showId}/commercials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioAssetId: assigningCommercial.id,
          slot
        })
      });

      if (response.ok) {
        alert(`✅ Commercial assigned to slot ${slot}!`);
        setShowAssignModal(false);
        setAssigningCommercial(null);
      } else {
        alert('Failed to assign commercial');
      }
    } catch (error) {
      console.error('Error assigning commercial:', error);
      alert('Failed to assign commercial');
    }
  };

  const wordCount = editedScript.split(/\s+/).filter(w => w).length;
  const charCount = editedScript.length;
  const estimatedSeconds = Math.round(wordCount / 2.5); // ~2.5 words per second

  // Get unique categories
  const categories = Array.from(new Set(allProducts.map(p => p.product_type).filter(Boolean)));

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">🎬 Commercial Studio</h1>
          <p className="text-gray-400">
            Create professional commercials with AI - Choose products, preview & edit scripts, select voices
          </p>
        </div>

        {/* Search & Filters */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="🔍 Search products by name, description, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-green-500 focus:outline-none"
              />
            </div>
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-green-500 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-3">
            Showing {products.length} of {allProducts.length} products
          </p>
        </div>

        {/* Products Grid */}
        {loadingProducts ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mb-4"></div>
            <p className="text-gray-400">Loading products...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
              {products.map(product => (
                <div
                  key={product.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-green-500 transition-colors"
                >
                  {product.images?.[0] && (
                    <img 
                      src={product.images[0].src} 
                      alt={product.title}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold mb-1 line-clamp-2">{product.title}</h3>
                    <p className="text-green-400 font-bold text-lg mb-2">${product.price}</p>
                    <p className="text-xs text-gray-400 mb-3">{product.product_type}</p>
                    <button
                      onClick={() => handlePreviewScript(product)}
                      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
                    >
                      📝 Preview Script
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {products.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No products found</p>
                <p className="text-gray-500 text-sm mt-2">Try adjusting your search or filter</p>
              </div>
            )}
          </>
        )}

        {/* Generated Commercials Library */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">🎙️ Your Commercial Library ({commercials.length})</h2>
            <button
              onClick={loadCommercials}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              🔄 Refresh
            </button>
          </div>

          {loadingCommercials ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          ) : commercials.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No commercials generated yet</p>
              <p className="text-gray-500 text-sm mt-2">Create your first commercial above!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {commercials.map(commercial => (
                <div key={commercial.id} className="bg-gray-900 p-4 rounded-lg flex items-center gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold">{commercial.name}</h3>
                    <p className="text-sm text-gray-400">
                      Duration: {commercial.duration}s • Created: {new Date(commercial.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <audio controls src={commercial.fileUrl} className="h-10">
                    Your browser does not support audio.
                  </audio>
                  <div className="flex gap-2">
                    <a
                      href={commercial.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm whitespace-nowrap"
                    >
                      ⬇️ Download
                    </a>
                    <button
                      onClick={() => {
                        setAssigningCommercial(commercial);
                        setShowAssignModal(true);
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm whitespace-nowrap"
                    >
                      📺 Assign to Show
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Script Preview Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold">Generate Commercial</h2>
                  <p className="text-gray-400">{currentProduct?.title}</p>
                </div>
                <button
                  onClick={() => setShowScriptModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ✕
                </button>
              </div>

              {generatingScript ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mb-4"></div>
                  <p className="text-gray-400">AI is writing your script...</p>
                </div>
              ) : (
                <>
                  {/* Script Editor */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium">📝 Script (Editable)</label>
                      <span className="text-xs text-gray-400">
                        {wordCount} words • {charCount} chars • ~{estimatedSeconds}s
                      </span>
                    </div>
                    <textarea
                      value={editedScript}
                      onChange={(e) => setEditedScript(e.target.value)}
                      rows={8}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-green-500 focus:outline-none font-mono text-sm"
                      placeholder="Edit your commercial script here..."
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Tip: Aim for 75-85 words for a perfect 30-second commercial
                    </p>
                  </div>

                  {/* Voice Selector */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">🎙️ Select Voice</label>
                    {loadingVoices ? (
                      <p className="text-gray-400">Loading voices...</p>
                    ) : (
                      <div className="space-y-3">
                        <select
                          value={selectedVoiceId}
                          onChange={(e) => setSelectedVoiceId(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-green-500 focus:outline-none"
                        >
                          {voices.map(voice => (
                            <option key={voice.voiceId} value={voice.voiceId}>
                              {voice.name} {voice.category ? `(${voice.category})` : ''}
                            </option>
                          ))}
                        </select>
                        
                        {voices.find(v => v.voiceId === selectedVoiceId)?.previewUrl && (
                          <div className="bg-gray-900 p-3 rounded-lg">
                            <p className="text-xs text-gray-400 mb-2">Preview:</p>
                            <audio 
                              controls 
                              src={voices.find(v => v.voiceId === selectedVoiceId)?.previewUrl}
                              className="w-full h-8"
                            >
                              Your browser does not support audio.
                            </audio>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowScriptModal(false)}
                      className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateCommercial}
                      disabled={generatingAudio || !editedScript}
                      className={`flex-1 px-6 py-3 rounded-lg font-semibold ${
                        generatingAudio || !editedScript
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {generatingAudio ? '⏳ Generating Audio...' : '🎬 Generate Commercial'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign to Show Modal */}
      {showAssignModal && assigningCommercial && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-lg w-full">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold">Assign to Show</h2>
                  <p className="text-gray-400">{assigningCommercial.name}</p>
                </div>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {shows.map(show => (
                  <div key={show.id} className="bg-gray-900 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3" style={{ color: show.color }}>
                      {show.name}
                    </h3>
                    <div className="flex gap-2">
                      {[1, 2, 3].map(slot => (
                        <button
                          key={slot}
                          onClick={() => handleAssignToShow(show.id, slot)}
                          className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                        >
                          Slot {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowAssignModal(false)}
                className="w-full mt-6 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

