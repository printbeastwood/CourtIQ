import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "../config";
import { useAuthStore } from "../stores/auth";

export type WsMessageType =
  | { type: "init_ok"; conversationId: string }
  | { type: "message"; content: string; toolsUsed: string[] }
  | { type: "tool_start"; tool: string }
  | { type: "tool_end"; tool: string }
  | { type: "error"; error: string };

interface UseConciergeWsOptions {
  onMessage?: (msg: WsMessageType) => void;
}

export function useConciergeWs({ onMessage }: UseConciergeWsOptions = {}) {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const userId = useAuthStore((s) => s.userId);
  const token = useAuthStore((s) => s.token);

  const connect = useCallback(
    (existingConversationId?: string) => {
      if (ws.current?.readyState === WebSocket.OPEN) return;
      if (!userId || !token) return;

      const wsUrl = `${config.wsUrl}?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      socket.onopen = () => {
        setConnected(true);
        socket.send(
          JSON.stringify({
            type: "init",
            userId,
            conversationId: existingConversationId ?? undefined,
          }),
        );
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data) as WsMessageType;
        if (data.type === "init_ok") {
          setConversationId(data.conversationId);
        }
        onMessage?.(data);
      };

      socket.onclose = () => {
        setConnected(false);
      };

      socket.onerror = () => {
        setConnected(false);
      };
    },
    [userId, token, onMessage],
  );

  const send = useCallback((content: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "message", content }));
    }
  }, []);

  const disconnect = useCallback(() => {
    ws.current?.close();
    ws.current = null;
    setConnected(false);
    setConversationId(null);
  }, []);

  useEffect(() => {
    return () => {
      ws.current?.close();
    };
  }, []);

  return { connect, send, disconnect, connected, conversationId };
}
