import { Redirect, useRouter } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import type { RoomAnalysis } from "@home-kit/shared";
import { capitalize } from "../lib/format";
import { useSession } from "../state/session";
import { Button, Card, Chip, SectionTitle } from "../ui/components";
import { colors, radius, space } from "../ui/theme";

export default function AnalysisScreen() {
  const { state } = useSession();
  if (!state.analysis) return <Redirect href="/" />;
  return <AnalysisView analysis={state.analysis} photoUri={state.photoUri} />;
}

function AnalysisView({ analysis, photoUri }: { analysis: RoomAnalysis; photoUri: string | null }) {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} accessibilityLabel="Your room photo" /> : null}

      <View>
        <Text style={styles.title}>
          {capitalize(analysis.room_type)} · {analysis.current_style}
        </Text>
        <Text style={styles.body}>{analysis.summary}</Text>
      </View>

      {analysis.dominant_colors.length > 0 ? (
        <View>
          <SectionTitle>Colours I see</SectionTitle>
          <View style={styles.chips}>
            {analysis.dominant_colors.map((c) => (
              <Chip key={c} label={c} />
            ))}
          </View>
        </View>
      ) : null}

      {analysis.existing_furniture.length > 0 ? (
        <Card>
          <SectionTitle>What's in the room</SectionTitle>
          {analysis.existing_furniture.map((f) => (
            <View key={f.item} style={styles.furnitureRow}>
              <Text style={styles.furnitureName}>{capitalize(f.item)}</Text>
              <Text style={styles.muted}>
                {f.condition}
                {f.keep_candidate ? " · worth keeping?" : ""}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <BulletCard title="What could be better" items={analysis.problem_areas} />
      <BulletCard title="Opportunities" items={analysis.opportunities} />

      <Card>
        <SectionTitle>Lighting & layout</SectionTitle>
        <Text style={styles.body}>{analysis.lighting}</Text>
        <Text style={[styles.body, styles.gap]}>{analysis.layout_notes}</Text>
      </Card>

      {analysis.photo_limitations ? (
        <Text style={styles.muted}>Note: {analysis.photo_limitations}</Text>
      ) : null}

      <Button title="Looks right. Let's talk style" onPress={() => router.push("/chat")} />
    </ScrollView>
  );
}

function BulletCard({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {items.map((item) => (
        <Text key={item} style={styles.bullet}>
          • {item}
        </Text>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.border },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: space.sm },
  body: { fontSize: 16, lineHeight: 23, color: colors.text },
  gap: { marginTop: space.sm },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  furnitureRow: { paddingVertical: space.xs },
  furnitureName: { fontSize: 16, fontWeight: "600", color: colors.text },
  bullet: { fontSize: 15, lineHeight: 22, color: colors.text, marginBottom: space.xs },
});
