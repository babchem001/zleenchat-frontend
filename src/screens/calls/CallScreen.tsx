import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useTracks,
} from "@livekit/react-native";
import { Track } from "livekit-client";

import {
  endCall,
  getCallCredentials,
  leaveCall,
  markCallJoined,
} from "@/src/services/calls/callService";
import { useAuthStore } from "@/src/store/auth/authStorage";
import { useCallStore } from "@/src/store/call/callStore";

type CallView = {
  id?: string | number;
  callId?: string | number;
  type: "AUDIO" | "VIDEO";
  status: string;
  scope?: "DIRECT" | "GROUP";
  groupId?: number | null;
  group?: { name?: string | null };
  peer?: { username?: string | null };
  caller?: { id?: number; username?: string | null };
  callerId?: number;
  startedById?: number;
  participants?: Array<{
    userId: number | string;
    role: string;
  }>;
};

type JoinDetails = {
  serverUrl: string;
  participantToken: string;
};

const terminalStatuses = new Set([
  "DECLINED",
  "MISSED",
  "BUSY",
  "FAILED",
  "ENDED",
]);

export default function CallScreen() {
  const params = useLocalSearchParams<{ callId: string | string[] }>();
  const routeCallId = Array.isArray(params.callId)
    ? params.callId[0]
    : params.callId;

  const storedCall = useCallStore((state) => state.activeCall);
  const clearActiveCall = useCallStore((state) => state.clearActiveCall);
  const currentUserId = useAuthStore((state) => Number(state.user?.sub));
  const insets = useSafeAreaInsets();

  const call = storedCall as unknown as CallView | null;
  const rawCallId = call?.callId ?? call?.id ?? routeCallId ?? "";
  const callId = Number(rawCallId);
  const hasValidCallId = Number.isInteger(callId) && callId > 0;

  const [joinDetails, setJoinDetails] = useState<JoinDetails | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [mediaConnected, setMediaConnected] = useState(false);
  const [ending, setEnding] = useState(false);
  const [joinError, setJoinError] = useState("");
  const requestedTokenFor = useRef<string | null>(null);

  const readyToJoin = call?.status === "ACCEPTED" || call?.status === "ACTIVE";

  useEffect(() => {
    if (
      !hasValidCallId ||
      !readyToJoin ||
      requestedTokenFor.current === String(callId)
    ) {
      return;
    }

    let mounted = true;
    requestedTokenFor.current = String(callId);

    void getCallCredentials(callId)
      .then((credentials) => {
        if (!mounted) return;

        setJoinDetails({
          serverUrl: credentials.serverUrl,
          participantToken: credentials.participantToken,
        });
      })
      .catch((error: any) => {
        if (!mounted) return;

        console.warn("Could not get the LiveKit call token:", error);
        setJoinError(error?.message || "Could not connect to the call.");
      });

    return () => {
      mounted = false;
    };
  }, [callId, hasValidCallId, readyToJoin]);

  useEffect(() => {
    if (!joinDetails?.participantToken) {
      setAudioReady(false);
      return;
    }

    let mounted = true;

    void AudioSession.startAudioSession()
      .then(() => {
        if (mounted) setAudioReady(true);
      })
      .catch((error) => {
        console.warn("Could not start call audio:", error);
        if (mounted) setJoinError("Call audio could not start.");
      });

    return () => {
      mounted = false;
      void AudioSession.stopAudioSession().catch((error) => {
        console.warn("Could not stop the call audio session:", error);
      });
    };
  }, [joinDetails?.participantToken]);

  const handleConnected = useCallback(() => {
    if (!hasValidCallId) return;

    setMediaConnected(true);
    void markCallJoined(callId).catch((error) => {
      console.warn("Could not mark this participant as joined:", error);
    });
  }, [callId, hasValidCallId]);

  const handleHangUp = useCallback(async () => {
    if (!call || !hasValidCallId || ending) return;

    setEnding(true);

    const groupCall = call.groupId != null || call.scope === "GROUP";
    const callerParticipant = call.participants?.find(
      (participant) => Number(participant.userId) === currentUserId,
    );
    const callerId = Number(
      call.callerId ?? call.startedById ?? call.caller?.id,
    );
    const isCaller =
      callerParticipant?.role === "CALLER" || callerId === currentUserId;

    try {
      if (groupCall && !isCaller) {
        await leaveCall(callId);
      } else {
        await endCall(callId);
      }
    } catch (error) {
      console.warn("Could not update the call before leaving:", error);
    } finally {
      clearActiveCall();
      setEnding(false);

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    }
  }, [call, callId, clearActiveCall, currentUserId, ending, hasValidCallId]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (call && !terminalStatuses.has(call.status)) {
          void handleHangUp();
          return true;
        }
        return false;
      },
    );

    return () => backHandler.remove();
  }, [call, handleHangUp]);

  useEffect(() => {
    if (!call || !terminalStatuses.has(call.status)) return;

    const timer = setTimeout(() => {
      clearActiveCall();
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    }, 1200);

    return () => clearTimeout(timer);
  }, [call, clearActiveCall]);

  if (!call || !hasValidCallId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>This call is no longer available.</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.secondaryButton}
        >
          <Text style={styles.buttonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const title =
    call.group?.name ||
    call.peer?.username ||
    call.caller?.username ||
    (call.scope === "GROUP" || call.groupId != null
      ? "Group call"
      : "Zleenchat user");

  const terminal = terminalStatuses.has(call.status);
  const canConnect = readyToJoin && audioReady && Boolean(joinDetails);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <Text style={styles.callType}>
          {call.scope === "GROUP" || call.groupId != null
            ? "GROUP CALL"
            : call.type === "VIDEO"
              ? "VIDEO CALL"
              : "VOICE CALL"}
        </Text>
        <Text style={styles.title}>{title}</Text>
      </View>

      {canConnect && !terminal ? (
        <LiveKitRoom
          serverUrl={joinDetails!.serverUrl}
          token={joinDetails!.participantToken}
          connect
          audio
          video={call.type === "VIDEO"}
          options={{ adaptiveStream: { pixelDensity: "screen" } }}
          onConnected={handleConnected}
          onDisconnected={() => setMediaConnected(false)}
          onError={(error) => {
            console.warn("LiveKit room error:", error);
            setJoinError(
              "The call could not connect. You can hang up and try again.",
            );
          }}
        >
          <RoomControls
            title={title}
            type={call.type}
            connected={mediaConnected}
            onHangUp={handleHangUp}
            ending={ending}
            bottomInset={insets.bottom}
          />
        </LiveKitRoom>
      ) : (
        <View style={styles.waitingArea}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {title.charAt(0).toUpperCase() || "Z"}
            </Text>
          </View>

          <Text style={styles.status}>
            {terminal
              ? call.status === "MISSED"
                ? "No answer"
                : call.status === "DECLINED"
                  ? "Call declined"
                  : "Call ended"
              : joinError ||
                (call.status === "RINGING"
                  ? "Calling…"
                  : call.status === "ACTIVE"
                    ? "Connecting…"
                    : "Waiting for answer…")}
          </Text>

          {!terminal && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="End call"
              disabled={ending}
              onPress={handleHangUp}
              style={styles.hangupButton}
            >
              {ending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons
                  name="call"
                  size={25}
                  color="#FFFFFF"
                  style={styles.hangupIcon}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function RoomControls({
  title,
  type,
  connected,
  onHangUp,
  ending,
  bottomInset,
}: {
  title: string;
  type: "AUDIO" | "VIDEO";
  connected: boolean;
  onHangUp: () => void;
  ending: boolean;
  bottomInset: number;
}) {
  const tracks = useTracks([Track.Source.Camera]);
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant();

  const [speakerEnabled, setSpeakerEnabled] = useState(false);
  const [frontCamera, setFrontCamera] = useState(true);

  const remoteVideoTracks = tracks.filter(
    (track) => isTrackReference(track) && !track.participant.isLocal,
  );
  const localVideoTrack = tracks.find(
    (track) => isTrackReference(track) && track.participant.isLocal,
  );

  const toggleMicrophone = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (error) {
      Alert.alert("Microphone unavailable", "Check microphone permission.");
      console.warn(error);
    }
  };

  const toggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (error) {
      Alert.alert("Camera unavailable", "Check camera permission.");
      console.warn(error);
    }
  };

  const flipCamera = async () => {
    const nextFacingMode = frontCamera ? "environment" : "user";

    try {
      await localParticipant.setCameraEnabled(false);
      await localParticipant.setCameraEnabled(true, {
        facingMode: nextFacingMode,
      });
      setFrontCamera(!frontCamera);
    } catch (error) {
      console.warn("Could not switch cameras:", error);
    }
  };

  const toggleSpeaker = async () => {
    const nextSpeakerEnabled = !speakerEnabled;

    try {
      const outputs = await AudioSession.getAudioOutputs();
      const target =
        Platform.OS === "ios"
          ? nextSpeakerEnabled
            ? "force_speaker"
            : "default"
          : nextSpeakerEnabled
            ? "speaker"
            : "earpiece";

      if (!outputs.includes(target)) {
        Alert.alert(
          "Audio output unavailable",
          "That audio route is unavailable.",
        );
        return;
      }

      await AudioSession.selectAudioOutput(target);
      setSpeakerEnabled(nextSpeakerEnabled);
    } catch (error) {
      console.warn("Could not change the audio route:", error);
    }
  };

  return (
    <View style={styles.room}>
      {type === "VIDEO" ? (
        <View style={styles.videoStage}>
          {remoteVideoTracks.length ? (
            <View style={styles.remoteGrid}>
              {remoteVideoTracks.map((track) =>
                isTrackReference(track) ? (
                  <View
                    key={track.participant.identity}
                    style={styles.remoteTile}
                  >
                    <VideoTrack trackRef={track} style={styles.video} />
                  </View>
                ) : null,
              )}
            </View>
          ) : (
            <View style={styles.videoWaiting}>
              <Text style={styles.waitingText}>
                {connected ? "Waiting for video…" : "Connecting…"}
              </Text>
            </View>
          )}

          {localVideoTrack &&
            isTrackReference(localVideoTrack) &&
            isCameraEnabled && (
              <View style={styles.localTile}>
                <VideoTrack trackRef={localVideoTrack} style={styles.video} />
              </View>
            )}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
            onPress={flipCamera}
            style={styles.flipButton}
          >
            <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.voiceStage}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {title.charAt(0).toUpperCase() || "Z"}
            </Text>
          </View>
          <Text style={styles.status}>
            {connected ? "Connected" : "Connecting…"}
          </Text>
        </View>
      )}

      <View
        style={[styles.controls, { paddingBottom: Math.max(bottomInset, 20) }]}
      >
        <ControlButton
          icon={isMicrophoneEnabled ? "mic" : "mic-off"}
          label={isMicrophoneEnabled ? "Mute" : "Unmute"}
          onPress={toggleMicrophone}
        />

        <ControlButton
          icon={speakerEnabled ? "volume-high" : "volume-medium"}
          label="Speaker"
          onPress={toggleSpeaker}
        />

        {type === "VIDEO" && (
          <ControlButton
            icon={isCameraEnabled ? "videocam" : "videocam-off"}
            label={isCameraEnabled ? "Camera" : "Camera off"}
            onPress={toggleCamera}
          />
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="End call"
          disabled={ending}
          onPress={onHangUp}
          style={styles.hangupButton}
        >
          {ending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons
              name="call"
              size={24}
              color="#FFFFFF"
              style={styles.hangupIcon}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ControlButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.controlItem}
    >
      <View style={styles.controlCircle}>
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#10182E" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10182E",
    padding: 24,
  },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 14,
    alignItems: "center",
  },
  callType: {
    color: "#B7C5E5",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    marginTop: 7,
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  waitingArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
  },
  avatar: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#26375F",
  },
  avatarText: { color: "#FFFFFF", fontSize: 52, fontWeight: "800" },
  status: { marginTop: 20, color: "#DCE6FF", fontSize: 17 },
  message: { color: "#FFFFFF", fontSize: 16, textAlign: "center" },
  secondaryButton: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: "#33415F",
  },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
  room: { flex: 1 },
  videoStage: { flex: 1, backgroundColor: "#18233D" },
  remoteGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignContent: "center",
    gap: 4,
  },
  remoteTile: {
    width: "49%",
    height: "49%",
    overflow: "hidden",
    backgroundColor: "#1A2745",
  },
  video: { flex: 1 },
  videoWaiting: { flex: 1, alignItems: "center", justifyContent: "center" },
  waitingText: { color: "#DCE6FF", fontSize: 16 },
  localTile: {
    position: "absolute",
    right: 18,
    top: 18,
    width: 105,
    height: 150,
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  flipButton: {
    position: "absolute",
    right: 24,
    bottom: 20,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  voiceStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 36,
  },
  controls: {
    minHeight: 122,
    paddingTop: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 14,
    backgroundColor: "#10182E",
  },
  controlItem: { minWidth: 58, alignItems: "center" },
  controlCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#33415F",
  },
  controlLabel: { marginTop: 7, color: "#E2E8F0", fontSize: 11 },
  hangupButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
  },
  hangupIcon: { transform: [{ rotate: "135deg" }] },
});
