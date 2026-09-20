import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { AppTheme } from "./app-theme";

export type MobilePlayerTrack = {
  id: number;
  title: string;
  artist: string;
  artworkUrl?: string | null;
  context?: string;
};

type PlayerState = {
  currentTrack: MobilePlayerTrack | null;
  queue: MobilePlayerTrack[];
  currentIndex: number;
  isPlaying: boolean;
  sheetOpen: boolean;
  playTrack: (track: MobilePlayerTrack, queue?: MobilePlayerTrack[]) => void;
  togglePlayback: () => void;
  playNext: () => void;
  playPrevious: () => void;
  openSheet: () => void;
  closeSheet: () => void;
};

const PlayerContext = createContext<PlayerState | null>(null);

const DEFAULT_QUEUE: MobilePlayerTrack[] = [
  {
    id: 101,
    title: "Night Corridor",
    artist: "Soundcloudy",
    context: "Featured",
  },
  {
    id: 102,
    title: "Static Hearts",
    artist: "Soundcloudy",
    context: "Featured",
  },
  {
    id: 103,
    title: "Late Reply",
    artist: "Soundcloudy",
    context: "Featured",
  },
];

function PlayerChrome({
  currentTrack,
  queue,
  currentIndex,
  isPlaying,
  sheetOpen,
  onOpenSheet,
  onCloseSheet,
  onTogglePlayback,
  onPrevious,
  onNext,
}: {
  currentTrack: MobilePlayerTrack | null;
  queue: MobilePlayerTrack[];
  currentIndex: number;
  isPlaying: boolean;
  sheetOpen: boolean;
  onOpenSheet: () => void;
  onCloseSheet: () => void;
  onTogglePlayback: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const collapsedHeight = 72;
  const navHeight = 66;
  const topInset = 0;
  const sheetBottomInset = navHeight + 6;
  const { height } = useWindowDimensions();
  const availableHeight = Math.max(
    height - topInset - sheetBottomInset,
    collapsedHeight,
  );
  const collapsedTranslate = Math.max(availableHeight - collapsedHeight, 0);
  const translateY = useRef(new Animated.Value(collapsedTranslate)).current;
  const dragStartRef = useRef(collapsedTranslate);

  useEffect(() => {
    if (!currentTrack) {
      return;
    }

    translateY.setValue(sheetOpen ? 0 : collapsedTranslate);
  }, [collapsedTranslate, currentTrack, sheetOpen, translateY]);

  const animateTo = (open: boolean) => {
    Animated.spring(translateY, {
      toValue: open ? 0 : collapsedTranslate,
      useNativeDriver: true,
      tension: 80,
      friction: 14,
    }).start();

    if (open) {
      onOpenSheet();
      return;
    }

    onCloseSheet();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dy) > 8,
        onPanResponderGrant: () => {
          translateY.stopAnimation((value) => {
            dragStartRef.current = value;
          });
        },
        onPanResponderMove: (_event, gestureState) => {
          const nextValue = Math.max(
            0,
            Math.min(collapsedTranslate, dragStartRef.current + gestureState.dy),
          );
          translateY.setValue(nextValue);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const projected = dragStartRef.current + gestureState.dy;
          const shouldOpen =
            gestureState.dy < -32 ||
            (gestureState.vy < -0.4 && projected < collapsedTranslate * 0.85) ||
            projected < collapsedTranslate * 0.45;

          animateTo(shouldOpen);
        },
        onPanResponderTerminate: () => {
          animateTo(sheetOpen);
        },
      }),
    [collapsedTranslate, sheetOpen, translateY],
  );

  if (!currentTrack) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.sheetContainer,
        {
          top: topInset,
          bottom: sheetBottomInset,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.sheetCard}>
        <View style={styles.dragArea} {...panResponder.panHandlers}>
          <View style={styles.sheetHandle} />
          <Pressable style={styles.collapsedTopRow} onPress={() => animateTo(true)}>
            <View style={styles.collapsedArtwork}>
              <Text style={styles.collapsedArtworkText}>
                {currentTrack.title.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.collapsedMeta}>
              <Text style={styles.collapsedTitle} numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <Text style={styles.collapsedArtist} numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              style={styles.transportButton}
              onPress={(event) => {
                event.stopPropagation();
                onTogglePlayback();
              }}
            >
              <Text style={styles.transportText}>{isPlaying ? "Pause" : "Play"}</Text>
            </Pressable>
          </Pressable>
        </View>

        <View style={styles.expandedContent}>
          <View style={styles.sheetArtwork}>
            <Text style={styles.sheetArtworkText}>
              {currentTrack.title.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.sheetTitle} numberOfLines={2}>
            {currentTrack.title}
          </Text>
          <Text style={styles.sheetArtist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
          {currentTrack.context ? (
            <Text style={styles.sheetContext}>{currentTrack.context}</Text>
          ) : null}

          <View style={styles.transportRow}>
            <Pressable style={styles.sheetTransport} onPress={onPrevious}>
              <Text style={styles.sheetTransportText}>Prev</Text>
            </Pressable>
            <Pressable
              style={styles.sheetTransportPrimary}
              onPress={onTogglePlayback}
            >
              <Text style={styles.sheetTransportPrimaryText}>
                {isPlaying ? "Pause" : "Play"}
              </Text>
            </Pressable>
            <Pressable style={styles.sheetTransport} onPress={onNext}>
              <Text style={styles.sheetTransportText}>Next</Text>
            </Pressable>
          </View>

          <View style={styles.queueBlock}>
            <Text style={styles.queueTitle}>Queue</Text>
            {queue.map((track, index) => (
              <View
                key={`${track.id}-${index}`}
                style={[
                  styles.queueRow,
                  index === currentIndex && styles.queueRowActive,
                ]}
              >
                <Text
                  style={[
                    styles.queueTrack,
                    index === currentIndex && styles.queueTrackActive,
                  ]}
                  numberOfLines={1}
                >
                  {track.title}
                </Text>
                <Text style={styles.queueArtist} numberOfLines={1}>
                  {track.artist}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<MobilePlayerTrack[]>(DEFAULT_QUEUE);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentTrack = queue[currentIndex] || null;

  const value = useMemo<PlayerState>(
    () => ({
      currentTrack,
      queue,
      currentIndex,
      isPlaying,
      sheetOpen,
      playTrack: (track, nextQueue) => {
        const resolvedQueue = nextQueue && nextQueue.length ? nextQueue : queue;
        const nextIndex = resolvedQueue.findIndex((item) => item.id === track.id);
        setQueue(resolvedQueue);
        setCurrentIndex(nextIndex >= 0 ? nextIndex : 0);
        setIsPlaying(true);
      },
      togglePlayback: () => {
        setIsPlaying((current) => !current);
      },
      playNext: () => {
        setCurrentIndex((current) =>
          current + 1 >= queue.length ? 0 : current + 1,
        );
        setIsPlaying(true);
      },
      playPrevious: () => {
        setCurrentIndex((current) =>
          current - 1 < 0 ? Math.max(queue.length - 1, 0) : current - 1,
        );
        setIsPlaying(true);
      },
      openSheet: () => setSheetOpen(true),
      closeSheet: () => setSheetOpen(false),
    }),
    [currentTrack, currentIndex, isPlaying, queue, sheetOpen],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <PlayerChrome
        currentTrack={currentTrack}
        queue={queue}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        sheetOpen={sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onCloseSheet={() => setSheetOpen(false)}
        onTogglePlayback={() => setIsPlaying((current) => !current)}
        onPrevious={() => {
          setCurrentIndex((current) =>
            current - 1 < 0 ? Math.max(queue.length - 1, 0) : current - 1,
          );
          setIsPlaying(true);
        }}
        onNext={() => {
          setCurrentIndex((current) =>
            current + 1 >= queue.length ? 0 : current + 1,
          );
          setIsPlaying(true);
        }}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const value = useContext(PlayerContext);
  if (!value) {
    throw new Error("usePlayer must be used inside PlayerProvider");
  }
  return value;
}

const styles = StyleSheet.create({
  sheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 30,
  },
  sheetCard: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "#09090d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  dragArea: {
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 6,
    backgroundColor: "#0b0b10",
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginBottom: 10,
  },
  collapsedTopRow: {
    height: 62,
    borderRadius: 20,
    backgroundColor: "#111117",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
  },
  collapsedArtwork: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#1d1d23",
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedArtworkText: {
    color: AppTheme.text,
    fontSize: 16,
    fontWeight: "800",
  },
  collapsedMeta: {
    flex: 1,
    gap: 2,
  },
  collapsedTitle: {
    color: AppTheme.text,
    fontSize: 14,
    fontWeight: "800",
  },
  collapsedArtist: {
    color: AppTheme.textSoft,
    fontSize: 12,
  },
  transportButton: {
    minWidth: 58,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  transportText: {
    color: AppTheme.text,
    fontSize: 12,
    fontWeight: "800",
  },
  expandedContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },
  sheetArtwork: {
    width: 244,
    height: 244,
    borderRadius: 34,
    backgroundColor: "#18181f",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 22,
    marginTop: 8,
  },
  sheetArtworkText: {
    color: AppTheme.text,
    fontSize: 72,
    fontWeight: "800",
  },
  sheetTitle: {
    color: AppTheme.text,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  sheetArtist: {
    color: "#c9c3cf",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
  },
  sheetContext: {
    color: AppTheme.textSoft,
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
    textTransform: "uppercase",
  },
  transportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 28,
  },
  sheetTransport: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#121218",
  },
  sheetTransportPrimary: {
    flex: 1.2,
    height: 54,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.accent,
  },
  sheetTransportText: {
    color: AppTheme.text,
    fontSize: 14,
    fontWeight: "700",
  },
  sheetTransportPrimaryText: {
    color: AppTheme.text,
    fontSize: 15,
    fontWeight: "800",
  },
  queueBlock: {
    marginTop: 24,
    gap: 10,
  },
  queueTitle: {
    color: AppTheme.text,
    fontSize: 18,
    fontWeight: "800",
  },
  queueRow: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#111116",
    gap: 3,
  },
  queueRowActive: {
    backgroundColor: "#181820",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  queueTrack: {
    color: AppTheme.text,
    fontSize: 14,
    fontWeight: "700",
  },
  queueTrackActive: {
    color: AppTheme.accentSoft,
  },
  queueArtist: {
    color: AppTheme.textSoft,
    fontSize: 12,
  },
});
