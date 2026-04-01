/**
 * LLM Provider abstraction — makes it easy to swap between Claude, Groq,
 * Together, OpenRouter, or any OpenAI-compatible API.
 */

export interface LLMToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LLMToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMToolResult {
  tool_use_id: string;
  content: string;
}

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string | unknown[];
}

export interface LLMResponse {
  text: string | null;
  toolCalls: LLMToolCall[];
  stopReason: "end_turn" | "tool_use" | "max_tokens";
}

export interface LLMProvider {
  chat(opts: {
    system: string;
    messages: LLMMessage[];
    tools?: LLMToolDefinition[];
    maxTokens?: number;
  }): Promise<LLMResponse>;
}

// --- Anthropic Provider ---

export function createAnthropicProvider(apiKey: string, model?: string): LLMProvider {
  const resolvedModel = model ?? "claude-sonnet-4-20250514";

  return {
    async chat({ system, messages, tools, maxTokens }) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });

      const response = await client.messages.create({
        model: resolvedModel,
        max_tokens: maxTokens ?? 2048,
        system,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: tools as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages.filter((m) => m.role !== "system") as any,
      });

      let text: string | null = null;
      const toolCalls: LLMToolCall[] = [];

      for (const block of response.content) {
        if (block.type === "text") {
          text = block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });
        }
      }

      return {
        text,
        toolCalls,
        stopReason: response.stop_reason === "tool_use" ? "tool_use" : "end_turn",
      };
    },
  };
}

// --- OpenAI-Compatible Provider (Groq, Together, OpenRouter, etc.) ---

export function createOpenAICompatibleProvider(opts: {
  apiKey: string;
  baseUrl: string;
  model: string;
}): LLMProvider {
  return {
    async chat({ system, messages, tools, maxTokens }) {
      // Convert Anthropic-style tool definitions to OpenAI format
      const openaiTools = tools?.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));

      // Convert messages to OpenAI format
      const openaiMessages: { role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }[] = [];

      // System message first
      openaiMessages.push({ role: "system", content: system });

      for (const msg of messages) {
        if (msg.role === "system") continue;

        if (typeof msg.content === "string") {
          openaiMessages.push({ role: msg.role, content: msg.content });
        } else if (Array.isArray(msg.content)) {
          // Handle tool results (user messages with tool_result blocks)
          if (msg.role === "user") {
            const toolResults = msg.content.filter(
              (b): b is { type: string; tool_use_id: string; content: string } =>
                typeof b === "object" && b !== null && (b as Record<string, unknown>).type === "tool_result"
            );
            if (toolResults.length > 0) {
              for (const tr of toolResults) {
                openaiMessages.push({
                  role: "tool",
                  content: tr.content,
                  tool_call_id: tr.tool_use_id,
                });
              }
              continue;
            }
          }

          // Handle assistant messages with tool calls
          if (msg.role === "assistant") {
            const toolUses = msg.content.filter(
              (b): b is { type: string; id: string; name: string; input: Record<string, unknown> } =>
                typeof b === "object" && b !== null && (b as Record<string, unknown>).type === "tool_use"
            );
            const textBlock = msg.content.find(
              (b): b is { type: string; text: string } =>
                typeof b === "object" && b !== null && (b as Record<string, unknown>).type === "text"
            );

            if (toolUses.length > 0) {
              openaiMessages.push({
                role: "assistant",
                content: textBlock?.text ?? null,
                tool_calls: toolUses.map((t) => ({
                  id: t.id,
                  type: "function",
                  function: {
                    name: t.name,
                    arguments: JSON.stringify(t.input),
                  },
                })),
              });
              continue;
            }
          }

          // Fallback: extract text
          const texts = msg.content
            .filter((b): b is { type: string; text: string } =>
              typeof b === "object" && b !== null && (b as Record<string, unknown>).type === "text"
            )
            .map((b) => b.text);
          openaiMessages.push({ role: msg.role, content: texts.join("\n") || "" });
        }
      }

      const body: Record<string, unknown> = {
        model: opts.model,
        messages: openaiMessages,
        max_tokens: maxTokens ?? 2048,
      };

      if (openaiTools && openaiTools.length > 0) {
        body.tools = openaiTools;
      }

      const response = await fetch(`${opts.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`LLM API error ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as {
        choices: {
          message: {
            content: string | null;
            tool_calls?: {
              id: string;
              function: { name: string; arguments: string };
            }[];
          };
          finish_reason: string;
        }[];
      };

      const choice = data.choices[0];
      if (!choice) throw new Error("No response from LLM API");

      const toolCalls: LLMToolCall[] = (choice.message.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      }));

      return {
        text: choice.message.content,
        toolCalls,
        stopReason: choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn",
      };
    },
  };
}

// --- Provider Factory ---

export type ProviderConfig =
  | { provider: "anthropic"; apiKey: string; model?: string }
  | { provider: "groq"; apiKey: string; model?: string }
  | { provider: "together"; apiKey: string; model?: string }
  | { provider: "openrouter"; apiKey: string; model?: string }
  | { provider: "openai"; apiKey: string; model?: string; baseUrl?: string };

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  together: { baseUrl: "https://api.together.xyz/v1", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
};

export function createLLMProvider(config: ProviderConfig): LLMProvider {
  if (config.provider === "anthropic") {
    return createAnthropicProvider(config.apiKey, config.model);
  }

  const defaults = PROVIDER_DEFAULTS[config.provider];
  if (!defaults) throw new Error(`Unknown provider: ${config.provider}`);

  return createOpenAICompatibleProvider({
    apiKey: config.apiKey,
    baseUrl: "baseUrl" in config && config.baseUrl ? config.baseUrl : defaults.baseUrl,
    model: config.model ?? defaults.model,
  });
}
