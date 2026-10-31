import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "../state/session";
import { colors } from "../ui/theme";

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Home Edition" }} />
        <Stack.Screen name="analysis" options={{ title: "Your room" }} />
        <Stack.Screen name="chat" options={{ title: "Your style" }} />
        <Stack.Screen name="brief" options={{ title: "Your design" }} />
      </Stack>
    </SessionProvider>
  );
}
