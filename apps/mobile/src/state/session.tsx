import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import {
  emptyProfile,
  type ChatMessage,
  type DesignBrief,
  type DesignProfile,
  type IntakeTurn,
  type RoomAnalysis,
} from "@home-kit/shared";

/** Everything about one redesign session. Lives in memory; persistence comes later. */
export type SessionState = {
  /** Local URI of the (resized) room photo, for display only. */
  photoUri: string | null;
  analysis: RoomAnalysis | null;
  profile: DesignProfile;
  messages: ChatMessage[];
  quickReplies: string[];
  readyForBrief: boolean;
  brief: DesignBrief | null;
};

export type SessionAction =
  | { type: "roomAnalyzed"; photoUri: string; analysis: RoomAnalysis }
  | { type: "userSaid"; text: string }
  | { type: "intakeTurn"; turn: IntakeTurn }
  | { type: "briefReady"; brief: DesignBrief }
  | { type: "reset" };

export const initialSession: SessionState = {
  photoUri: null,
  analysis: null,
  profile: emptyProfile(),
  messages: [],
  quickReplies: [],
  readyForBrief: false,
  brief: null,
};

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "roomAnalyzed":
      // A new photo means a new conversation: nothing from the previous room carries over.
      return { ...initialSession, photoUri: action.photoUri, analysis: action.analysis };
    case "userSaid":
      return {
        ...state,
        messages: [...state.messages, { role: "user", content: action.text }],
        quickReplies: [],
        // Whatever they say next may change their answers, so any earlier brief is stale.
        brief: null,
      };
    case "intakeTurn":
      return {
        ...state,
        messages: [...state.messages, { role: "assistant", content: action.turn.reply }],
        quickReplies: action.turn.quick_replies,
        profile: action.turn.profile,
        readyForBrief: action.turn.ready_for_brief,
      };
    case "briefReady":
      return { ...state, brief: action.brief };
    case "reset":
      return initialSession;
  }
}

const SessionContext = createContext<{ state: SessionState; dispatch: Dispatch<SessionAction> } | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialSession);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>.");
  return ctx;
}
