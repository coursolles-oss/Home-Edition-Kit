import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import type { BriefItem, DesignBrief } from "@home-kit/shared";
import { api, errorMessage } from "../api/client";
import { formatUsd } from "../lib/format";
import { useSession } from "../state/session";
import { Button, Card, ErrorBanner, Loading, Notice, SectionTitle } from "../ui/components";
import { colors, radius, space } from "../ui/theme";

export default function BriefScreen() {
  const { state } = useSession();
  if (!state.analysis) return <Redirect href="/" />;
  return <BriefView />;
}

function BriefView() {
  const router = useRouter();
  const { state, dispatch } = useSession();
  const [loading, setLoading] = useState(!state.brief);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const generate = useCallback(async () => {
    if (!state.analysis) return;
    setLoading(true);
    setError(null);
    try {
      const brief = await api.brief({ analysis: state.analysis, profile: state.profile, messages: state.messages });
      dispatch({ type: "briefReady", brief });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [state.analysis, state.profile, state.messages, dispatch]);

  useEffect(() => {
    if (state.brief || startedRef.current) return;
    startedRef.current = true;
    void generate();
  }, [state.brief, generate]);

  function startOver() {
    dispatch({ type: "reset" });
    router.dismissAll();
  }

  if (loading) {
    return (
      <Loading
        title="Designing your room…"
        detail="We're drafting a plan and choosing products. This can take up to a minute."
      />
    );
  }

  if (!state.brief) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <ErrorBanner message={error ?? "We couldn't create your design."} onRetry={generate} />
      </ScrollView>
    );
  }

  return <BriefContent brief={state.brief} onStartOver={startOver} />;
}

function BriefContent({ brief, onStartOver }: { brief: DesignBrief; onStartOver: () => void }) {
  const [linkError, setLinkError] = useState(false);
  const essentials = brief.items.filter((i) => i.priority === "essential");
  const extras = brief.items.filter((i) => i.priority !== "essential");
  const overBy = brief.budget_usd != null ? brief.total_cost_usd - brief.budget_usd : 0;

  function openLink(url: string) {
    setLinkError(false);
    Linking.openURL(url).catch(() => setLinkError(true));
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {brief.catalog.is_sample_data ? (
        <Notice>
          Sample catalog: the products, prices and links below are placeholders while real retailers are connected.
        </Notice>
      ) : null}

      <View>
        <Text style={styles.concept}>{brief.concept_name}</Text>
        <Text style={styles.body}>{brief.style_summary}</Text>
      </View>

      <View>
        <SectionTitle>Palette</SectionTitle>
        <View style={styles.palette}>
          {brief.palette.map((c) => (
            <View key={`${c.name}-${c.hex}`} style={styles.swatchWrap}>
              <View style={[styles.swatch, { backgroundColor: c.hex }]} accessibilityLabel={`${c.name} ${c.hex}`} />
              <Text style={styles.swatchLabel}>{c.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {brief.layout_suggestions.length > 0 ? (
        <Card>
          <SectionTitle>Layout ideas</SectionTitle>
          {brief.layout_suggestions.map((s, i) => (
            <Text key={s} style={styles.bullet}>
              {i + 1}. {s}
            </Text>
          ))}
        </Card>
      ) : null}

      <ItemGroup title="Essentials" items={essentials} onOpen={openLink} />
      <ItemGroup title="Nice to have" items={extras} onOpen={openLink} />

      {linkError ? <ErrorBanner message="Couldn't open that link." /> : null}

      <Card>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Estimated total</Text>
          <Text style={styles.totalValue}>{formatUsd(brief.total_cost_usd)}</Text>
        </View>
        {brief.budget_usd != null ? (
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Your budget</Text>
            <Text style={styles.muted}>{formatUsd(brief.budget_usd)}</Text>
          </View>
        ) : null}
        {brief.over_budget ? (
          <View style={styles.gap}>
            <Notice>This comes to {formatUsd(overBy)} over your budget. Drop a "nice to have" or swap in a cheaper option.</Notice>
          </View>
        ) : null}
      </Card>

      {brief.closing_note ? <Text style={styles.body}>{brief.closing_note}</Text> : null}

      {brief.catalog.affiliate_disclosure ? (
        <Text style={styles.muted}>{brief.catalog.affiliate_disclosure}</Text>
      ) : null}

      <Button title="Start over" variant="secondary" onPress={onStartOver} />
    </ScrollView>
  );
}

function ItemGroup({ title, items, onOpen }: { title: string; items: BriefItem[]; onOpen: (url: string) => void }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.group}>
      <SectionTitle>{title}</SectionTitle>
      {items.map((item) => (
        <ItemCard key={item.slot_id} item={item} onOpen={onOpen} />
      ))}
    </View>
  );
}

function ItemCard({ item, onOpen }: { item: BriefItem; onOpen: (url: string) => void }) {
  const { product } = item;
  return (
    <Card style={!product && styles.cardMissing}>
      <View style={styles.itemHeader}>
        {product?.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.thumb} accessibilityLabel={product.name} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbLetter}>{item.label.charAt(0)}</Text>
          </View>
        )}
        <View style={styles.flex}>
          <Text style={styles.slotLabel}>{item.label}</Text>
          {product ? (
            <>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.muted}>
                {product.brand} · {product.retailer}
              </Text>
            </>
          ) : (
            <Text style={styles.muted}>No match found yet</Text>
          )}
        </View>
        {product ? <Text style={styles.price}>{formatUsd(product.price_usd)}</Text> : null}
      </View>

      <Text style={styles.rationale}>{item.rationale}</Text>

      {product ? (
        <Button
          title={`View at ${product.retailer}`}
          variant="secondary"
          onPress={() => onOpen(product.url)}
          style={styles.gap}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },
  concept: { fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: space.sm },
  body: { fontSize: 16, lineHeight: 23, color: colors.text },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  gap: { marginTop: space.md },
  bullet: { fontSize: 15, lineHeight: 22, color: colors.text, marginBottom: space.xs },

  palette: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  swatchWrap: { alignItems: "center", gap: space.xs, width: 64 },
  swatch: { width: 48, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  swatchLabel: { fontSize: 12, color: colors.muted, textAlign: "center" },

  group: { gap: space.md },
  cardMissing: { backgroundColor: colors.bg, borderStyle: "dashed" },
  itemHeader: { flexDirection: "row", gap: space.md, alignItems: "center" },
  thumb: { width: 56, height: 56, borderRadius: radius.md },
  thumbPlaceholder: { backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  thumbLetter: { fontSize: 22, fontWeight: "700", color: colors.accent },
  slotLabel: { fontSize: 12, fontWeight: "700", color: colors.accent, textTransform: "uppercase", letterSpacing: 0.6 },
  productName: { fontSize: 16, fontWeight: "600", color: colors.text },
  price: { fontSize: 16, fontWeight: "700", color: colors.text },
  rationale: { fontSize: 14, lineHeight: 20, color: colors.text, marginTop: space.md },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  totalLabel: { fontSize: 16, fontWeight: "600", color: colors.text },
  totalValue: { fontSize: 22, fontWeight: "700", color: colors.text },
});
