import { useState, useEffect, useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';

interface UseTwilioCallOptions {
  identity: string;
  onCallConnected?: () => void;
  onCallDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export function useTwilioCall({ identity, onCallConnected, onCallDisconnected, onError }: UseTwilioCallOptions) {
  const [device, setDevice] = useState<Device | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const durationIntervalRef = useRef<NodeJS.Timeout>();

  // Initialize Twilio Device
  useEffect(() => {
    let twilioDevice: Device;

    const initDevice = async () => {
      try {
        // Get Twilio token from backend
        const response = await fetch('/api/twilio/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Failed to get token' }));
          throw new Error(error.error || 'Failed to get Twilio token');
        }

        const { token } = await response.json();

        // Create and register device
        twilioDevice = new Device(token, {
          enableImprovedSignalingErrorPrecision: true,
          logLevel: 'error' // Change from 'warn' to 'error' to reduce console spam
        });

        twilioDevice.on('registered', () => {
          console.log('Twilio Device ready');
          setIsReady(true);
        });

        twilioDevice.on('error', (error) => {
          console.error('Twilio Device error:', error);
          // Set ready to true even with errors so button doesn't stay stuck
          setIsReady(true);
          if (onError) onError(error);
        });

        twilioDevice.on('incoming', (incomingCall) => {
          console.log('Incoming call received');
          setCall(incomingCall);
          setupCallHandlers(incomingCall);
        });

        await twilioDevice.register();
        setDevice(twilioDevice);
      } catch (error) {
        console.error('Failed to initialize Twilio Device:', error);
        // Set ready to true even with errors so button doesn't stay stuck
        setIsReady(true);
        if (onError) onError(error as Error);
      }
    };

    initDevice();

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      // Properly destroy device on cleanup - check state first
      if (twilioDevice) {
        const state = twilioDevice.state;
        console.log('🧹 Cleaning up Twilio Device, current state:', state);
        
        try {
          if (state === 'registered' || state === 'registering') {
            twilioDevice.unregister();
          }
          if (state !== 'destroyed') {
            twilioDevice.destroy();
          }
        } catch (error) {
          console.log('⚠️ Error during device cleanup:', error);
          // Ignore cleanup errors
        }
      }
    };
  }, [identity]);

  const setupCallHandlers = (activeCall: Call) => {
    activeCall.on('accept', () => {
      console.log('✅ Call accepted - connected!');
      setIsConnected(true);
      setIsConnecting(false);
      
      // Start call duration timer
      setCallDuration(0);
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      if (onCallConnected) onCallConnected();
    });

    activeCall.on('ringing', () => {
      console.log('📞 Call is ringing...');
      setIsConnecting(true);
    });

    activeCall.on('disconnect', () => {
      console.log('📴 Call disconnected');
      
      // Full cleanup
      setIsConnected(false);
      setIsConnecting(false);
      setCall(null);
      setCallDuration(0);
      setIsMuted(false);
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = undefined;
      }

      if (onCallDisconnected) onCallDisconnected();
    });

    activeCall.on('error', (error) => {
      console.error('❌ Call error:', error);
      
      // Full cleanup on error
      setIsConnected(false);
      setIsConnecting(false);
      setCallDuration(0);
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      
      if (onError) onError(error);
    });

    activeCall.on('reconnecting', (error) => {
      console.log('🔄 Call reconnecting...', error);
      setIsConnecting(true);
    });

    activeCall.on('reconnected', () => {
      console.log('✅ Call reconnected!');
      setIsConnecting(false);
      setIsConnected(true);
    });
  };

  const makeCall = async (params: Record<string, string> = {}, retryCount = 0) => {
    if (!device || !isReady) {
      console.error('Device not ready');
      return;
    }

    setIsConnecting(true);
    console.log('🔌 Initiating web call with params:', params);

    try {
      const outgoingCall = await device.connect({ params });
      console.log('📞 Call connection initiated');
      setCall(outgoingCall);
      setupCallHandlers(outgoingCall);
    } catch (error) {
      console.error('❌ Failed to make call:', error);
      
      // Retry logic - up to 3 attempts
      if (retryCount < 3) {
        console.log(`🔄 Retrying call... Attempt ${retryCount + 1}/3`);
        setTimeout(() => {
          makeCall(params, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
      } else {
        setIsConnecting(false);
        if (onError) onError(error as Error);
        alert('Failed to connect after 3 attempts. Please try again later.');
      }
    }
  };

  const answerCall = () => {
    if (call) {
      call.accept();
    }
  };

  const hangUp = () => {
    if (call) {
      call.disconnect();
    }
  };

  const toggleMute = () => {
    if (call) {
      const newMutedState = !isMuted;
      call.mute(newMutedState);
      setIsMuted(newMutedState);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    device,
    call,
    isReady,
    isConnecting,
    isConnected,
    isMuted,
    callDuration,
    formattedDuration: formatDuration(callDuration),
    makeCall,
    answerCall,
    hangUp,
    toggleMute
  };
}

