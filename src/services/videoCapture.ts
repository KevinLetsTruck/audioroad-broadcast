/**
 * Video Capture Service
 * 
 * Optional webcam capture for video streaming
 * Falls back gracefully to audio-only if no camera
 */

export interface VideoDevice {
  deviceId: string;
  label: string;
}

export class VideoCapture {
  private videoStream: MediaStream | null = null;
  private isCapturing = false;

  /**
   * Get available video devices (cameras)
   */
  async getVideoDevices(): Promise<VideoDevice[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.substring(0, 8)}`
        }));

      console.log('📹 [VIDEO] Found', videoDevices.length, 'cameras');
      return videoDevices;
    } catch (error) {
      console.error('❌ [VIDEO] Error enumerating devices:', error);
      return [];
    }
  }

  /**
   * Start video capture
   */
  async startCapture(deviceId?: string): Promise<MediaStream> {
    try {
      console.log('📹 [VIDEO] Starting video capture...');
      console.log('   Camera:', deviceId || 'default');

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false  // Audio comes from mixer, not camera mic
      };

      this.videoStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.isCapturing = true;

      console.log('✅ [VIDEO] Video capture started');
      console.log('   Resolution:', this.videoStream.getVideoTracks()[0].getSettings());
      
      return this.videoStream;

    } catch (error) {
      console.error('❌ [VIDEO] Failed to start video capture:', error);
      throw error;
    }
  }

  /**
   * Stop video capture
   */
  stopCapture(): void {
    if (this.videoStream) {
      console.log('📴 [VIDEO] Stopping video capture...');
      
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
      this.isCapturing = false;
      
      console.log('✅ [VIDEO] Video capture stopped');
    }
  }

  /**
   * Get current video stream
   */
  getStream(): MediaStream | null {
    return this.videoStream;
  }

  /**
   * Check if capturing
   */
  isActive(): boolean {
    return this.isCapturing;
  }

  /**
   * Create canvas compositor for overlays
   * Future: Add show name, logo, graphics
   */
  async createCompositor(videoStream: MediaStream): Promise<MediaStream> {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d')!;

    const video = document.createElement('video');
    video.srcObject = videoStream;
    await video.play();

    // Draw video frames to canvas
    const drawFrame = () => {
      if (!this.isCapturing) return;

      // Draw video
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // TODO: Add overlays here
      // - Show name
      // - Logo
      // - Lower thirds
      // - Timer

      requestAnimationFrame(drawFrame);
    };

    drawFrame();

    // Return canvas as MediaStream
    const canvasStream = canvas.captureStream(30);
    console.log('✅ [VIDEO] Canvas compositor created');
    
    return canvasStream;
  }
}

