import { useState, useEffect } from 'react';

interface Call {
  id: string;
  caller: {
    name: string;
    location: string;
    phoneNumber: string;
  };
  topic: string;
  status: 'screening' | 'ready';
  screenerNotes?: string;
  hasDocuments?: boolean;
  documentAnalyzed?: boolean;
  priority?: 'normal' | 'high' | 'urgent';
}

interface CallQueueMockProps {
  onSelectCaller?: (call: Call) => void;
  onTakeCall?: (call: Call) => void;
}

interface CallQueueMockProps {
  onSelectCaller?: (call: Call) => void;
  onTakeCall?: (call: Call) => void;
  episodeId?: string;
}

export default function CallQueueMock({ onSelectCaller, onTakeCall, episodeId }: CallQueueMockProps) {
  const [calls, setCalls] = useState<Call[]>([]);

  // Fetch real approved calls from database
  useEffect(() => {
    if (!episodeId) {
      console.log('⚠️ No episodeId provided to CallQueue');
      return;
    }

    fetchApprovedCalls();
    
    // Poll every 5 seconds
    const interval = setInterval(fetchApprovedCalls, 5000);
    return () => clearInterval(interval);
  }, [episodeId]);

  const fetchApprovedCalls = async () => {
    if (!episodeId) return;
    
    try {
      const response = await fetch(`/api/calls?episodeId=${episodeId}&status=approved`);
      const dbCalls = await response.json();
      
      // Map database calls to component format
      const formattedCalls: Call[] = dbCalls.map((call: any) => ({
        id: call.id,
        caller: {
          name: call.caller?.name || 'Unknown Caller',
          location: call.caller?.location || 'Location not provided',
          phoneNumber: call.caller?.phoneNumber || ''
        },
        topic: call.topic || 'No topic provided',
        status: 'ready', // All approved calls are ready for host
        screenerNotes: call.screenerNotes,
        hasDocuments: false, // TODO: Check if caller has documents
        priority: call.priority || 'normal'
      }));
      
      setCalls(formattedCalls);
      console.log('📋 Loaded', formattedCalls.length, 'approved calls for host queue');
    } catch (error) {
      console.error('Error fetching approved calls:', error);
    }
  };

  const takeCall = (call: Call) => {
    // Remove from queue
    setCalls(calls.filter(c => c.id !== call.id));
    if (onTakeCall) onTakeCall(call);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">
          Call Queue ({calls.filter(c => c.status === 'ready').length} Ready)
        </h3>
        {calls.some(c => c.status === 'screening') && (
          <span className="text-xs text-yellow-400 animate-pulse">
            🔍 Screening in progress...
          </span>
        )}
      </div>

      {calls.length === 0 ? (
        <p className="text-gray-400 text-center py-8 text-sm">No calls in queue</p>
      ) : (
        <div className="space-y-3">
          {calls.map(call => (
            <div
              key={call.id}
              className={`p-4 rounded-lg border transition-all cursor-pointer ${
                call.status === 'screening'
                  ? 'bg-yellow-900/20 border-yellow-700'
                  : 'bg-gray-800 border-gray-700 hover:border-primary-500'
              }`}
              onClick={() => onSelectCaller && onSelectCaller(call)}
            >
              {/* Status Badge */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-lg">{call.caller.name}</h4>
                    
                    {/* Document Indicator */}
                    {call.hasDocuments && (
                      <span title="Has documents">
                        {call.documentAnalyzed ? (
                          <span className="text-green-400" title="Analysis ready">📄✓</span>
                        ) : (
                          <span className="text-yellow-400 animate-pulse" title="Analyzing...">📄🤖</span>
                        )}
                      </span>
                    )}
                    
                    {/* Priority Badge */}
                    {call.priority === 'high' && (
                      <span className="px-2 py-1 bg-orange-600 rounded text-xs">HIGH</span>
                    )}
                    {call.priority === 'urgent' && (
                      <span className="px-2 py-1 bg-red-600 rounded text-xs animate-pulse">URGENT</span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-400">{call.caller.location}</p>
                </div>

                {/* Status Badge */}
                {call.status === 'screening' ? (
                  <span className="flex items-center gap-2 px-3 py-1 bg-yellow-600 rounded-full text-xs whitespace-nowrap">
                    <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
                    Screening Now
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-green-600 rounded-full text-xs whitespace-nowrap">
                    ✓ Ready
                  </span>
                )}
              </div>

              {/* Topic */}
              <p className="text-sm text-gray-300 mb-2 line-clamp-2">{call.topic}</p>

              {/* Screener Notes */}
              {call.screenerNotes && (
                <p className="text-xs text-gray-500 italic mb-3">
                  Screener: {call.screenerNotes}
                </p>
              )}

              {/* Document Analysis Preview */}
              {call.hasDocuments && call.documentAnalyzed && (
                <div className="bg-gray-900 p-3 rounded mb-3 text-xs">
                  <p className="text-primary-400 font-semibold mb-1">📄 Document Analysis Ready</p>
                  <p className="text-gray-400">Click to view AI analysis and key findings</p>
                </div>
              )}

              {/* Actions */}
              {call.status === 'ready' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    takeCall(call);
                  }}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold transition-colors"
                >
                  Take Call On-Air
                </button>
              )}

              {call.status === 'screening' && (
                <div className="text-center py-2 text-xs text-yellow-400">
                  Screener is gathering information...
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Demo Call Button */}
      <button
        onClick={() => {
          const newCall: Call = {
            id: Date.now().toString(),
            caller: {
              name: `Caller ${calls.length + 1}`,
              location: 'Demo, USA',
              phoneNumber: '+1 555-0000'
            },
            topic: 'Demo topic for testing',
            status: 'ready',
            hasDocuments: false,
            priority: 'normal'
          };
          setCalls([...calls, newCall]);
        }}
        className="w-full mt-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-semibold transition-colors"
      >
        + Add Demo Call
      </button>
    </div>
  );
}

