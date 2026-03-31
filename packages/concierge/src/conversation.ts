import { eq, desc, asc } from "drizzle-orm";
import { conversations, messages, type Db } from "@courtiq/db";
import type Anthropic from "@anthropic-ai/sdk";

const CONTEXT_WINDOW_SIZE = 20;

export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls: unknown[] | null;
  createdAt: Date;
}

export class ConversationManager {
  constructor(private db: Db) {}

  async createConversation(userId: string): Promise<string> {
    const [conv] = await this.db
      .insert(conversations)
      .values({ userId })
      .returning({ id: conversations.id });
    return conv.id;
  }

  async getConversation(conversationId: string) {
    const [conv] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    return conv ?? null;
  }

  async listConversations(userId: string) {
    return this.db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.startedAt));
  }

  async saveMessage(
    conversationId: string,
    role: "user" | "assistant" | "system",
    content: string,
    toolCalls?: unknown[]
  ): Promise<StoredMessage> {
    const [msg] = await this.db
      .insert(messages)
      .values({
        conversationId,
        role,
        content,
        toolCalls: toolCalls ?? null,
      })
      .returning();
    return {
      id: msg.id,
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      toolCalls: msg.toolCalls as unknown[] | null,
      createdAt: msg.createdAt,
    };
  }

  /**
   * Load the last N messages for a conversation, formatted for Claude API.
   * Returns the most recent CONTEXT_WINDOW_SIZE messages in chronological order.
   */
  async loadContextWindow(
    conversationId: string
  ): Promise<Anthropic.MessageParam[]> {
    const rows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(CONTEXT_WINDOW_SIZE);

    // Reverse to chronological order
    rows.reverse();

    const apiMessages: Anthropic.MessageParam[] = [];
    for (const row of rows) {
      if (row.role === "system") continue; // system messages go in system prompt

      if (row.role === "user") {
        apiMessages.push({ role: "user", content: row.content });
      } else if (row.role === "assistant") {
        // If we stored tool calls, reconstruct the content blocks
        if (row.toolCalls && Array.isArray(row.toolCalls) && row.toolCalls.length > 0) {
          apiMessages.push({
            role: "assistant",
            content: row.toolCalls as Anthropic.ContentBlock[],
          });
        } else {
          apiMessages.push({ role: "assistant", content: row.content });
        }
      }
    }

    // Ensure messages start with a user message (Claude API requirement)
    while (apiMessages.length > 0 && apiMessages[0].role !== "user") {
      apiMessages.shift();
    }

    return apiMessages;
  }

  async getMessageCount(conversationId: string): Promise<number> {
    const rows = await this.db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    return rows.length;
  }
}
