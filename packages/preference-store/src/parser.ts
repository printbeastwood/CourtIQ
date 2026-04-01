import type { PreferenceCategory, PreferenceInput } from "@courtiq/shared";

const VALID_CATEGORIES: PreferenceCategory[] = [
  "play_style",
  "skill_level",
  "competitive_intent",
  "time",
  "location",
  "court_surface",
  "group_size",
  "coaching",
];

export interface ParsedPreference {
  category: PreferenceCategory;
  text: string;
}

export interface LLMClassifier {
  classify(texts: string[]): Promise<{ category: string; text: string }[]>;
}

const CLASSIFICATION_SYSTEM = `You are a preference classifier for a padel court booking app. Given user preference texts, classify each into exactly one category and optionally split compound preferences into separate entries.

Categories:
- play_style: playing style preferences (aggressive, defensive, etc.)
- skill_level: self-reported skill/experience level
- competitive_intent: casual vs competitive preference
- time: time-of-day or day-of-week preferences
- location: area, neighborhood, or distance preferences
- court_surface: court surface type preferences (glass, panoramic, concrete, turf)
- group_size: group size or partner preferences
- coaching: coaching or training preferences

Respond with a JSON array of objects: [{"category": "...", "text": "..."}]
Each text should be a clean, single preference statement. Split compound inputs.
Return ONLY the JSON array, no other text.`;

/**
 * Creates a classifier that calls an OpenAI-compatible API (Groq, Together, etc.)
 */
export function createOpenAIClassifier(apiKey: string, baseUrl: string, model: string): LLMClassifier {
  return {
    async classify(texts: string[]) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: CLASSIFICATION_SYSTEM },
            {
              role: "user",
              content: `Classify these preferences:\n${texts.map((t, i) => `${i + 1}. "${t}"`).join("\n")}`,
            },
          ],
          max_tokens: 1024,
        }),
      });

      if (!response.ok) return [];

      const data = (await response.json()) as {
        choices: { message: { content: string } }[];
      };
      const content = data.choices[0]?.message?.content;
      if (!content) return [];

      return JSON.parse(content) as { category: string; text: string }[];
    },
  };
}

/**
 * Creates a classifier that calls the Anthropic API directly.
 */
export function createAnthropicClassifier(apiKey: string, model?: string): LLMClassifier {
  return {
    async classify(texts: string[]) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model ?? "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: CLASSIFICATION_SYSTEM,
          messages: [
            {
              role: "user",
              content: `Classify these preferences:\n${texts.map((t, i) => `${i + 1}. "${t}"`).join("\n")}`,
            },
          ],
        }),
      });

      if (!response.ok) return [];

      const data = (await response.json()) as {
        content: { type: string; text: string }[];
      };
      const textContent = data.content.find((c) => c.type === "text");
      if (!textContent) return [];

      return JSON.parse(textContent.text) as { category: string; text: string }[];
    },
  };
}

/**
 * Parses natural language preference text into categorized preferences.
 * Accepts either an LLMClassifier or an Anthropic API key for backwards compatibility.
 */
export async function parsePreferences(
  inputs: PreferenceInput[],
  classifierOrApiKey: LLMClassifier | string
): Promise<ParsedPreference[]> {
  const results: ParsedPreference[] = [];

  const needsParsing: PreferenceInput[] = [];
  for (const input of inputs) {
    if (input.category) {
      results.push({ category: input.category, text: input.text });
    } else {
      needsParsing.push(input);
    }
  }

  if (needsParsing.length === 0) return results;

  const classifier: LLMClassifier =
    typeof classifierOrApiKey === "string"
      ? createAnthropicClassifier(classifierOrApiKey)
      : classifierOrApiKey;

  const textsToClassify = needsParsing.map((p) => p.text);

  try {
    const parsed = await classifier.classify(textsToClassify);
    for (const item of parsed) {
      const category = VALID_CATEGORIES.includes(item.category as PreferenceCategory)
        ? (item.category as PreferenceCategory)
        : "play_style";
      results.push({ category, text: item.text });
    }
  } catch {
    // Fallback: assign default category
    for (const input of needsParsing) {
      results.push({ category: "play_style", text: input.text });
    }
  }

  return results;
}
