export interface Track {
  id: number;
  title: string;
  user: User;
  duration: number;
  artwork_url: string;
  stream_url: string;
  playback_count: number;
  likes_count: number;
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
