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

/**
 * Parses natural language preference text into categorized preferences.
 * If a category is already provided, uses it directly.
 * Otherwise, uses Claude API to extract structured categories.
 */
export async function parsePreferences(
  inputs: PreferenceInput[],
  anthropicApiKey: string
): Promise<ParsedPreference[]> {
  const results: ParsedPreference[] = [];

  // Inputs with explicit categories don't need parsing
  const needsParsing: PreferenceInput[] = [];
  for (const input of inputs) {
    if (input.category) {
      results.push({ category: input.category, text: input.text });
    } else {
      needsParsing.push(input);
    }
  }

  if (needsParsing.length === 0) return results;

  // Batch parse uncategorized preferences with Claude
  const textsToClassify = needsParsing.map((p) => p.text);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are a preference classifier for a padel court booking app. Given user preference texts, classify each into exactly one category and optionally split compound preferences into separate entries.

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
Return ONLY the JSON array, no other text.`,
      messages: [
        {
          role: "user",
          content: `Classify these preferences:\n${textsToClassify.map((t, i) => `${i + 1}. "${t}"`).join("\n")}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    // Fallback: assign "play_style" as default category
    for (const input of needsParsing) {
      results.push({ category: "play_style", text: input.text });
    }
    return results;
  }

  const data = (await response.json()) as {
    content: { type: string; text: string }[];
  };

  const textContent = data.content.find((c) => c.type === "text");
  if (!textContent) {
    for (const input of needsParsing) {
      results.push({ category: "play_style", text: input.text });
    }
    return results;
  }

  try {
    const parsed = JSON.parse(textContent.text) as {
      category: string;
      text: string;
    }[];
    for (const item of parsed) {
      const category = VALID_CATEGORIES.includes(
        item.category as PreferenceCategory
      )
        ? (item.category as PreferenceCategory)
        : "play_style";
      results.push({ category, text: item.text });
    }
  } catch {
    // JSON parse failed — use raw texts with default category
    for (const input of needsParsing) {
      results.push({ category: "play_style", text: input.text });
    }
  }

  return results;
}
