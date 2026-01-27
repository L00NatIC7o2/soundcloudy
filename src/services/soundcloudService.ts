import axios from "axios";
import type { Track } from "../types/soundcloud";

const BACKEND_API = process.env.NEXT_PUBLIC_BACKEND_URL || ""; // empty = same origin

export const soundcloudService = {
  async searchTracks(query: string): Promise<Track[]> {
    const response = await axios.get(`${BACKEND_API}/api/search`, {
      params: { q: query },
    });
    return response.data.collection || response.data;
  },

  async getTrack(trackId: number): Promise<Track> {
    const response = await axios.get(`${BACKEND_API}/api/search`, {
      params: { q: trackId },
    });
    const tracks = response.data.collection || response.data;
    return tracks[0] || {};
  },
};
