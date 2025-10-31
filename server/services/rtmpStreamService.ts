/**
 * RTMP Multi-Platform Streaming Service
 * 
 * Streams to YouTube Live, Facebook Live, X (Twitter), etc.
 * Supports audio-only OR audio+video
 * 30-minute auto-cutoff for social teasers
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { PassThrough } from 'stream';

export interface RTMPPlatform {
  name: 'youtube' | 'facebook' | 'x' | 'custom';
  streamKey: string;
  enabled: boolean;
  thirtyMinLimit: boolean;
  customUrl?: string;  // For custom RTMP servers
}

export interface RTMPConfig {
  platforms: RTMPPlatform[];
  bitrate: number;
  hasVideo: boolean;
}

export class RTMPStreamService extends EventEmitter {
  private config: RTMPConfig | null = null;
  private ffmpegProcesses: Map<string, ChildProcess> = new Map();
  private audioInputStream: PassThrough | null = null;
  private videoInputStream: PassThrough | null = null;
  private isStreaming = false;
  private cutoffTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Get RTMP URL for each platform
   */
  private getRTMPUrl(platform: RTMPPlatform): string {
    const urls = {
      youtube: `rtmp://a.rtmp.youtube.com/live2/${platform.streamKey}`,
      facebook: `rtmps://live-api-s.facebook.com:443/rtmp/${platform.streamKey}`,
      x: `rtmp://live-video.twitter.com/${platform.streamKey}`,
      custom: platform.customUrl || ''
    };

    return urls[platform.name];
  }

  /**
   * Start streaming to all enabled platforms
   */
  async start(config: RTMPConfig): Promise<void> {
    this.config = config;
    console.log('📡 [RTMP] Starting multi-platform streaming...');
    console.log('   Has video:', config.hasVideo);
    console.log('   Platforms:', config.platforms.filter(p => p.enabled).map(p => p.name).join(', '));

    try {
      // Create input streams
      this.audioInputStream = new PassThrough();
      if (config.hasVideo) {
        this.videoInputStream = new PassThrough();
      }

      // Start stream to each enabled platform
      for (const platform of config.platforms) {
        if (platform.enabled) {
          await this.startPlatformStream(platform);
        }
      }

      this.isStreaming = true;
      console.log('✅ [RTMP] Multi-platform streaming started');

    } catch (error) {
      console.error('❌ [RTMP] Failed to start streaming:', error);
      throw error;
    }
  }

  /**
   * Start streaming to a specific platform
   */
  private async startPlatformStream(platform: RTMPPlatform): Promise<void> {
    const rtmpUrl = this.getRTMPUrl(platform);
    
    console.log(`🎬 [RTMP] Starting stream to ${platform.name}...`);
    console.log(`   URL: ${rtmpUrl.replace(platform.streamKey, '***')}`);

    const args = this.config!.hasVideo 
      ? this.getVideoFFmpegArgs(rtmpUrl)
      : this.getAudioOnlyFFmpegArgs(rtmpUrl);

    const ffmpeg = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Pipe audio input
    if (this.audioInputStream) {
      this.audioInputStream.pipe(ffmpeg.stdin!);
    }

    // Monitor output
    ffmpeg.stdout.on('data', () => {
      // Could log streaming stats here
    });

    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString();
      if (message.includes('Error') || message.includes('error')) {
        console.error(`⚠️ [RTMP ${platform.name}]:`, message.substring(0, 200));
      }
    });

    ffmpeg.on('exit', (code) => {
      console.log(`📴 [RTMP ${platform.name}] Stream ended (code: ${code})`);
      this.ffmpegProcesses.delete(platform.name);
    });

    ffmpeg.on('error', (error) => {
      console.error(`❌ [RTMP ${platform.name}] Error:`, error);
      this.emit('platform-error', { platform: platform.name, error });
    });

    // Store process
    this.ffmpegProcesses.set(platform.name, ffmpeg);

    // Set 30-minute cutoff timer if enabled
    if (platform.thirtyMinLimit) {
      const timer = setTimeout(() => {
        console.log(`⏰ [RTMP ${platform.name}] 30-minute limit reached, stopping...`);
        this.stopPlatform(platform.name);
        this.emit('platform-cutoff', { platform: platform.name });
      }, 30 * 60 * 1000);  // 30 minutes

      this.cutoffTimers.set(platform.name, timer);
      console.log(`⏰ [RTMP ${platform.name}] 30-minute auto-cutoff timer set`);
    }

    console.log(`✅ [RTMP ${platform.name}] Stream started`);
  }

  /**
   * FFmpeg args for video streaming
   */
  private getVideoFFmpegArgs(rtmpUrl: string): string[] {
    return [
      // Audio input (PCM from browser)
      '-f', 'f32le',
      '-ar', '48000',
      '-ac', '2',
      '-i', 'pipe:0',
      
      // Video input (would come separately - TODO in integration)
      // For now, generate color bars if no video
      '-f', 'lavfi',
      '-i', 'color=c=black:s=1280x720:r=30',
      
      // Video encoding
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-b:v', '2500k',
      '-maxrate', '2500k',
      '-bufsize', '5000k',
      '-pix_fmt', 'yuv420p',
      '-g', '60',  // Keyframe every 2 seconds
      '-r', '30',
      
      // Audio encoding
      '-c:a', 'aac',
      '-b:a', `${this.config!.bitrate}k`,
      '-ar', '44100',
      '-ac', '2',
      
      // Output
      '-f', 'flv',
      rtmpUrl
    ];
  }

  /**
   * FFmpeg args for audio-only streaming
   */
  private getAudioOnlyFFmpegArgs(rtmpUrl: string): string[] {
    return [
      // Audio input (PCM from browser)
      '-f', 'f32le',
      '-ar', '48000',
      '-ac', '2',
      '-i', 'pipe:0',
      
      // Generate blank video (required for RTMP)
      '-f', 'lavfi',
      '-i', 'color=c=black:s=1280x720:r=30,format=yuv420p',
      '-f', 'lavfi',
      '-i', 'anullsrc',
      
      // Video encoding (minimal for blank video)
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-b:v', '500k',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      
      // Audio encoding
      '-c:a', 'aac',
      '-b:a', `${this.config!.bitrate}k`,
      '-ar', '44100',
      
      // Output
      '-f', 'flv',
      '-shortest',  // Stop when audio ends
      rtmpUrl
    ];
  }

  /**
   * Process audio chunk
   */
  processAudioChunk(audioData: Float32Array): void {
    if (!this.isStreaming || !this.audioInputStream) return;

    try {
      const buffer = Buffer.from(audioData.buffer);
      this.audioInputStream.write(buffer);
    } catch (error) {
      console.error('❌ [RTMP] Error processing audio:', error);
    }
  }

  /**
   * Stop specific platform
   */
  async stopPlatform(platformName: string): Promise<void> {
    const ffmpeg = this.ffmpegProcesses.get(platformName);
    
    if (ffmpeg) {
      console.log(`📴 [RTMP ${platformName}] Stopping...`);
      ffmpeg.kill('SIGTERM');
      this.ffmpegProcesses.delete(platformName);
    }

    // Clear timer
    const timer = this.cutoffTimers.get(platformName);
    if (timer) {
      clearTimeout(timer);
      this.cutoffTimers.delete(platformName);
    }

    console.log(`✅ [RTMP ${platformName}] Stopped`);
  }

  /**
   * Stop all streaming
   */
  async stop(): Promise<void> {
    console.log('📴 [RTMP] Stopping all platform streams...');
    
    this.isStreaming = false;

    // Stop all FFmpeg processes
    for (const [name, ffmpeg] of this.ffmpegProcesses) {
      ffmpeg.kill('SIGTERM');
      console.log(`📴 [RTMP ${name}] Stopped`);
    }

    // Clear all timers
    for (const timer of this.cutoffTimers.values()) {
      clearTimeout(timer);
    }

    this.ffmpegProcesses.clear();
    this.cutoffTimers.clear();

    // Close input streams
    if (this.audioInputStream) {
      this.audioInputStream.end();
      this.audioInputStream = null;
    }

    if (this.videoInputStream) {
      this.videoInputStream.end();
      this.videoInputStream = null;
    }

    console.log('✅ [RTMP] All platform streams stopped');
  }

  /**
   * Get streaming status
   */
  getStatus() {
    return {
      streaming: this.isStreaming,
      platforms: Array.from(this.ffmpegProcesses.keys()),
      hasVideo: this.config?.hasVideo || false
    };
  }
}

