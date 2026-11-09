import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  AppState,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

export type VoiceNoteAttachment = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  duration: number;
  waveform: number[] | null;
  contentType: "AUDIO";
};

type Props = {
  disabled?: boolean;
  onRecordingChange: (recording: boolean) => void;
  onRecorded: (attachment: VoiceNoteAttachment) => void;
};

const buildWaveform = (samples: number[]): number[] | null => {
  if (samples.length === 0) {
    return null;
  }

  const barCount = 40;

  return Array.from({ length: barCount }, (_, index) => {
    const start = Math.floor((index * samples.length) / barCount);
    const end = Math.max(
      start + 1,
      Math.floor(((index + 1) * samples.length) / barCount),
    );

    if (start >= samples.length) {
      return 0;
    }

    const values = samples.slice(start, Math.min(end, samples.length));
    return Math.max(...values);
  });
};

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const getAudioMimeType = (extension: string) => {
  switch (extension) {
    case "webm":
      return "audio/webm";
    case "3gp":
      return "audio/3gpp";
    case "wav":
      return "audio/wav";
    case "aac":
      return "audio/aac";
    case "mp3":
      return "audio/mpeg";
    default:
      return "audio/mp4";
  }
};

export default function VoiceNoteRecorder({
  disabled = false,
  onRecordingChange,
  onRecorded,
}: Props) {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, 100);

  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchActive = useRef(false);
  const starting = useRef(false);
  const recording = useRef(false);
  const locked = useRef(false);
  const cancelRequested = useRef(false);
  const meterSamples = useRef<number[]>([]);

  useEffect(() => {
    if (!isRecording || typeof recorderState.metering !== "number") {
      return;
    }

    const normalized = Math.max(
      0,
      Math.min(1, (recorderState.metering + 60) / 60),
    );

    meterSamples.current.push(normalized);
    setLiveWaveform(meterSamples.current.slice(-40));
  }, [isRecording, recorderState.metering]);

  const startRecording = useCallback(async () => {
    if (disabled || starting.current || recording.current) {
      return;
    }

    starting.current = true;

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted || !touchActive.current) {
        if (!permission.granted) {
          Alert.alert(
            "Microphone permission required",
            "Allow Zleenchat to use the microphone to record a voice message.",
          );
        }
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();

      if (!touchActive.current) {
        return;
      }

      meterSamples.current = [];
      setLiveWaveform([]);

      recorder.record();
      recording.current = true;
      setIsRecording(true);
      onRecordingChange(true);
    } catch (error) {
      console.error("VOICE NOTE RECORDING START ERROR:", error);
      Alert.alert("Recording failed", "Zleenchat could not start recording.");
    } finally {
      starting.current = false;
    }
  }, [disabled, onRecordingChange, recorder]);

  const finishRecording = useCallback(async () => {
    if (!recording.current) {
      return;
    }

    recording.current = false;

    try {
      await recorder.stop();

      const finalStatus = recorder.getStatus();
      const sourceUri = recorder.uri;

      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      if (!sourceUri) {
        throw new Error("The recorder did not return an audio file.");
      }

      const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
      const size =
        sourceInfo.exists &&
        "size" in sourceInfo &&
        typeof sourceInfo.size === "number"
          ? sourceInfo.size
          : 0;
      const duration = Math.round(
        finalStatus.durationMillis || recorderState.durationMillis,
      );

      if (size <= 0 || duration < 300) {
        await FileSystem.deleteAsync(sourceUri, { idempotent: true });
        Alert.alert(
          "Voice message too short",
          "Record a little longer before sending.",
        );
        return;
      }

      const sourcePath = sourceUri.split("?")[0];
      const extension =
        sourcePath.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || "m4a";
      const name = `voice-${Date.now()}-${Math.round(
        Math.random() * 1e9,
      )}.${extension}`;

      const documentDirectory = FileSystem.documentDirectory;
      if (!documentDirectory) {
        throw new Error("The app document directory is unavailable.");
      }

      const voiceNotesDirectory = `${documentDirectory}voice-notes/`;
      await FileSystem.makeDirectoryAsync(voiceNotesDirectory, {
        intermediates: true,
      });

      const persistentUri = `${voiceNotesDirectory}${name}`;
      await FileSystem.moveAsync({
        from: sourceUri,
        to: persistentUri,
      });

      onRecorded({
        uri: persistentUri,
        name,
        mimeType: getAudioMimeType(extension),
        size,
        duration,
        waveform: buildWaveform(meterSamples.current),
        contentType: "AUDIO",
      });
    } catch (error) {
      console.error("VOICE NOTE RECORDING STOP ERROR:", error);
      Alert.alert(
        "Recording failed",
        "Zleenchat could not save the recording.",
      );
    } finally {
      setIsRecording(false);
      setIsLocked(false);
      setCancelArmed(false);
      locked.current = false;
      cancelRequested.current = false;
      onRecordingChange(false);
    }
  }, [onRecorded, onRecordingChange, recorder, recorderState.durationMillis]);

  const cancelRecording = useCallback(async () => {
    const wasRecording = recording.current;
    recording.current = false;

    try {
      if (wasRecording) {
        await recorder.stop();
      }

      const uri = recorder.uri;
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }

      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    } catch (error) {
      console.error("VOICE NOTE RECORDING CANCEL ERROR:", error);
    } finally {
      setIsRecording(false);
      setIsLocked(false);
      setCancelArmed(false);
      locked.current = false;
      cancelRequested.current = false;
      onRecordingChange(false);
    }
  }, [onRecordingChange, recorder]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && !recording.current,
        onPanResponderGrant: () => {
          touchActive.current = true;
          locked.current = false;
          cancelRequested.current = false;
          setIsLocked(false);
          setCancelArmed(false);

          holdTimer.current = setTimeout(() => {
            void startRecording();
          }, 250);
        },
        onPanResponderMove: (_event, gesture) => {
          if (!recording.current) {
            return;
          }

          if (gesture.dx < -90) {
            cancelRequested.current = true;
            setCancelArmed(true);
            return;
          }

          if (gesture.dy < -90) {
            locked.current = true;
            setIsLocked(true);
          }
        },
        onPanResponderRelease: () => {
          touchActive.current = false;

          if (holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
          }

          if (!recording.current) {
            return;
          }

          if (cancelRequested.current) {
            void cancelRecording();
          } else if (!locked.current) {
            void finishRecording();
          }
        },
        onPanResponderTerminate: () => {
          touchActive.current = false;

          if (holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
          }

          if (recording.current && !locked.current) {
            void cancelRecording();
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [cancelRecording, disabled, finishRecording, startRecording],
  );

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && recording.current) {
        void cancelRecording();
      }
    });

    return () => subscription.remove();
  }, [cancelRecording, isRecording]);

  useEffect(
    () => () => {
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
      }

      if (recording.current) {
        void recorder.stop();
      }
    },
    [recorder],
  );

  return (
    <View
      {...panResponder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={
        isRecording
          ? "Recording voice message"
          : "Press and hold to record a voice message"
      }
      style={[
        styles.container,
        isRecording ? styles.recordingContainer : styles.micButton,
      ]}
    >
      {!isRecording ? (
        <Ionicons name="mic" size={23} color="#FFFFFF" />
      ) : (
        <>
          {isLocked && (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => void cancelRecording()}
              accessibilityLabel="Discard voice message"
            >
              <Ionicons name="trash-outline" size={21} color="#EF4444" />
            </TouchableOpacity>
          )}

          <View style={styles.recordingInfo}>
            <Text style={styles.recordingLabel}>
              {cancelArmed
                ? "Release to discard"
                : isLocked
                  ? "Recording"
                  : "Slide up to lock · left to cancel"}
            </Text>

            <View style={styles.waveform}>
              {liveWaveform.map((value, index) => (
                <View
                  key={index}
                  style={[
                    styles.waveBar,
                    { height: Math.max(4, Math.round(value * 22)) },
                  ]}
                />
              ))}
            </View>
          </View>

          <Text style={styles.timer}>
            {formatDuration(recorderState.durationMillis)}
          </Text>

          {isLocked && (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => void finishRecording()}
              accessibilityLabel="Stop recording"
            >
              <Ionicons name="stop-circle" size={27} color="#2563EB" />
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2563EB",
  },
  recordingContainer: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    paddingHorizontal: 8,
    borderRadius: 24,
    backgroundColor: "#FFF1F2",
  },
  recordingInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  recordingLabel: {
    color: "#64748B",
    fontSize: 10,
    marginBottom: 2,
  },
  waveform: {
    height: 23,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    marginRight: 2,
    backgroundColor: "#EF4444",
  },
  timer: {
    marginHorizontal: 8,
    color: "#18181B",
    fontVariant: ["tabular-nums"],
  },
  controlButton: {
    width: 36,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
