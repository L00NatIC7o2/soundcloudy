interface MobileSidebarProps {
  mobileSidebarPage: number;
  playlists: any[];
  onOpenHomepage: () => void;
  onOpenProfile: () => void;
  onOpenLikes: () => void;
  onOpenLibrary: () => void;
  onOpenNewReleases: () => void;
  onOpenPlaylist: (playlist: any) => void;
  onLogout: () => void;
  getPlaylistCover: (playlist: any) => string;
}

export default function MobileSidebar({
  mobileSidebarPage,
  playlists,
  onOpenHomepage,
  onOpenProfile,
  onOpenLikes,
  onOpenLibrary,
  onOpenNewReleases,
  onOpenPlaylist,
  onLogout,
  getPlaylistCover,
}: MobileSidebarProps) {
  return (
    <div className="mobile-sidebar-shell">
      <div
        className={`mobile-sidebar-pages mobile-sidebar-pages-${mobileSidebarPage}`}
      >
        <section className="mobile-sidebar-page mobile-sidebar-page-nav">
          <nav className="mobile-sidebar-nav">
            <button type="button" className="mobile-sidebar-nav-item" onClick={onOpenHomepage}>
              <img
                src="https://img.icons8.com/parakeet-line/50/home.png"
                alt="Home"
                className="mobile-sidebar-nav-icon"
                loading="lazy"
                decoding="async"
              />
              <span className="mobile-sidebar-nav-label">Home</span>
            </button>
            <button type="button" className="mobile-sidebar-nav-item" onClick={onOpenProfile}>
              <img
                src="https://img.icons8.com/parakeet-line/48/person-male.png"
                alt="Profile"
                className="mobile-sidebar-nav-icon"
                loading="lazy"
                decoding="async"
              />
              <span className="mobile-sidebar-nav-label">Profile</span>
            </button>
            <button type="button" className="mobile-sidebar-nav-item" onClick={onOpenLikes}>
              <img
                src="https://img.icons8.com/parakeet-line/48/like.png"
                alt="Liked Songs"
                className="mobile-sidebar-nav-icon nav-icon-like"
                loading="lazy"
                decoding="async"
              />
              <span className="mobile-sidebar-nav-label">Liked Songs</span>
            </button>
            <button type="button" className="mobile-sidebar-nav-item" onClick={onOpenLibrary}>
              <img
                src="https://img.icons8.com/parakeet-line/48/book.png"
                alt="My Library"
                className="mobile-sidebar-nav-icon"
                loading="lazy"
                decoding="async"
              />
              <span className="mobile-sidebar-nav-label">Library</span>
            </button>
            <button
              type="button"
              className="mobile-sidebar-nav-item"
              onClick={onOpenNewReleases}
            >
              <img
                src="https://img.icons8.com/parakeet-line/48/calendar-1.png"
                alt="Newly Released"
                className="mobile-sidebar-nav-icon"
                loading="lazy"
                decoding="async"
              />
              <span className="mobile-sidebar-nav-label">New</span>
            </button>
          </nav>
        </section>

        <section className="mobile-sidebar-page mobile-sidebar-page-playlists">
          <div className="mobile-sidebar-playlists-row">
            {playlists.length > 0 ? (
              playlists.slice(0, 5).map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className="mobile-sidebar-playlist-chip"
                  onClick={() => onOpenPlaylist(playlist)}
                >
                  <img
                    src={getPlaylistCover(playlist)}
                    alt={playlist.title}
                    className="mobile-sidebar-playlist-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="mobile-sidebar-playlist-name">{playlist.title}</span>
                </button>
              ))
            ) : (
              <div className="mobile-sidebar-empty">No playlists yet</div>
            )}
          </div>
        </section>

        <section className="mobile-sidebar-page mobile-sidebar-page-logout">
          <button
            type="button"
            className="mobile-sidebar-logout-action"
            onClick={onLogout}
          >
            Log out
          </button>
        </section>
      </div>
    </div>
  );
}
