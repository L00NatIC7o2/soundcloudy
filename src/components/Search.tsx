// Or wherever your search is implemented

import { useState, useCallback, useRef, useEffect } from "react";

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Initial search
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasMore(false);
      return;
    }

    setLoading(true);
    setIsSearching(true);

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&offset=0&limit=20`,
      );
      const data = await response.json();
      setResults(data.collection || []);
      setHasMore(data.hasMore);
      setNextOffset(20);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load more results
  const loadMore = useCallback(async () => {
    if (!query.trim() || loading || !hasMore) return;

    setLoading(true);

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&offset=${nextOffset}&limit=20`,
      );
      const data = await response.json();

      setResults((prev) => [...prev, ...(data.collection || [])]);
      setHasMore(data.hasMore);
      setNextOffset((prev) => prev + 20);
    } catch (error) {
      console.error("Load more failed:", error);
    } finally {
      setLoading(false);
    }
  }, [query, nextOffset, hasMore, loading]);

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && isSearching) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [loadMore, hasMore, loading, isSearching]);

  const handleSearchInput = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      handleSearch(value);
    } else {
      setResults([]);
      setIsSearching(false);
    }
  };

  // Use Next.js router for SPA navigation
  const router = require("next/router").useRouter();

  return (
    <div className="search-container">
      <input
        type="text"
        className="search-input"
        placeholder="Search tracks..."
        value={query}
        onChange={(e) => handleSearchInput(e.target.value)}
      />

      {loading && results.length === 0 && (
        <div className="loading">Loading results...</div>
      )}

      <div className="search-results">
        {results.map((track) => (
          <div key={track.id} className="track-item">
            <a
              href={`/track/${track.id}`}
              onClick={(e) => {
                e.preventDefault();
                router.push(`/track/${track.id}`);
              }}
              style={{
                color: "#ff5500",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              {track.title}
            </a>
          </div>
        ))}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={observerTarget} className="scroll-trigger">
        {loading && results.length > 0 && (
          <div className="loading">Loading more...</div>
        )}
        {!hasMore && results.length > 0 && (
          <div className="end-message">No more results</div>
        )}
      </div>
    </div>
  );
}
