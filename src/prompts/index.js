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
3. Use the deep-research tool (presearch_deep_research) to analyze these specific areas.
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
1. Use the search tool with time='day' and content_categories=['news'].
2. Summarize the top 5 stories.
3. Provide links to the original sources.`,
          },
        },
      ],
    }),
  );

  // Fact Check Prompt
  server.prompt(
    "presearch-fact-check",
    { claim: z.string().describe("The statement or claim to verify") },
    ({ claim }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Verify the following claim: "${claim}"
1. Search for this specific claim and related keywords using Presearch.
2. Look for reliable sources (news, academic, official reports) that support or refute it.
3. Use the scrape tool to get details from the most promising results.
4. Provide a verdict (True, False, Misleading, Unproven) with evidence and citations.`,
          },
        },
      ],
    }),
  );

  // Market Analysis Prompt
  server.prompt(
    "presearch-market-analysis",
    {
      sector: z.string().describe("The market sector or product to analyze"),
      region: z
        .string()
        .optional()
        .describe("Geographic region (e.g., US, Global)"),
    },
    ({ sector, region }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Perform a market analysis for "${sector}"${region ? ` in ${region}` : ""}.
1. Identify key players/competitors.
2. Find recent trends and news.
3. Look for market size or growth statistics.
4. Use the deep-research tool for a more thorough investigation if needed.
5. Summarize the competitive landscape and opportunities.`,
          },
        },
      ],
    }),
  );

  // Node Monitor Prompt
  server.prompt(
    "presearch-node-monitor",
    {
      node_api_key: z.string().describe("Your Presearch Node API Key"),
    },
    ({ node_api_key }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Check the status of my Presearch nodes using key: ${node_api_key}
1. Use the presearch_node_status tool to get current stats.
2. Report on how many nodes are connected vs disconnected.
3. If any nodes are disconnected, list their public keys (if available).
4. Provide a summary of total earnings if stats are enabled.`,
          },
        },
      ],
    }),
  );

  // Product Review Prompt
  server.prompt(
    "presearch-product-review",
    {
      product: z.string().describe("The product name to review"),
      category: z
        .string()
        .optional()
        .describe("Product category (e.g., Electronics, Home)"),
    },
    ({ product, category }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Research reviews and sentiment for "${product}"${category ? ` in ${category}` : ""}.
1. Search for professional reviews and user ratings using Presearch.
2. Identify common pros and cons.
3. Compare with top competitors in the price range.
4. Use the scrape tool to extract detailed specs from the manufacturer page if found.
5. Provide a "Buy" or "Skip" recommendation based on value and quality.`,
          },
        },
      ],
    }),
  );

  // Academic Research Prompt
  server.prompt(
    "presearch-academic",
    {
      topic: z.string().describe("Academic topic or hypothesis"),
    },
    ({ topic }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Conduct academic research on: "${topic}"
1. Use presearch_deep_research with research_focus='academic'.
2. Prioritize .edu, .org, and known journal domains.
3. Find recent papers, studies, or articles (last 5 years).
4. Summarize key findings, methodologies, and conclusions.
5. List all citations in a standard format (APA/MLA).`,
          },
        },
      ],
    }),
  );

  // Quick Tutorial Prompt
  server.prompt(
    "presearch-tutorial",
    {
      tool_name: z
        .string()
        .describe(
          "Name of the tool to learn about (e.g., presearch_ai_search)",
        ),
    },
    ({ tool_name }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Explain how to use the "${tool_name}" tool effectively.
1. Describe what the tool does.
2. Explain its key parameters (required vs optional).
3. Provide 3 concrete examples of how to call it for different use cases.
4. Mention any common errors or edge cases to avoid.`,
          },
        },
      ],
    }),
  );
}
