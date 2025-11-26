import { z } from "zod";

export function registerPrompts(server) {
  // Deep Dive Research Prompt
  server.prompt(
    "presearch-deep-dive",
    { topic: z.string().describe("The main topic to research") },
    ({ topic }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please conduct a deep research on "${topic}" using the Presearch API.
1. Start with a broad search to understand the landscape.
2. Identify key sub-topics or controversies.
3. Use the deep-research tool to analyze these specific areas.
4. Synthesize all findings into a comprehensive report with citations.`,
          },
        },
      ],
    }),
  );

  // Latest News Prompt
  server.prompt(
    "presearch-news",
    { topic: z.string().describe("The topic to find news for") },
    ({ topic }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Find the latest news about "${topic}" from the last 24 hours using Presearch.
1. Use the search tool with time='day'.
2. Summarize the top 5 stories.
3. Provide links to the original sources.`,
          },
        },
      ],
    }),
  );
}
