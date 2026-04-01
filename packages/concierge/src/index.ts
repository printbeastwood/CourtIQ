import type { Db } from "@courtiq/db";
import type { PreferenceStore } from "@courtiq/preference-store";
import { ConversationManager } from "./conversation.js";
import { toolDefinitions, executeTool, type ToolExecutorDeps } from "./tools.js";
import {
  createLLMProvider,
  createAnthropicProvider,
  type LLMProvider,
  type LLMMessage,
  type LLMToolDefinition,
  type LLMToolResult,
  type ProviderConfig,
} from "./llm-provider.js";

export { ConversationManager } from "./conversation.js";
export { toolDefinitions } from "./tools.js";
export {
  createLLMProvider,
  createAnthropicProvider,
  createOpenAICompatibleProvider,
  type LLMProvider,
  type ProviderConfig,
} from "./llm-provider.js";

const MAX_TOOL_ROUNDS = 5;

const SYSTEM_PROMPT = `You are CourtIQ's AI concierge — a friendly, knowledgeable assistant specializing in padel court bookings in Bangkok, Thailand.

## Your Role
You help players find and book the perfect padel courts based on their preferences, schedule, and conditions. You understand the Bangkok padel scene deeply — venues, court surfaces, pricing patterns, peak hours, and weather impacts.

## Personality
- Warm, enthusiastic, and efficient — like a helpful friend who knows all the best courts
- Proactive: suggest options before being asked, flag weather concerns, remember preferences
- Concise but thorough: give useful details without overwhelming
- Use casual, friendly language — this is a sport, keep it fun

## Bangkok Padel Context
- Popular venues: Padel City, The Racquet Club, Royal Bangkok Sports Club, Padel Pro, True Arena
- Peak hours: 6-8 AM (before work), 5-9 PM (after work), weekends are busiest
- Rainy season: May-October — recommend indoor courts during these months
- Court surfaces: Glass walls are premium, panoramic offers better views, concrete is budget-friendly
- Typical prices: 400-1200 THB per hour depending on venue, time, and court type
- Most venues allow 90-minute bookings for padel matches
- Currency is Thai Baht (THB)

## How to Help
1. When a user asks about courts, use search_courts to find available options
2. Use get_user_preferences to personalize recommendations
3. Check weather when outdoor courts are being considered
4. When a user wants to book, use initiate_booking
5. When a user mentions preferences, save them with update_preference for future sessions

## Important
- Always present prices in THB
- Include the time in Bangkok timezone (ICT, UTC+7)
- If no slots match, suggest alternatives (different time, nearby venue, etc.)
- When showing results, highlight what makes each option a good match for THIS user
- Never fabricate court availability — only present results from search_courts`;

export interface ConciergeConfig {
  db: Db;
  preferenceStore: PreferenceStore;
  // Option 1: pass a pre-built provider
  llmProvider?: LLMProvider;
  // Option 2: pass Anthropic key (backwards compatible)
  anthropicApiKey?: string;
  model?: string;
}

export interface ChatResult {
  response: string;
  toolsUsed: string[];
  conversationId: string;
}

export interface StreamCallbacks {
  onText?: (text: string) => void;
  onToolStart?: (toolName: string) => void;
  onToolEnd?: (toolName: string) => void;
  onDone?: (result: ChatResult) => void;
}

export class Concierge {
  private llm: LLMProvider;
  private db: Db;
  private preferenceStore: PreferenceStore;
  private conversationManager: ConversationManager;

  constructor(config: ConciergeConfig) {
    if (config.llmProvider) {
      this.llm = config.llmProvider;
    } else if (config.anthropicApiKey) {
      this.llm = createAnthropicProvider(config.anthropicApiKey, config.model);
    } else {
      throw new Error("Either llmProvider or anthropicApiKey must be provided");
    }
    this.db = config.db;
    this.preferenceStore = config.preferenceStore;
    this.conversationManager = new ConversationManager(config.db);
  }

  getConversationManager(): ConversationManager {
    return this.conversationManager;
  }

  /**
   * Send a message in a conversation and get a response.
   * Handles the full tool-use loop.
   */
  async chat(
    userId: string,
    conversationId: string,
    userMessage: string,
    callbacks?: StreamCallbacks
  ): Promise<ChatResult> {
    await this.conversationManager.saveMessage(conversationId, "user", userMessage);

    const history = await this.conversationManager.loadContextWindow(conversationId);

    const lastMsg = history[history.length - 1];
    if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== userMessage) {
      history.push({ role: "user", content: userMessage });
    }

    const toolDeps: ToolExecutorDeps = {
      db: this.db,
      preferenceStore: this.preferenceStore,
      userId,
    };

    const toolsUsed: string[] = [];
    let currentMessages: LLMMessage[] = [...history] as LLMMessage[];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.llm.chat({
        system: SYSTEM_PROMPT,
        messages: currentMessages,
        tools: toolDefinitions as unknown as LLMToolDefinition[],
        maxTokens: 2048,
      });

      if (response.toolCalls.length === 0) {
        const responseText = response.text ?? "";

        await this.conversationManager.saveMessage(
          conversationId,
          "assistant",
          responseText
        );

        callbacks?.onText?.(responseText);

        const result: ChatResult = {
          response: responseText,
          toolsUsed,
          conversationId,
        };
        callbacks?.onDone?.(result);
        return result;
      }

      // Build assistant message with tool calls (Anthropic format for storage)
      const assistantContent: unknown[] = [];
      if (response.text) {
        assistantContent.push({ type: "text", text: response.text });
      }
      for (const tc of response.toolCalls) {
        assistantContent.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.input,
        });
      }
      currentMessages.push({ role: "assistant", content: assistantContent });

      // Execute tools
      const toolResults: LLMToolResult[] = [];
      for (const toolCall of response.toolCalls) {
        callbacks?.onToolStart?.(toolCall.name);
        toolsUsed.push(toolCall.name);

        const result = await executeTool(toolCall.name, toolCall.input, toolDeps);

        toolResults.push({
          tool_use_id: toolCall.id,
          content: result,
        });

        callbacks?.onToolEnd?.(toolCall.name);
      }

      // Add tool results as user message (Anthropic format)
      currentMessages.push({
        role: "user",
        content: toolResults.map((tr) => ({
          type: "tool_result",
          tool_use_id: tr.tool_use_id,
          content: tr.content,
        })),
      });
    }

    // Exhaust tool rounds — get final response without tools
    const finalResponse = await this.llm.chat({
      system: SYSTEM_PROMPT,
      messages: currentMessages,
      maxTokens: 2048,
    });

    const responseText = finalResponse.text ?? "I'm sorry, I had trouble processing your request. Could you try again?";

    await this.conversationManager.saveMessage(
      conversationId,
      "assistant",
      responseText
    );

    const result: ChatResult = {
      response: responseText,
      toolsUsed,
      conversationId,
    };
    callbacks?.onDone?.(result);
    return result;
  }

  async startConversation(userId: string): Promise<string> {
    return this.conversationManager.createConversation(userId);
  }
}
