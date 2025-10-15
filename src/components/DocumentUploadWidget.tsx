import { useState, useRef } from 'react';

interface DocumentUploadWidgetProps {
  callerId?: string;
  callId?: string;
  onUploadComplete?: (documents: any[]) => void;
  maxFiles?: number;
}

export default function DocumentUploadWidget({ 
  callerId, 
  callId, 
  onUploadComplete,
  maxFiles = 5 
}: DocumentUploadWidgetProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [documentTypes, setDocumentTypes] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documentTypeOptions = [
    { value: 'medical_lab', label: 'Medical Labs' },
    { value: 'blood_work', label: 'Blood Work' },
    { value: 'cgm_data', label: 'CGM Data' },
    { value: 'oil_analysis', label: 'Oil Analysis' },
    { value: 'other', label: 'Other' }
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/json', 'text/csv'];
      return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024; // 10MB limit
    });

    if (files.length + validFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const newFilesArray = [...files, ...validFiles];
    setFiles(newFilesArray);

    // Set default document type for new files
    const newTypes = { ...documentTypes };
    validFiles.forEach(file => {
      if (!newTypes[file.name]) {
        newTypes[file.name] = 'other';
      }
    });
    setDocumentTypes(newTypes);
  };

  const removeFile = (fileName: string) => {
    setFiles(files.filter(f => f.name !== fileName));
    const newTypes = { ...documentTypes };
    delete newTypes[fileName];
    setDocumentTypes(newTypes);
  };

  const setDocumentType = (fileName: string, type: string) => {
    setDocumentTypes({
      ...documentTypes,
      [fileName]: type
    });
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const uploaded: any[] = [];

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', documentTypes[file.name] || 'other');
        if (callerId) formData.append('callerId', callerId);
        if (callId) formData.append('callId', callId);

        const response = await fetch('/api/analysis/document', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const doc = await response.json();
          uploaded.push(doc);
        } else {
          console.error('Failed to upload:', file.name);
        }
      }

      setUploadedDocs([...uploadedDocs, ...uploaded]);
      setFiles([]);
      setDocumentTypes({});

      if (onUploadComplete) {
        onUploadComplete(uploaded);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload some files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-500/10'
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-3">
          <div className="text-5xl">📄</div>
          <p className="text-lg font-semibold">
            Drop documents here or click to browse
          </p>
          <p className="text-sm text-gray-400">
            PDF, JPG, PNG, JSON, CSV (Max 10MB each)
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded font-semibold transition-colors"
          >
            Browse Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.json,.csv"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      </div>

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold">Selected Files ({files.length})</h4>
          {files.map(file => (
            <div
              key={file.name}
              className="bg-gray-800 p-4 rounded-lg flex items-center justify-between"
            >
              <div className="flex-1">
                <p className="font-semibold">{file.name}</p>
                <p className="text-sm text-gray-400">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={documentTypes[file.name] || 'other'}
                  onChange={(e) => setDocumentType(file.name, e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-primary-500"
                >
                  {documentTypeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => removeFile(file.name)}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-semibold transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={uploadFiles}
            disabled={uploading}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 rounded font-semibold text-lg transition-colors"
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} Document${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedDocs.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-green-400">
            ✓ Uploaded Documents ({uploadedDocs.length})
          </h4>
          {uploadedDocs.map(doc => (
            <div
              key={doc.id}
              className="bg-green-900/20 border border-green-700 p-4 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{doc.fileName}</p>
                  <p className="text-sm text-gray-400">
                    {doc.documentType.replace('_', ' ')} • Uploaded {new Date(doc.uploadedAt).toLocaleTimeString()}
                  </p>
                </div>
                {doc.analyzed ? (
                  <span className="px-3 py-1 bg-green-600 rounded text-sm">
                    ✓ Analyzed
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-600 rounded text-sm animate-pulse">
                    🤖 Analyzing...
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

