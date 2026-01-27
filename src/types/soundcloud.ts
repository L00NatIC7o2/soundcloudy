export interface Track {
  id: number;
  title: string;
  description?: string;
  duration: number;
  permalink_url: string;
  artwork_url?: string;
  waveform_url?: string;
  stream_url?: string;
  preview_url?: string; // Add this
  user: {
    id: number;
    username: string;
    avatar_url?: string;
  };
}

export interface User {
  id: number;
  username: string;
  avatar_url: string;
}

export interface Playlist {
  id: number;
  title: string;
  tracks: Track[];
  user: User;
}

export interface SearchResult {
  tracks: Track[];
  users: User[];
  playlists: Playlist[];
}
