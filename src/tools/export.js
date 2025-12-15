import fs from "fs/promises";
import path from "path";
import os from "os";
import logger from "../core/logger.js";
import { presearchService } from "../services/presearchService.js";

export const exportResultsTool = {
  name: "export_search_results",
  description: "Format search results into various formats (JSON, CSV, Markdown)",
  inputSchema: {
    type: "object",
    properties: {
      results: { type: "string", description: "JSON string of results" },
      format: {
        type: "string",
        enum: ["json", "csv", "markdown"],
        default: "markdown",
      },
    },
    required: ["results"],
  },
  execute: async (args) => {
    try {
    let results;
    try {
      results =
        typeof args.results === "string"
          ? JSON.parse(args.results)
          : args.results;
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: "Invalid JSON results provided" }],
      };
    }

    let output = "";
    if (args.format === "markdown") {
      output = results
        .map((r) => `### [${r.title}](${r.url})\n${r.description}\n`)
        .join("\n");
    } else if (args.format === "csv") {
      const headers = ["Title", "URL", "Description"].join(",");
      const rows = results.map(
        (r) =>
          `"${r.title.replace(/"/g, '""')}","${r.url}","${r.description.replace(/"/g, '""')}"`,
      );
      output = [headers, ...rows].join("\n");
    } else {
      output = JSON.stringify(results, null, 2);
    }

    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
    } catch (error) {
      logger.error("Export failed", { error: error.message });
      return {
        content: [
          {
            type: "text",
            text: `Failed to export results: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  },
};
