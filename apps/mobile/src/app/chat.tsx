import { Redirect, Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ChatMessage, RoomAnalysis } from "@home-kit/shared";
import { api, errorMessage } from "../api/client";
import { useSession } from "../state/session";
import { Button, Chip, ErrorBanner } from "../ui/components";
import { colors, radius, space } from "../ui/theme";

const MAX_MESSAGE_LENGTH = 1000;

export default function ChatScreen() {
  const { state } = useSession();
  if (!state.analysis) return <Redirect href="/" />;
  return <ChatView analysis={state.analysis} />;
}

function ChatView({ analysis }: { analysis: RoomAnalysis }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useSession();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const openedRef = useRef(false);

  /** Ask the assistant for its next turn given the conversation so far. */
  const requestTurn = useCallback(
    async (messages: ChatMessage[]) => {
      setBusy(true);
      setError(null);
      try {
        const turn = await api.intake({ analysis, profile: state.profile, messages });
        dispatch({ type: "intakeTurn", turn });
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [analysis, state.profile, dispatch],
  );

  // The assistant speaks first, once.
  useEffect(() => {
    if (openedRef.current || state.messages.length > 0) return;
    openedRef.current = true;
    void requestTurn([]);
  }, [state.messages.length, requestTurn]);

  function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    dispatch({ type: "userSaid", text });
    void requestTurn([...state.messages, { role: "user", content: text }]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip the questions"
              onPress={() => router.push("/brief")}
              style={styles.skipButton}
            >
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          ),
        }}
      />

      <FlatList
        ref={listRef}
        data={state.messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => <Bubble message={item} />}
        ListFooterComponent={
          busy ? (
            <View style={[styles.bubble, styles.assistantBubble, styles.typing]} accessibilityLabel="Assistant is typing">
              <ActivityIndicator size="small" color={colors.muted} />
            </View>
          ) : undefined
        }
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        {error ? <ErrorBanner message={error} onRetry={() => requestTurn(state.messages)} /> : null}

        {!busy && state.quickReplies.length > 0 ? (
          <View style={styles.chips}>
            {state.quickReplies.map((reply) => (
              <Chip key={reply} label={reply} onPress={() => send(reply)} />
            ))}
          </View>
        ) : null}

        {state.readyForBrief && !busy ? (
          <Button title="See my design" onPress={() => router.push("/brief")} />
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type your answer…"
            placeholderTextColor={colors.muted}
            maxLength={MAX_MESSAGE_LENGTH}
            editable={!busy}
            returnKeyType="send"
            onSubmitEditing={() => send(input)}
            accessibilityLabel="Your answer"
          />
          <Button
            title="Send"
            onPress={() => send(input)}
            disabled={busy || input.trim().length === 0}
            style={styles.sendButton}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";
  return (
    <View style={[styles.bubble, mine ? styles.userBubble : styles.assistantBubble]}>
      <Text style={mine ? styles.userText : styles.assistantText}>{message.content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.lg, gap: space.sm },
  bubble: { maxWidth: "85%", borderRadius: radius.lg, paddingVertical: space.md, paddingHorizontal: space.lg },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.accent },
  assistantText: { fontSize: 16, lineHeight: 22, color: colors.text },
  userText: { fontSize: 16, lineHeight: 22, color: colors.accentText },
  typing: { paddingHorizontal: space.xl },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  inputRow: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  input: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: space.lg,
    fontSize: 16,
    color: colors.text,
  },
  sendButton: { paddingHorizontal: space.lg },
  skipButton: { paddingVertical: space.sm, paddingHorizontal: space.md },
  skip: { color: colors.accent, fontSize: 16, fontWeight: "600" },
});
