export const prompts = [
  {
    name: "presearch-deep-dive",
    description: "Conduct a deep dive research on a topic",
    arguments: [
      {
        name: "topic",
        description: "The topic to research",
        required: true
      }
    ],
    handler: (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please conduct a deep dive research on: ${args.topic}. Use the presearch_deep_research tool to gather comprehensive information, covering multiple aspects and viewpoints. Provide a detailed summary with citations.`,
          },
        },
      ],
    })
  },
  {
    name: "presearch-news",
    description: "Find the latest news about a topic",
    arguments: [
      {
        name: "topic",
        description: "The topic to search for news",
        required: true
      }
    ],
    handler: (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Find the latest news about: ${args.topic}. Use presearch_ai_search with freshness set to 'day' or 'week'. Summarize the top 5 stories.`,
          },
        },
      ],
    })
  }
];
