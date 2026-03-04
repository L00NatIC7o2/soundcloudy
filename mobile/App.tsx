import React, { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from "react-native";
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [host, setHost] = useState("");
  const [base, setBase] = useState("");
  const [scTokens, setScTokens] = useState<any>(null);
  const [playbackState, setPlaybackState] = useState<{
    playing?: boolean;
    track?: string;
    position?: number;
  }>({});
  const socketRef = useRef<Socket | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // load or create userId
  useEffect(() => {
    AsyncStorage.getItem("soundcloudy_user_id").then((id) => {
      if (id) setUserId(id);
      else {
        const newId = Math.random().toString(36).slice(2);
        AsyncStorage.setItem("soundcloudy_user_id", newId);
        setUserId(newId);
      }
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    // decide socket url from configured base (replace :3000 -> :3001)
    const socketBase = base || "http://<YOUR_COMPUTER_IP>:3000";
    const socketUrl = socketBase.replace(/:3000$/, ":3001");
    const s = io(socketUrl);
    socketRef.current = s;
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.emit("join", userId);

    s.on("playback-update", (state) => {
      setPlaybackState(state);
      // optionally sync local audio
    });
    s.on("remote-command", (command) => {
      if (command === "play")
        setPlaybackState((p) => ({ ...p, playing: true }));
      if (command === "pause")
        setPlaybackState((p) => ({ ...p, playing: false }));
    });

    return () => {
      s.disconnect();
    };
  }, [userId]);

  useEffect(() => {
    AsyncStorage.getItem("soundcloudy_tokens").then((t) => {
      if (t) setScTokens(JSON.parse(t));
    });
    AsyncStorage.getItem("soundcloudy_base").then((b) => {
      if (b) setBase(b);
    });
  }, []);

  const connectBridge = async () => {
    if (!base)
      return Alert.alert(
        "Set server base URL first (e.g. http://192.168.1.22:3000)",
      );
    try {
      const res = await fetch(`${base}/api/auth/bridge`, { method: "POST" });
      const json = await res.json();
      const code = json.connect_code;
      const startUrl = `${base}/api/auth/start?connect_code=${code}`;
      Linking.openURL(startUrl);

      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const c = await fetch(`${base}/api/auth/complete?connect_code=${code}`);
        if (c.status === 200) {
          const body = await c.json();
          await AsyncStorage.setItem(
            "soundcloudy_tokens",
            JSON.stringify(body.tokens),
          );
          setScTokens(body.tokens);
          Alert.alert("Connected to SoundCloud");
          break;
        }
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || String(err));
    }
  };

  const saveBase = async (b: string) => {
    setBase(b);
    await AsyncStorage.setItem("soundcloudy_base", b);
  };

  return (
    <View style={styles.container}>
      <Text>User ID: {userId}</Text>
      <Text>Socket: {connected ? "Connected" : "Disconnected"}</Text>
      <Text>
        Playback: {playbackState.track || "none"} /{" "}
        {playbackState.playing ? "playing" : "paused"}
      </Text>
      <View style={styles.buttons}>
        <TouchableOpacity
          onPress={() =>
            socketRef.current?.emit("remote-command", {
              userId,
              command: "prev",
            })
          }
          style={styles.button}
        >
          <Text>Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            socketRef.current?.emit("remote-command", {
              userId,
              command: playbackState.playing ? "pause" : "play",
            })
          }
          style={styles.button}
        >
          <Text>{playbackState.playing ? "Pause" : "Play"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            socketRef.current?.emit("remote-command", {
              userId,
              command: "next",
            })
          }
          style={styles.button}
        >
          <Text>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  buttons: { flexDirection: "row", marginTop: 20 },
  button: { padding: 10, backgroundColor: "#ddd", marginHorizontal: 5 },
});
