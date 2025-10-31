import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import { downloadRecording as twilioDownloadRecording } from './twilioService.js';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'audioroad-recordings';

interface AudioTrack {
  url: string;
  volume: number;
  label: string;
}

/**
 * Upload audio file to S3
 */
export async function uploadToS3(
  fileBuffer: Buffer,
  key: string,
  contentType: string = 'audio/mpeg'
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

/**
 * Get signed URL for private S3 object
 */
export async function getSignedS3Url(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw error;
  }
}

/**
 * Download and process Twilio recording
 */
export async function processRecording(
  recordingSid: string,
  episodeId: string,
  callId: string
): Promise<string> {
  try {
    // Download recording from Twilio
    console.log('Downloading recording from Twilio:', recordingSid);
    const recordingBuffer = await twilioDownloadRecording(recordingSid);

    // Upload to S3
    const key = `recordings/${episodeId}/${callId}/${recordingSid}.mp3`;
    console.log('Uploading to S3:', key);
    const s3Url = await uploadToS3(recordingBuffer, key, 'audio/mpeg');

    console.log('Recording processed successfully:', s3Url);
    return s3Url;
  } catch (error) {
    console.error('Error processing recording:', error);
    throw error;
  }
}

/**
 * Mix multiple audio tracks into one
 */
export async function mixAudioTracks(tracks: AudioTrack[], outputFilename: string): Promise<string> {
  const tempDir = '/tmp/audio-mixing';
  await fs.mkdir(tempDir, { recursive: true });
  
  return new Promise((resolve, reject) => {
    try {

      const outputPath = path.join(tempDir, outputFilename);
      const command = ffmpeg();

      // Add all input tracks
      tracks.forEach((track) => {
        command.input(track.url);
      });

      // Build filter complex for mixing with volume control
      const filterComplex: string[] = [];
      tracks.forEach((track, index) => {
        filterComplex.push(`[${index}:a]volume=${track.volume}[a${index}]`);
      });
      
      const mixInputs = tracks.map((_, index) => `[a${index}]`).join('');
      filterComplex.push(`${mixInputs}amix=inputs=${tracks.length}:dropout_transition=0[out]`);

      command
        .complexFilter(filterComplex)
        .outputOptions('-map', '[out]')
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('Processing: ' + progress.percent + '% done');
        })
        .on('end', async () => {
          console.log('Audio mixing completed');
          
          // Upload mixed file to S3
          const fileBuffer = await fs.readFile(outputPath);
          const s3Key = `mixed/${Date.now()}-${outputFilename}`;
          const s3Url = await uploadToS3(fileBuffer, s3Key);
          
          // Cleanup temp file
          await fs.unlink(outputPath).catch(console.error);
          
          resolve(s3Url);
        })
        .on('error', (err) => {
          console.error('Error mixing audio:', err);
          reject(err);
        })
        .run();

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Extract audio clip from larger recording
 */
export async function extractClip(
  sourceUrl: string,
  startTime: number,
  duration: number,
  outputFilename: string
): Promise<string> {
  const tempDir = '/tmp/audio-clips';
  await fs.mkdir(tempDir, { recursive: true });
  
  return new Promise((resolve, reject) => {
    try {

      const outputPath = path.join(tempDir, outputFilename);

      ffmpeg(sourceUrl)
        .setStartTime(startTime)
        .setDuration(duration)
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .output(outputPath)
        .on('end', async () => {
          console.log('Clip extraction completed');
          
          // Upload to S3
          const fileBuffer = await fs.readFile(outputPath);
          const s3Key = `clips/${Date.now()}-${outputFilename}`;
          const s3Url = await uploadToS3(fileBuffer, s3Key);
          
          // Cleanup
          await fs.unlink(outputPath).catch(console.error);
          
          resolve(s3Url);
        })
        .on('error', (err) => {
          console.error('Error extracting clip:', err);
          reject(err);
        })
        .run();

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Apply audio enhancements (noise reduction, normalization, etc.)
 */
export async function enhanceAudio(
  sourceUrl: string,
  options: {
    noiseReduction?: boolean;
    normalize?: boolean;
    compress?: boolean;
  } = {}
): Promise<string> {
  const tempDir = '/tmp/audio-enhancement';
  await fs.mkdir(tempDir, { recursive: true });
  
  return new Promise((resolve, reject) => {
    try {

      const outputPath = path.join(tempDir, `enhanced-${Date.now()}.mp3`);
      const command = ffmpeg(sourceUrl);

      // Build audio filters
      const filters: string[] = [];

      if (options.noiseReduction) {
        // Basic high-pass filter to remove low-frequency noise
        filters.push('highpass=f=200');
      }

      if (options.normalize) {
        // Normalize audio levels
        filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
      }

      if (options.compress) {
        // Dynamic range compression
        filters.push('acompressor=threshold=-20dB:ratio=4:attack=5:release=50');
      }

      if (filters.length > 0) {
        command.audioFilters(filters);
      }

      command
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .output(outputPath)
        .on('end', async () => {
          console.log('Audio enhancement completed');
          
          const fileBuffer = await fs.readFile(outputPath);
          const s3Key = `enhanced/${Date.now()}-enhanced.mp3`;
          const s3Url = await uploadToS3(fileBuffer, s3Key);
          
          await fs.unlink(outputPath).catch(console.error);
          
          resolve(s3Url);
        })
        .on('error', (err) => {
          console.error('Error enhancing audio:', err);
          reject(err);
        })
        .run();

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate waveform image for audio file
 */
export async function generateWaveform(
  sourceUrl: string,
  width: number = 1800,
  height: number = 280
): Promise<string> {
  const tempDir = '/tmp/waveforms';
  await fs.mkdir(tempDir, { recursive: true });
  
  return new Promise((resolve, reject) => {
    try {

      const outputPath = path.join(tempDir, `waveform-${Date.now()}.png`);

      ffmpeg(sourceUrl)
        .complexFilter([
          `showwavespic=s=${width}x${height}:colors=0ea5e9`
        ])
        .frames(1)
        .output(outputPath)
        .on('end', async () => {
          console.log('Waveform generated');
          
          const fileBuffer = await fs.readFile(outputPath);
          const s3Key = `waveforms/${Date.now()}-waveform.png`;
          const s3Url = await uploadToS3(fileBuffer, s3Key, 'image/png');
          
          await fs.unlink(outputPath).catch(console.error);
          
          resolve(s3Url);
        })
        .on('error', (err) => {
          console.error('Error generating waveform:', err);
          reject(err);
        })
        .run();

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get audio file metadata (duration, bitrate, etc.)
 */
export async function getAudioMetadata(sourceUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(sourceUrl, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata);
      }
    });
  });
}

