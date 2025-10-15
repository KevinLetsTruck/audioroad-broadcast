interface CallerInfoProps {
  caller: any;
  hasDocuments?: boolean;
  documentAnalysis?: any;
}

export default function CallerInfo({ caller, hasDocuments, documentAnalysis }: CallerInfoProps) {
  if (!caller) return null;

  return (
    <div className="space-y-6">
      {/* Basic Info - Clean and Simple */}
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-400 uppercase tracking-wide mb-1">Name</p>
          <p className="text-3xl font-bold">{caller.name || 'Unknown'}</p>
        </div>

        {caller.location && (
          <div>
            <p className="text-sm text-gray-400 uppercase tracking-wide mb-1">Location</p>
            <p className="text-xl">{caller.location}</p>
          </div>
        )}

        {/* Topic - Most Important */}
        {caller.topic && (
          <div className="pt-4 border-t-2 border-gray-700">
            <p className="text-sm text-gray-400 uppercase tracking-wide mb-2">What They Want to Discuss</p>
            <p className="text-lg text-gray-200 leading-relaxed">{caller.topic}</p>
          </div>
        )}
      </div>

      {/* Document Analysis - Below Basic Info */}
      {hasDocuments && documentAnalysis && (
          <div className="pt-3 border-t border-gray-700">
            <div className="bg-gradient-to-r from-primary-900/30 to-purple-900/30 border border-primary-700 p-4 rounded-lg">
              <h4 className="font-bold text-primary-400 mb-3 flex items-center gap-2">
                <span>📄</span>
                <span>AI Document Analysis</span>
                <span className="text-xs px-2 py-1 bg-green-900 text-green-400 rounded">
                  {documentAnalysis.confidence}% Confident
                </span>
              </h4>

            {/* Quick Summary */}
            <div className="mb-5 bg-gray-900/50 p-4 rounded-lg">
              <p className="text-sm text-gray-300 uppercase tracking-wide mb-2 font-semibold">Summary</p>
              <p className="text-base text-gray-100 leading-relaxed">{documentAnalysis.summary}</p>
            </div>

            {/* Key Findings */}
            {documentAnalysis.keyFindings && documentAnalysis.keyFindings.length > 0 && (
              <div className="mb-5">
                <p className="text-sm text-orange-300 uppercase tracking-wide mb-3 font-semibold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Key Findings</span>
                </p>
                <ul className="space-y-3">
                  {documentAnalysis.keyFindings.map((finding: string, idx: number) => (
                    <li key={idx} className="text-base text-gray-200 flex items-start gap-3 bg-orange-900/20 p-3 rounded">
                      <span className="text-orange-400 font-bold text-xl">•</span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Talking Points */}
            {documentAnalysis.recommendations && documentAnalysis.recommendations.length > 0 && (
              <div>
                <p className="text-sm text-green-300 uppercase tracking-wide mb-3 font-semibold flex items-center gap-2">
                  <span>💡</span>
                  <span>Talking Points</span>
                </p>
                <ul className="space-y-3">
                  {documentAnalysis.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="text-base text-gray-200 flex items-start gap-3 bg-green-900/20 p-3 rounded">
                      <span className="text-green-400 font-bold text-xl">→</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

