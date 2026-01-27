import axios from "axios";
import type { Track } from "../types/soundcloud";

const BACKEND_API = "http://localhost:3000/api";

export const soundcloudService = {
  async searchTracks(query: string): Promise<Track[]> {
    try {
      const response = await axios.get(`${BACKEND_API}/search`, {
        params: { q: query },
      });

      return response.data.collection || response.data;
    } catch (error) {
      console.error("Search error:", error);
      throw error;
    }
  },

  async getTrack(trackId: number): Promise<Track> {
    try {
      const response = await axios.get(`${BACKEND_API}/search`, {
        params: { q: trackId },
      });

      const tracks = response.data.collection || response.data;
      return tracks[0] || {};
    } catch (error) {
      console.error("Get track error:", error);
      throw error;
    }
  },
};
