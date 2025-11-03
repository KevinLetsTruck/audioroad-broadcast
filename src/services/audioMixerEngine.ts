/**
 * Audio Mixer Engine
 * 
 * Core service for mixing multiple audio sources (mic, callers, soundboard)
 * and outputting to Radio.co stream + local recording.
 * 
 * Chrome-optimized using Web Audio API.
 */

export interface AudioSource {
  id: string;
  type: 'host' | 'caller' | 'soundboard' | 'file';
  label: string;
  stream?: MediaStream;
  gainNode?: GainNode;
  analyserNode?: AnalyserNode;
  sourceNode?: MediaStreamAudioSourceNode | AudioBufferSourceNode;
  volume: number; // 0-100
  muted: boolean;
}

export interface MixerConfig {
  sampleRate: number;
  bitrate: number;
  outputChannels: number;
}

type LevelMeterCallback = (sourceId: string, level: number) => void;

export class AudioMixerEngine {
  private audioContext: AudioContext | null = null;
  private sources: Map<string, AudioSource> = new Map();
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  
  // Host microphone stream (for sharing with Twilio conference)
  private hostMicStream: MediaStream | null = null;
  
  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording = false;
  
  // Monitoring
  private animationFrameId: number | null = null;
  private levelMeterCallback: LevelMeterCallback | null = null;
  
  // Config
  private config: MixerConfig = {
    sampleRate: 48000,
    bitrate: 256,
    outputChannels: 2
  };

  constructor(config?: Partial<MixerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Initialize the audio mixer
   */
  async initialize(): Promise<void> {
    try {
      // Create audio context with optimal settings for Chrome
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate,
        latencyHint: 'interactive'
      });

      // Create master gain node (for master volume control)
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 1.0;

      // Create compressor to prevent clipping
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      // Create master analyser for output VU meter
      this.masterAnalyser = this.audioContext.createAnalyser();
      this.masterAnalyser.fftSize = 2048;
      this.masterAnalyser.smoothingTimeConstant = 0.8;

      // Create destination for output stream
      this.destination = this.audioContext.createMediaStreamDestination();

      // Connect: masterGain -> compressor -> masterAnalyser -> destination (for stream)
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.masterAnalyser);
      this.masterAnalyser.connect(this.destination);
      
      // DON'T connect to speakers - prevents feedback!
      // Host hears callers through Twilio, not through mixer
      // this.masterAnalyser.connect(this.audioContext.destination);

      console.log('🎚️ Audio Mixer initialized (output: stream only, no local playback)');
      
      // Start level monitoring
      this.startLevelMonitoring();
    } catch (error) {
      console.error('Failed to initialize audio mixer:', error);
      throw error;
    }
  }

  /**
   * Connect microphone as a source
   * @param deviceId - Optional specific device ID to use
   */
  async connectMicrophone(deviceId?: string): Promise<string> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    const strategies = [
      {
        constraints: {
          deviceId: deviceId && deviceId !== 'default' ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: this.config.sampleRate,
          channelCount: 1
        }
      },
      {
        constraints: {
          deviceId: deviceId && deviceId !== 'default' ? { ideal: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: this.config.sampleRate },
          channelCount: { ideal: 1 }
        }
      },
      {
        constraints: {
          deviceId: deviceId && deviceId !== 'default' ? { ideal: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      },
      {
        constraints: {
          echoCancellation: true,
          noiseSuppression: true
        }
      }
    ];

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        const cleanConstraints: MediaTrackConstraints = {};
        Object.entries(strategy.constraints).forEach(([key, value]) => {
          if (value !== undefined) {
            cleanConstraints[key as keyof MediaTrackConstraints] = value;
          }
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: cleanConstraints
        });

        // Save host mic stream so it can be shared with Twilio conference
        this.hostMicStream = stream;
        console.log('✅ [MIXER] Host mic stream saved for conference sharing');

        return this.addSource({
          id: 'host-mic',
          type: 'host',
          label: 'Host Microphone',
          stream,
          volume: 80,
          muted: false
        });
      } catch (error: any) {
        lastError = error;
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          throw new Error('Microphone access denied. Please enable microphone permissions.');
        }
        
        if (error.name === 'OverconstrainedError') {
          continue;
        }
        continue;
      }
    }

    throw new Error(
      lastError?.name === 'OverconstrainedError'
        ? 'Could not access microphone with selected device. Please try a different microphone.'
        : 'Microphone access denied. Please enable microphone permissions.'
    );
  }

  /**
   * Add a Twilio call audio stream as a source
   */
  addCallerAudio(callId: string, callerName: string, stream: MediaStream): string {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    const sourceId = `caller-${callId}`;
    return this.addSource({
      id: sourceId,
      type: 'caller',
      label: callerName,
      stream,
      volume: 75,
      muted: false
    });
  }

  /**
   * Add any audio source (generic method)
   */
  private addSource(config: AudioSource): string {
    if (!this.audioContext || !this.masterGain) {
      throw new Error('Audio context not initialized');
    }

    // Remove existing source if it exists
    if (this.sources.has(config.id)) {
      this.removeSource(config.id);
    }

    // Create audio nodes for this source
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = config.muted ? 0 : config.volume / 100;

    const analyserNode = this.audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    analyserNode.smoothingTimeConstant = 0.8;

    // Create source node from stream
    let sourceNode: MediaStreamAudioSourceNode | AudioBufferSourceNode;
    if (config.stream) {
      sourceNode = this.audioContext.createMediaStreamSource(config.stream);
    } else {
      throw new Error('Stream is required for audio source');
    }

    // Connect: source -> gain -> analyser -> master
    sourceNode.connect(gainNode);
    gainNode.connect(analyserNode);
    analyserNode.connect(this.masterGain);

    // Store source
    const source: AudioSource = {
      ...config,
      gainNode,
      analyserNode,
      sourceNode
    };

    this.sources.set(config.id, source);
    console.log(`➕ Added audio source: ${config.label} (${config.id})`);

    return config.id;
  }

  /**
   * Play an audio file through the mixer (for openers, ads, etc.)
   */
  async playAudioFile(url: string): Promise<void> {
    if (!this.audioContext || !this.masterGain) {
      throw new Error('Audio context not initialized');
    }

    console.log('🎵 [MIXER] Loading audio file:', url);

    try {
      // Fetch audio file
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      // Decode audio
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('✅ [MIXER] Audio decoded, duration:', audioBuffer.duration, 'seconds');

      // Create buffer source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Create gain node for this playback
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 1.0; // Full volume

      // Connect: source -> gain -> master
      source.connect(gainNode);
      gainNode.connect(this.masterGain);

      // Play and wait for completion
      return new Promise((resolve) => {
        source.onended = () => {
          console.log('✅ [MIXER] Audio playback completed');
          gainNode.disconnect();
          resolve();
        };

        source.start(0);
        console.log('▶️ [MIXER] Audio playing...');
      });
    } catch (error) {
      console.error('❌ [MIXER] Failed to play audio file:', error);
      throw error;
    }
  }

  /**
   * Remove an audio source
   */
  removeSource(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (!source) return;

    console.log(`🗑️ Removing audio source: ${sourceId} (type: ${source.type})`);

    // Disconnect all nodes
    try {
      source.sourceNode?.disconnect();
      source.gainNode?.disconnect();
      source.analyserNode?.disconnect();

      // Stop stream tracks if it's a MediaStream (e.g., microphone)
      if (source.stream) {
        const tracks = source.stream.getTracks();
        console.log(`🎤 Stopping ${tracks.length} media track(s) for ${sourceId}`);
        tracks.forEach(track => {
          console.log(`  - Stopping ${track.kind} track: ${track.label}`);
          track.stop();
          console.log(`  ✅ Track stopped: readyState = ${track.readyState}`);
        });
      }
    } catch (error) {
      console.warn('Error disconnecting source:', error);
    }

    this.sources.delete(sourceId);
    console.log(`✅ Removed audio source: ${sourceId}`);
  }

  /**
   * Set volume for a specific source (0-100)
   */
  setVolume(sourceId: string, volume: number): void {
    const source = this.sources.get(sourceId);
    if (!source || !source.gainNode) return;

    const clampedVolume = Math.max(0, Math.min(100, volume));
    source.volume = clampedVolume;

    if (!source.muted) {
      source.gainNode.gain.value = clampedVolume / 100;
    }
  }

  /**
   * Set master output volume (0-100)
   */
  setMasterVolume(volume: number): void {
    if (!this.masterGain) return;

    const clampedVolume = Math.max(0, Math.min(100, volume));
    this.masterGain.gain.value = clampedVolume / 100;
  }

  /**
   * Mute/unmute a source
   */
  setMuted(sourceId: string, muted: boolean): void {
    const source = this.sources.get(sourceId);
    if (!source || !source.gainNode) return;

    source.muted = muted;
    source.gainNode.gain.value = muted ? 0 : source.volume / 100;
  }

  /**
   * Get audio level for a source (0-100)
   */
  getLevel(sourceId: string): number {
    const source = this.sources.get(sourceId);
    if (!source || !source.analyserNode) return 0;

    const dataArray = new Uint8Array(source.analyserNode.frequencyBinCount);
    source.analyserNode.getByteTimeDomainData(dataArray);

    // Calculate RMS (Root Mean Square) level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    return Math.min(100, rms * 100 * 2); // Scale to 0-100
  }

  /**
   * Get master output level (0-100)
   */
  getMasterLevel(): number {
    if (!this.masterAnalyser) return 0;

    const dataArray = new Uint8Array(this.masterAnalyser.frequencyBinCount);
    this.masterAnalyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    return Math.min(100, rms * 100 * 2);
  }

  /**
   * Start monitoring audio levels
   */
  private startLevelMonitoring(): void {
    const monitor = () => {
      if (!this.levelMeterCallback) {
        this.animationFrameId = requestAnimationFrame(monitor);
        return;
      }

      // Get levels for all sources
      this.sources.forEach((source) => {
        const level = this.getLevel(source.id);
        this.levelMeterCallback!(source.id, level);
      });

      // Get master level
      const masterLevel = this.getMasterLevel();
      this.levelMeterCallback!('master', masterLevel);

      this.animationFrameId = requestAnimationFrame(monitor);
    };

    monitor();
  }

  /**
   * Set callback for level meter updates
   */
  onLevelUpdate(callback: LevelMeterCallback): void {
    this.levelMeterCallback = callback;
  }

  /**
   * Start recording the mixed output
   */
  startRecording(): void {
    if (!this.destination || this.isRecording) return;

    try {
      const stream = this.destination.stream;
      
      // Use highest quality settings
      const options: MediaRecorderOptions = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 256000
      };

      this.mediaRecorder = new MediaRecorder(stream, options);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      console.log('🔴 Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and download the file
   */
  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('Not currently recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        this.isRecording = false;
        console.log('⏹️ Recording stopped');
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Download recording as file
   */
  async downloadRecording(filename?: string): Promise<void> {
    const blob = await this.stopRecording();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `audioroad-${new Date().toISOString()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Stop recording and return the blob (for uploading)
   */
  async stopRecordingAndGetBlob(): Promise<{ blob: Blob; filename: string }> {
    const blob = await this.stopRecording();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `audioroad-${timestamp}.webm`;
    return { blob, filename };
  }

  /**
   * Get the mixed output stream (for streaming to Radio.co)
   */
  getOutputStream(): MediaStream | null {
    return this.destination?.stream || null;
  }

  /**
   * Get all current sources
   */
  getSources(): AudioSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get a specific source
   */
  getSource(sourceId: string): AudioSource | undefined {
    return this.sources.get(sourceId);
  }

  /**
   * Check if recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Clean up and destroy mixer
   */
  async destroy(): Promise<void> {
    console.log('🧹 [MIXER] Destroying mixer and stopping all audio sources...');
    
    // Stop monitoring
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      console.log('  ✓ Animation frame cancelled');
    }

    // Stop recording if active
    if (this.isRecording) {
      try {
        await this.stopRecording();
        console.log('  ✓ Recording stopped');
      } catch (error) {
        console.warn('  ⚠️ Error stopping recording:', error);
      }
    }

    // CRITICAL: Remove all sources (this stops microphone tracks!)
    console.log(`  🎤 Removing ${this.sources.size} audio source(s)...`);
    this.sources.forEach((_, id) => this.removeSource(id));
    this.sources.clear();
    console.log('  ✓ All sources removed and tracks stopped');

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      console.log('  ✓ Audio context closed');
    }

    // Null out all references
    this.audioContext = null;
    this.masterGain = null;
    this.masterAnalyser = null;
    this.destination = null;
    this.compressor = null;
    this.hostMicStream = null;

    console.log('✅ [MIXER] Mixer destroyed - microphone should now be OFF');
  }

  /**
   * Get host microphone stream for Twilio conference
   * Returns a CLONE so both mixer and Twilio can use the same mic
   */
  getHostMicStreamForConference(): MediaStream | null {
    if (!this.hostMicStream) {
      console.warn('⚠️ [MIXER] No host mic stream available - mic may not be connected');
      return null;
    }

    // Clone the stream so Twilio gets its own copy (separate from mixer)
    const clonedStream = this.hostMicStream.clone();
    console.log('✅ [MIXER] Cloned host mic stream for Twilio conference');
    return clonedStream;
  }
}

