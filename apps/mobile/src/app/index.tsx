import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, errorMessage } from "../api/client";
import { preparePhoto, type PreparedPhoto } from "../lib/image";
import { useSession } from "../state/session";
import { Button, ErrorBanner, Loading } from "../ui/components";
import { colors, radius, space } from "../ui/theme";

type Stage = "idle" | "preparing" | "analyzing";

export default function PhotoScreen() {
  const router = useRouter();
  const { state, dispatch } = useSession();
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  // "Start over" clears the session; clear the locally held photo with it.
  useEffect(() => {
    if (!state.photoUri) setPhoto(null);
  }, [state.photoUri]);

  async function choose(source: "camera" | "library") {
    setError(null);
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError("Camera access is turned off. Enable it in Settings, or choose a photo from your library.");
          return;
        }
      }
      const launch = source === "camera" ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await launch({ mediaTypes: ["images"], quality: 1 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      setStage("preparing");
      setPhoto(await preparePhoto(asset.uri, asset.width, asset.height));
    } catch {
      setError("We couldn't open that photo. Please try another one.");
    } finally {
      setStage("idle");
    }
  }

  async function analyze() {
    if (!photo) return;
    setError(null);
    setStage("analyzing");
    try {
      const { analysis } = await api.analyzeRoom(photo.upload);
      if (!analysis.is_room_photo) {
        setError("That doesn't look like a photo of a room. Try another one.");
        return;
      }
      dispatch({ type: "roomAnalyzed", photoUri: photo.previewUri, analysis });
      router.push("/analysis");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStage("idle");
    }
  }

  if (stage === "analyzing") {
    return <Loading title="Looking at your room…" detail="We're checking the layout, light and furniture." />;
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Redesign your room</Text>
      <Text style={styles.subtitle}>
        Take a photo, tell us what you like, and get a design with products you can actually buy.
      </Text>

      {photo ? (
        <Image source={{ uri: photo.previewUri }} style={styles.preview} accessibilityLabel="Your room photo" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Your room photo will appear here</Text>
        </View>
      )}

      {error ? <ErrorBanner message={error} onRetry={photo ? analyze : undefined} /> : null}

      {photo ? <Button title="Analyze my room" onPress={analyze} /> : null}

      {/* Two full-width buttons to start; once there's a photo, compact side-by-side options. */}
      <View style={photo ? styles.row : styles.column}>
        <Button
          title={photo ? "Retake photo" : "Take a photo"}
          variant={photo ? "secondary" : "primary"}
          onPress={() => choose("camera")}
          loading={stage === "preparing"}
          style={photo ? styles.flex : undefined}
        />
        <Button
          title={photo ? "From library" : "Choose from library"}
          variant="secondary"
          onPress={() => choose("library")}
          disabled={stage === "preparing"}
          style={photo ? styles.flex : undefined}
        />
      </View>

      <Text style={styles.footnote}>Your photo is sent to our AI service so it can analyze your room.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg },
  title: { fontSize: 30, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 16, lineHeight: 23, color: colors.muted },
  preview: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    backgroundColor: colors.border,
  },
  placeholder: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: { color: colors.muted },
  row: { flexDirection: "row", gap: space.md },
  column: { gap: space.md },
  flex: { flex: 1 },
  footnote: { fontSize: 12, color: colors.muted, textAlign: "center" },
});
