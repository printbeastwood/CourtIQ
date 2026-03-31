import Anthropic from "@anthropic-ai/sdk";
import type { Db } from "@courtiq/db";
import type { PreferenceStore } from "@courtiq/preference-store";
import { ConversationManager } from "./conversation.js";
import { toolDefinitions, executeTool, type ToolExecutorDeps } from "./tools.js";

export { ConversationManager } from "./conversation.js";
export { toolDefinitions } from "./tools.js";

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
  anthropicApiKey: string;
  db: Db;
  preferenceStore: PreferenceStore;
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
  private client: Anthropic;
  private model: string;
  private db: Db;
  private preferenceStore: PreferenceStore;
  private conversationManager: ConversationManager;

  constructor(config: ConciergeConfig) {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    this.model = config.model ?? "claude-sonnet-4-20250514";
    this.db = config.db;
    this.preferenceStore = config.preferenceStore;
    this.conversationManager = new ConversationManager(config.db);
  }

  getConversationManager(): ConversationManager {
    return this.conversationManager;
  }

  /**
   * Send a message in a conversation and get a response.
   * Handles the full tool-use loop: Claude may call tools, we execute them,
   * and feed results back until Claude produces a final text response.
   */
  async chat(
    userId: string,
    conversationId: string,
    userMessage: string,
    callbacks?: StreamCallbacks
  ): Promise<ChatResult> {
    // Save the user message
    await this.conversationManager.saveMessage(conversationId, "user", userMessage);

    // Load conversation history
    const history = await this.conversationManager.loadContextWindow(conversationId);

    // Ensure the new user message is included
    // (loadContextWindow may not have it yet if DB is slow, but it should since we just inserted)
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
    let currentMessages = [...history];

    // Tool-use loop: Claude may call tools multiple times before producing a final answer
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: toolDefinitions,
        messages: currentMessages,
      });

      // Check if Claude wants to use tools
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) {
        // No tool use — extract final text response
        const textBlock = response.content.find(
          (b): b is Anthropic.TextBlock => b.type === "text"
        );
        const responseText = textBlock?.text ?? "";

        // Save assistant response
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

      // Claude wants to use tools — execute them all
      // First, add Claude's response to messages
      currentMessages.push({
        role: "assistant",
        content: response.content,
      });

      // Execute each tool and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        callbacks?.onToolStart?.(toolUse.name);
        toolsUsed.push(toolUse.name);

        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          toolDeps
        );

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });

        callbacks?.onToolEnd?.(toolUse.name);
      }

      // Add tool results to messages
      currentMessages.push({
        role: "user",
        content: toolResults,
      });
    }

    // If we exhaust tool rounds, get a final response without tools
    const finalResponse = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: currentMessages,
    });

    const textBlock = finalResponse.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const responseText = textBlock?.text ?? "I'm sorry, I had trouble processing your request. Could you try again?";

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

  /**
   * Start a new conversation for a user.
   */
  async startConversation(userId: string): Promise<string> {
    return this.conversationManager.createConversation(userId);
  }
}
