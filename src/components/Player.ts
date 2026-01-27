import type { Track } from "../types/soundcloud";

export class Player {
  private currentTrack: Track | null = null;
  private isPlaying = false;
  private audio: HTMLAudioElement;

  constructor() {
    this.audio = new Audio();
  }

  play(track: Track): void {
    this.currentTrack = track;

    // Use preview_url instead of stream_url
    if (track.preview_url) {
      this.audio.src = track.preview_url;
      this.audio.play();
      this.isPlaying = true;
    } else {
      alert("Preview not available for this track");
    }
  }

  pause(): void {
    this.audio.pause();
    this.isPlaying = false;
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }
}
