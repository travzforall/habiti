import { Injectable, signal, computed } from '@angular/core';
import Hls from 'hls.js';

export type StreamType = 'hls' | 'webrtc' | 'mjpeg' | 'native';

export type StreamState = 'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'ended';

export interface StreamInfo {
  id: string;
  cameraId: string;
  type: StreamType;
  state: StreamState;
  url: string;
  videoElement?: HTMLVideoElement;
  hlsInstance?: Hls;
  peerConnection?: RTCPeerConnection;
  error?: string;
  quality?: StreamQuality;
  stats?: StreamStats;
}

export interface StreamQuality {
  width: number;
  height: number;
  bitrate?: number;
  codec?: string;
}

export interface StreamStats {
  buffered: number;
  currentTime: number;
  duration: number;
  droppedFrames?: number;
  latency?: number;
}

export interface StreamOptions {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  lowLatency?: boolean;
  maxBufferLength?: number;
  startLevel?: number; // -1 for auto
}

@Injectable({
  providedIn: 'root'
})
export class CameraStreamService {
  // Active streams
  private readonly _streams = signal<Map<string, StreamInfo>>(new Map());

  // Public signals
  readonly streams = computed(() => Array.from(this._streams().values()));
  readonly activeStreamCount = computed(() => this._streams().size);

  // Default options
  private readonly defaultOptions: StreamOptions = {
    autoplay: true,
    muted: true,
    loop: false,
    lowLatency: true,
    maxBufferLength: 30,
    startLevel: -1,
  };

  /**
   * Detect stream type from URL
   */
  detectStreamType(url: string): StreamType {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('.m3u8') || lowerUrl.includes('hls')) {
      return 'hls';
    }

    if (lowerUrl.startsWith('webrtc://') || lowerUrl.includes('whep') || lowerUrl.includes('whip')) {
      return 'webrtc';
    }

    if (lowerUrl.includes('mjpeg') || lowerUrl.includes('mjpg') || lowerUrl.endsWith('.mjpg')) {
      return 'mjpeg';
    }

    // RTSP streams need to be proxied through a media server
    // Return 'hls' as the proxy target format
    if (lowerUrl.startsWith('rtsp://')) {
      return 'hls';
    }

    // Default to native for mp4, webm, etc.
    return 'native';
  }

  /**
   * Check if URL is an RTSP stream that needs proxying
   */
  isRtspUrl(url: string): boolean {
    return url.toLowerCase().startsWith('rtsp://');
  }

  /**
   * Convert RTSP URL to proxied HLS URL
   * This assumes a media server (like MediaMTX, go2rtc, etc.) is running
   */
  getRtspProxyUrl(rtspUrl: string, proxyBaseUrl?: string): string {
    // Default proxy endpoint - MediaMTX default port
    const baseUrl = proxyBaseUrl || 'http://localhost:8888';

    // For MediaMTX, the stream name is configured in mediamtx.yml
    // Default stream name for the main camera is "ipcam"
    // MediaMTX uses index.m3u8 for LL-HLS
    return `${baseUrl}/ipcam/index.m3u8`;
  }

  /**
   * Start a stream
   */
  async startStream(
    cameraId: string,
    url: string,
    videoElement: HTMLVideoElement,
    options?: StreamOptions
  ): Promise<StreamInfo> {
    const opts = { ...this.defaultOptions, ...options };
    const streamType = this.detectStreamType(url);
    const streamId = this.generateStreamId();

    // Create initial stream info
    const streamInfo: StreamInfo = {
      id: streamId,
      cameraId,
      type: streamType,
      state: 'loading',
      url,
      videoElement,
    };

    this.updateStream(streamId, streamInfo);

    try {
      switch (streamType) {
        case 'hls':
          await this.startHlsStream(streamInfo, opts);
          break;
        case 'webrtc':
          await this.startWebRtcStream(streamInfo, opts);
          break;
        case 'mjpeg':
          await this.startMjpegStream(streamInfo, opts);
          break;
        case 'native':
        default:
          await this.startNativeStream(streamInfo, opts);
          break;
      }

      return this.getStream(streamId)!;
    } catch (error) {
      this.updateStream(streamId, {
        state: 'error',
        error: error instanceof Error ? error.message : 'Failed to start stream',
      });
      throw error;
    }
  }

  /**
   * Start HLS stream using hls.js
   */
  private async startHlsStream(streamInfo: StreamInfo, options: StreamOptions): Promise<void> {
    const { videoElement, url, id } = streamInfo;

    if (!videoElement) {
      throw new Error('Video element is required');
    }

    // Check if HLS is supported natively
    if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      videoElement.src = url;
      await this.setupVideoElement(videoElement, options);
      this.updateStream(id, { state: 'playing' });
      return;
    }

    // Use hls.js for other browsers
    if (!Hls.isSupported()) {
      throw new Error('HLS is not supported in this browser');
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: options.lowLatency,
      maxBufferLength: options.maxBufferLength || 30,
      maxMaxBufferLength: 600,
      startLevel: options.startLevel ?? -1,
      debug: false,
    });

    // Store HLS instance
    this.updateStream(id, { hlsInstance: hls });

    // Set up event handlers
    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      console.log('HLS manifest parsed, levels:', data.levels.length);

      if (data.levels.length > 0) {
        const level = data.levels[hls.currentLevel] || data.levels[0];
        this.updateStream(id, {
          quality: {
            width: level.width,
            height: level.height,
            bitrate: level.bitrate,
            codec: level.codecSet,
          },
        });
      }

      if (options.autoplay) {
        videoElement.play().catch(console.warn);
      }

      this.updateStream(id, { state: 'playing' });
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      console.error('HLS error:', data);

      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log('Network error, attempting recovery...');
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('Media error, attempting recovery...');
            hls.recoverMediaError();
            break;
          default:
            this.updateStream(id, {
              state: 'error',
              error: `Fatal HLS error: ${data.details}`,
            });
            hls.destroy();
            break;
        }
      }
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
      const level = hls.levels[data.level];
      if (level) {
        this.updateStream(id, {
          quality: {
            width: level.width,
            height: level.height,
            bitrate: level.bitrate,
            codec: level.codecSet,
          },
        });
      }
    });

    // Load source and attach to video element
    hls.loadSource(url);
    hls.attachMedia(videoElement);

    await this.setupVideoElement(videoElement, options);
  }

  /**
   * Start WebRTC stream
   */
  private async startWebRtcStream(streamInfo: StreamInfo, options: StreamOptions): Promise<void> {
    const { videoElement, url, id } = streamInfo;

    if (!videoElement) {
      throw new Error('Video element is required');
    }

    // Create peer connection
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    this.updateStream(id, { peerConnection: pc });

    // Handle incoming tracks
    pc.ontrack = (event) => {
      if (event.streams[0]) {
        videoElement.srcObject = event.streams[0];
        this.updateStream(id, { state: 'playing' });

        if (options.autoplay) {
          videoElement.play().catch(console.warn);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);

      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        this.updateStream(id, {
          state: 'error',
          error: 'WebRTC connection failed',
        });
      }
    };

    // Add receive-only transceivers
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    // Create and set local offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering
    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            resolve();
          }
        };
      }
    });

    // Send offer to signaling server (WHEP)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: pc.localDescription?.sdp,
      });

      if (!response.ok) {
        throw new Error(`WHEP signaling failed: ${response.status}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
    } catch (error) {
      pc.close();
      throw error;
    }

    await this.setupVideoElement(videoElement, options);
  }

  /**
   * Start MJPEG stream
   */
  private async startMjpegStream(streamInfo: StreamInfo, options: StreamOptions): Promise<void> {
    const { videoElement, url, id } = streamInfo;

    if (!videoElement) {
      throw new Error('Video element is required');
    }

    // MJPEG streams are typically displayed in an img element
    // But we can use a canvas to render frames
    // For simplicity, we'll use the video element's poster and update it
    // In production, consider using a canvas-based solution

    // Create an image element to load MJPEG
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.src = url;

    img.onload = () => {
      // Draw to canvas and capture as video frame
      // This is a simplified approach
      this.updateStream(id, { state: 'playing' });
    };

    img.onerror = () => {
      this.updateStream(id, {
        state: 'error',
        error: 'Failed to load MJPEG stream',
      });
    };

    // Store the image URL as poster
    videoElement.poster = url;
    await this.setupVideoElement(videoElement, options);
  }

  /**
   * Start native video stream
   */
  private async startNativeStream(streamInfo: StreamInfo, options: StreamOptions): Promise<void> {
    const { videoElement, url, id } = streamInfo;

    if (!videoElement) {
      throw new Error('Video element is required');
    }

    videoElement.src = url;

    videoElement.onloadeddata = () => {
      this.updateStream(id, { state: 'playing' });
    };

    videoElement.onerror = () => {
      this.updateStream(id, {
        state: 'error',
        error: 'Failed to load video',
      });
    };

    await this.setupVideoElement(videoElement, options);
  }

  /**
   * Setup video element with common options
   */
  private async setupVideoElement(video: HTMLVideoElement, options: StreamOptions): Promise<void> {
    video.muted = options.muted ?? true;
    video.loop = options.loop ?? false;
    video.playsInline = true;
    video.controls = false;

    // Set up event listeners for stats
    video.ontimeupdate = () => {
      const streamInfo = this.getStreamByVideoElement(video);
      if (streamInfo) {
        this.updateStream(streamInfo.id, {
          stats: this.getVideoStats(video),
        });
      }
    };

    video.onended = () => {
      const streamInfo = this.getStreamByVideoElement(video);
      if (streamInfo) {
        this.updateStream(streamInfo.id, { state: 'ended' });
      }
    };

    video.onpause = () => {
      const streamInfo = this.getStreamByVideoElement(video);
      if (streamInfo) {
        this.updateStream(streamInfo.id, { state: 'paused' });
      }
    };

    video.onplay = () => {
      const streamInfo = this.getStreamByVideoElement(video);
      if (streamInfo) {
        this.updateStream(streamInfo.id, { state: 'playing' });
      }
    };

    if (options.autoplay) {
      try {
        await video.play();
      } catch (error) {
        console.warn('Autoplay failed:', error);
      }
    }
  }

  /**
   * Stop a stream
   */
  stopStream(streamId: string): void {
    const streamInfo = this.getStream(streamId);
    if (!streamInfo) return;

    // Clean up HLS
    if (streamInfo.hlsInstance) {
      streamInfo.hlsInstance.destroy();
    }

    // Clean up WebRTC
    if (streamInfo.peerConnection) {
      streamInfo.peerConnection.close();
    }

    // Clean up video element
    if (streamInfo.videoElement) {
      streamInfo.videoElement.pause();
      streamInfo.videoElement.src = '';
      streamInfo.videoElement.srcObject = null;
      streamInfo.videoElement.load();
    }

    // Remove from streams map
    this._streams.update(streams => {
      const updated = new Map(streams);
      updated.delete(streamId);
      return updated;
    });
  }

  /**
   * Stop all streams for a camera
   */
  stopCameraStreams(cameraId: string): void {
    const streams = this._streams();
    streams.forEach((streamInfo, streamId) => {
      if (streamInfo.cameraId === cameraId) {
        this.stopStream(streamId);
      }
    });
  }

  /**
   * Stop all streams
   */
  stopAllStreams(): void {
    const streams = this._streams();
    streams.forEach((_, streamId) => {
      this.stopStream(streamId);
    });
  }

  /**
   * Pause/resume stream
   */
  togglePlayPause(streamId: string): void {
    const streamInfo = this.getStream(streamId);
    if (!streamInfo?.videoElement) return;

    if (streamInfo.videoElement.paused) {
      streamInfo.videoElement.play().catch(console.warn);
    } else {
      streamInfo.videoElement.pause();
    }
  }

  /**
   * Toggle mute
   */
  toggleMute(streamId: string): void {
    const streamInfo = this.getStream(streamId);
    if (!streamInfo?.videoElement) return;

    streamInfo.videoElement.muted = !streamInfo.videoElement.muted;
  }

  /**
   * Set volume
   */
  setVolume(streamId: string, volume: number): void {
    const streamInfo = this.getStream(streamId);
    if (!streamInfo?.videoElement) return;

    streamInfo.videoElement.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Take snapshot
   */
  takeSnapshot(streamId: string): string | null {
    const streamInfo = this.getStream(streamId);
    if (!streamInfo?.videoElement) return null;

    const video = streamInfo.videoElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  /**
   * Enter fullscreen
   */
  async enterFullscreen(streamId: string): Promise<void> {
    const streamInfo = this.getStream(streamId);
    if (!streamInfo?.videoElement) return;

    try {
      await streamInfo.videoElement.requestFullscreen();
    } catch (error) {
      console.warn('Fullscreen not supported:', error);
    }
  }

  /**
   * Get stream by ID
   */
  getStream(streamId: string): StreamInfo | undefined {
    return this._streams().get(streamId);
  }

  /**
   * Get stream by camera ID
   */
  getStreamByCameraId(cameraId: string): StreamInfo | undefined {
    return Array.from(this._streams().values()).find(s => s.cameraId === cameraId);
  }

  /**
   * Get stream by video element
   */
  private getStreamByVideoElement(video: HTMLVideoElement): StreamInfo | undefined {
    return Array.from(this._streams().values()).find(s => s.videoElement === video);
  }

  /**
   * Update stream info
   */
  private updateStream(streamId: string, updates: Partial<StreamInfo>): void {
    this._streams.update(streams => {
      const current = streams.get(streamId);
      if (!current && !updates.id) return streams;

      const updated = new Map(streams);
      updated.set(streamId, {
        ...(current || { id: streamId } as StreamInfo),
        ...updates,
      });
      return updated;
    });
  }

  /**
   * Get video stats
   */
  private getVideoStats(video: HTMLVideoElement): StreamStats {
    let buffered = 0;
    if (video.buffered.length > 0) {
      buffered = video.buffered.end(video.buffered.length - 1) - video.currentTime;
    }

    return {
      buffered,
      currentTime: video.currentTime,
      duration: video.duration || 0,
      droppedFrames: (video as any).webkitDroppedFrameCount,
    };
  }

  /**
   * Generate stream ID
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
