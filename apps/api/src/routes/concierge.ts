import type { FastifyPluginAsync } from "fastify";
import type { Concierge } from "@courtiq/concierge";

export function conciergeRoutes(concierge: Concierge): FastifyPluginAsync {
  return async (app) => {
    const conversationManager = concierge.getConversationManager();

    // Create a new conversation
    app.post<{
      Body: { userId: string };
    }>("/concierge/conversations", async (request, reply) => {
      const { userId } = request.body as { userId: string };
      if (!userId) {
        reply.code(400);
        return { error: "userId is required" };
      }

      const conversationId = await concierge.startConversation(userId);
      reply.code(201);
      return { conversationId };
    });

    // List conversations for a user
    app.get<{
      Params: { userId: string };
    }>("/users/:userId/concierge/conversations", async (request) => {
      const { userId } = request.params;
      const convos = await conversationManager.listConversations(userId);
      return { conversations: convos };
    });

    // Send a message in a conversation (synchronous response)
    app.post<{
      Params: { conversationId: string };
      Body: { userId: string; message: string };
    }>("/concierge/conversations/:conversationId/messages", async (request, reply) => {
      const { conversationId } = request.params;
      const { userId, message } = request.body as { userId: string; message: string };

      if (!userId || !message) {
        reply.code(400);
        return { error: "userId and message are required" };
      }

      // Verify conversation exists
      const conv = await conversationManager.getConversation(conversationId);
      if (!conv) {
        reply.code(404);
        return { error: "Conversation not found" };
      }

      const result = await concierge.chat(userId, conversationId, message);

      return {
        response: result.response,
        conversationId: result.conversationId,
        toolsUsed: result.toolsUsed,
      };
    });

    // Get conversation history
    app.get<{
      Params: { conversationId: string };
    }>("/concierge/conversations/:conversationId/messages", async (request, reply) => {
      const { conversationId } = request.params;

      const conv = await conversationManager.getConversation(conversationId);
      if (!conv) {
        reply.code(404);
        return { error: "Conversation not found" };
      }

      const msgs = await conversationManager.loadContextWindow(conversationId);
      return { messages: msgs, conversationId };
    });

    // WebSocket endpoint for streaming chat
    app.get("/concierge/ws", { websocket: true }, (socket, request) => {
      // userId comes from the auth middleware (verified token), not from the client
      const userId: string = request.userId;
      let conversationId: string | null = null;

      socket.on("message", async (raw: Buffer) => {
        try {
          const data = JSON.parse(raw.toString());

          switch (data.type) {
            case "init": {
              if (!userId) {
                socket.send(JSON.stringify({ type: "error", error: "Authentication required" }));
                return;
              }
              if (data.conversationId) {
                const conv = await conversationManager.getConversation(data.conversationId);
                if (conv) {
                  conversationId = data.conversationId;
                } else {
                  conversationId = await concierge.startConversation(userId);
                }
              } else {
                conversationId = await concierge.startConversation(userId);
              }
              socket.send(JSON.stringify({ type: "init_ok", conversationId }));
              break;
            }

            case "message": {
              if (!userId || !conversationId) {
                socket.send(
                  JSON.stringify({ type: "error", error: "Send init first" })
                );
                return;
              }

              const result = await concierge.chat(
                userId,
                conversationId,
                data.content,
                {
                  onToolStart: (toolName) => {
                    socket.send(
                      JSON.stringify({ type: "tool_start", tool: toolName })
                    );
                  },
                  onToolEnd: (toolName) => {
                    socket.send(
                      JSON.stringify({ type: "tool_end", tool: toolName })
                    );
                  },
                  onDone: (chatResult) => {
                    socket.send(
                      JSON.stringify({
                        type: "message",
                        content: chatResult.response,
                        toolsUsed: chatResult.toolsUsed,
                      })
                    );
                  },
                }
              );
              break;
            }

            default:
              socket.send(
                JSON.stringify({ type: "error", error: `Unknown message type: ${data.type}` })
              );
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Internal error";
          socket.send(JSON.stringify({ type: "error", error: errorMsg }));
        }
      });
    });
  };
}
