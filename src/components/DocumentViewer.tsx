import { useState, useEffect } from 'react';

interface DocumentViewerProps {
  callerId: string;
}

export default function DocumentViewer({ callerId }: DocumentViewerProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  useEffect(() => {
    if (callerId) {
      fetchDocuments();
    }
  }, [callerId]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/callers/${callerId}`);
      const caller = await response.json();
      setDocuments(caller.documents || []);
      
      // Auto-select first document if available
      if (caller.documents && caller.documents.length > 0) {
        setSelectedDoc(caller.documents[0]);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="p-4">
        <h3 className="font-semibold mb-4">Documents</h3>
        <p className="text-gray-400 text-sm text-center py-8">
          No documents uploaded
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <h3 className="font-semibold mb-3">Documents ({documents.length})</h3>
        <select
          value={selectedDoc?.id || ''}
          onChange={(e) => {
            const doc = documents.find(d => d.id === e.target.value);
            setSelectedDoc(doc);
          }}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-primary-500"
        >
          {documents.map(doc => (
            <option key={doc.id} value={doc.id}>
              {doc.fileName} - {doc.documentType}
            </option>
          ))}
        </select>
      </div>

      {selectedDoc && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-gray-800 rounded p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">
                Uploaded {new Date(selectedDoc.uploadedAt).toLocaleDateString()}
              </span>
              <a
                href={selectedDoc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                Download
              </a>
            </div>

            {selectedDoc.analyzed && selectedDoc.aiSummary && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-primary-400 uppercase mb-2">
                    🤖 AI Summary {selectedDoc.aiConfidence && `(${selectedDoc.aiConfidence}% confidence)`}
                  </p>
                  <p className="text-sm text-gray-300">{selectedDoc.aiSummary}</p>
                </div>

                {selectedDoc.aiKeyFindings && selectedDoc.aiKeyFindings.length > 0 && (
                  <div>
                    <p className="text-xs text-orange-400 uppercase mb-2">Key Findings</p>
                    <ul className="space-y-2">
                      {selectedDoc.aiKeyFindings.map((finding: string, idx: number) => (
                        <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                          <span className="text-orange-400">•</span>
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedDoc.aiRecommendations && selectedDoc.aiRecommendations.length > 0 && (
                  <div>
                    <p className="text-xs text-green-400 uppercase mb-2">Talking Points</p>
                    <ul className="space-y-2">
                      {selectedDoc.aiRecommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                          <span className="text-green-400">→</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!selectedDoc.analyzed && (
              <p className="text-sm text-gray-400 text-center py-4">
                Document not yet analyzed
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

