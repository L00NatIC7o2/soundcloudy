import React, {
  createContext,
  useContext,
  useCallback,
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
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppTheme } from "./app-theme";

export type MobilePlayerTrack = {
  id: number;
  title: string;
  artist: string;
  artworkUrl?: string | null;
  context?: string;
  userId?: number;
  isLiked?: boolean;
};

type PlayerControls = {
  togglePlayback: () => void;
  playNext: () => void;
  playPrevious: () => void;
  switchOutput?: () => void;
  toggleLike?: () => void;
};

type PlayerState = {
  currentTrack: MobilePlayerTrack | null;
  queue: MobilePlayerTrack[];
  currentIndex: number;
  isPlaying: boolean;
  sheetOpen: boolean;
  playTrack: (track: MobilePlayerTrack, queue?: MobilePlayerTrack[]) => void;
  syncPlayback: (
    track: MobilePlayerTrack | null,
    isPlaying: boolean,
    queue?: MobilePlayerTrack[],
    currentIndex?: number,
  ) => void;
  registerControls: (controls: PlayerControls | null) => void;
  togglePlayback: () => void;
  playNext: () => void;
  playPrevious: () => void;
  openSheet: () => void;
  closeSheet: () => void;
};

const PlayerContext = createContext<PlayerState | null>(null);

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
  onSwitchOutput,
  onToggleLike,
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
  onSwitchOutput: () => void;
  onToggleLike: () => void;
}) {
  const collapsedHeight = 60;
  const insets = useSafeAreaInsets();
  const navHeight = 62 + insets.bottom;
  const topInset = 0;
  const sheetBottomInset = navHeight + 6;
  const { height } = useWindowDimensions();
  const availableHeight = Math.max(
    height - topInset - sheetBottomInset,
    collapsedHeight,
  );
  const collapsedTranslate = Math.max(availableHeight - collapsedHeight, 0);
  const [translateY] = useState(
    () => new Animated.Value(collapsedTranslate),
  );
  const dragStart = useMemo(
    () => ({ value: collapsedTranslate }),
    [collapsedTranslate],
  );

  useEffect(() => {
    if (!currentTrack) {
      return;
    }

    translateY.setValue(sheetOpen ? 0 : collapsedTranslate);
  }, [collapsedTranslate, currentTrack, sheetOpen, translateY]);

  const animateTo = useCallback(
    (open: boolean) => {
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
    },
    [collapsedTranslate, onCloseSheet, onOpenSheet, translateY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dy) > 8,
        onPanResponderGrant: () => {
          translateY.stopAnimation((value) => {
            dragStart.value = value;
          });
        },
        onPanResponderMove: (_event, gestureState) => {
          const nextValue = Math.max(
            0,
            Math.min(collapsedTranslate, dragStart.value + gestureState.dy),
          );
          translateY.setValue(nextValue);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const projected = dragStart.value + gestureState.dy;
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
    [animateTo, collapsedTranslate, dragStart, sheetOpen, translateY],
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
          {sheetOpen ? <View style={styles.sheetHandle} /> : null}
          <Pressable style={styles.collapsedTopRow} onPress={() => animateTo(true)}>
            {currentTrack.artworkUrl ? (
              <Image
                source={{ uri: currentTrack.artworkUrl }}
                style={styles.collapsedArtwork}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.collapsedArtwork, styles.artworkFallback]}>
                <Text style={styles.collapsedArtworkText}>♪</Text>
              </View>
            )}
            <View style={styles.collapsedMeta}>
              <Text style={styles.collapsedTitle} numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <Text style={styles.collapsedArtist} numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </View>
            <View style={styles.collapsedActions}>
              <Pressable
                hitSlop={8}
                style={styles.iconButton}
                onPress={(event) => {
                  event.stopPropagation();
                  onSwitchOutput();
                }}
                accessibilityLabel="Switch playback device"
              >
                <Ionicons
                  name={
                    currentTrack.context?.includes("desktop")
                      ? "phone-portrait-outline"
                      : "tv-outline"
                  }
                  size={19}
                  color={AppTheme.textSoft}
                />
              </Pressable>
              <Pressable
                hitSlop={8}
                style={styles.iconButton}
                onPress={(event) => {
                  event.stopPropagation();
                  onToggleLike();
                }}
                accessibilityLabel={currentTrack.isLiked ? "Unlike track" : "Like track"}
              >
                <Ionicons
                  name={currentTrack.isLiked ? "heart" : "heart-outline"}
                  size={20}
                  color={currentTrack.isLiked ? "#ff5a6e" : AppTheme.textSoft}
                />
              </Pressable>
            </View>
            <Pressable
              hitSlop={10}
              style={styles.transportButton}
              onPress={(event) => {
                event.stopPropagation();
                onTogglePlayback();
              }}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={23}
                color={AppTheme.text}
              />
            </Pressable>
          </Pressable>
        </View>

        <View style={styles.expandedContent}>
          {currentTrack.artworkUrl ? (
            <Image
              source={{ uri: currentTrack.artworkUrl }}
              style={styles.sheetArtwork}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.sheetArtwork, styles.artworkFallback]}>
              <Text style={styles.sheetArtworkText}>♪</Text>
            </View>
          )}
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
              <Ionicons name="play-skip-back" size={23} color={AppTheme.text} />
            </Pressable>
            <Pressable
              style={styles.sheetTransportPrimary}
              onPress={onTogglePlayback}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={25}
                color="#fff"
              />
            </Pressable>
            <Pressable style={styles.sheetTransport} onPress={onNext}>
              <Ionicons name="play-skip-forward" size={23} color={AppTheme.text} />
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
  const [queue, setQueue] = useState<MobilePlayerTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const controlsRef = useRef<PlayerControls | null>(null);

  const currentTrack = queue[currentIndex] || null;

  const syncPlayback = useCallback(
    (
      track: MobilePlayerTrack | null,
      playing: boolean,
      nextQueue?: MobilePlayerTrack[],
      index = 0,
    ) => {
      if (!track) {
        setQueue([]);
        setCurrentIndex(0);
        setIsPlaying(false);
        return;
      }

      const resolvedQueue = nextQueue?.length ? nextQueue : [track];
      const safeIndex = Math.max(0, Math.min(index, resolvedQueue.length - 1));
      const selectedQueue = resolvedQueue.map((item, itemIndex) =>
        itemIndex === safeIndex ? track : item,
      );
      setQueue((current) => {
        const unchanged =
          current.length === selectedQueue.length &&
          current.every(
            (item, itemIndex) =>
              item.id === selectedQueue[itemIndex]?.id &&
              item.title === selectedQueue[itemIndex]?.title &&
              item.artist === selectedQueue[itemIndex]?.artist &&
              item.artworkUrl === selectedQueue[itemIndex]?.artworkUrl &&
              item.isLiked === selectedQueue[itemIndex]?.isLiked &&
              item.context === selectedQueue[itemIndex]?.context,
          );
        return unchanged ? current : selectedQueue;
      });
      setCurrentIndex((current) => (current === safeIndex ? current : safeIndex));
      setIsPlaying((current) => (current === playing ? current : playing));
    },
    [],
  );
  const registerControls = useCallback((controls: PlayerControls | null) => {
    controlsRef.current = controls;
  }, []);

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
      syncPlayback,
      registerControls,
      togglePlayback: () => {
        if (controlsRef.current) {
          controlsRef.current.togglePlayback();
          return;
        }
        setIsPlaying((current) => !current);
      },
      playNext: () => {
        if (controlsRef.current) {
          controlsRef.current.playNext();
          return;
        }
        setCurrentIndex((current) =>
          current + 1 >= queue.length ? 0 : current + 1,
        );
        setIsPlaying(true);
      },
      playPrevious: () => {
        if (controlsRef.current) {
          controlsRef.current.playPrevious();
          return;
        }
        setCurrentIndex((current) =>
          current - 1 < 0 ? Math.max(queue.length - 1, 0) : current - 1,
        );
        setIsPlaying(true);
      },
      openSheet: () => setSheetOpen(true),
      closeSheet: () => setSheetOpen(false),
    }),
    [currentTrack, currentIndex, isPlaying, queue, registerControls, sheetOpen, syncPlayback],
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
        onTogglePlayback={() => {
          if (controlsRef.current) {
            controlsRef.current.togglePlayback();
            return;
          }
          setIsPlaying((current) => !current);
        }}
        onPrevious={() => {
          if (controlsRef.current) {
            controlsRef.current.playPrevious();
            return;
          }
          setCurrentIndex((current) =>
            current - 1 < 0 ? Math.max(queue.length - 1, 0) : current - 1,
          );
          setIsPlaying(true);
        }}
        onNext={() => {
          if (controlsRef.current) {
            controlsRef.current.playNext();
            return;
          }
          setCurrentIndex((current) =>
            current + 1 >= queue.length ? 0 : current + 1,
          );
          setIsPlaying(true);
        }}
        onSwitchOutput={() => {
          if (controlsRef.current?.switchOutput) {
            controlsRef.current.switchOutput();
          } else {
            setSheetOpen(true);
          }
        }}
        onToggleLike={() => {
          if (controlsRef.current?.toggleLike) {
            controlsRef.current.toggleLike();
          }
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
    paddingTop: 2,
    paddingHorizontal: 8,
    paddingBottom: 2,
    backgroundColor: "rgba(12,12,15,0.98)",
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
    height: 56,
    borderRadius: 12,
    backgroundColor: "#0d0d10",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
    gap: 9,
  },
  collapsedArtwork: {
    width: 40,
    height: 40,
    borderRadius: 9,
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
  artworkFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  iconButton: {
    width: 30,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  transportButton: {
    minWidth: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
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
