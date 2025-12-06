import { z } from "zod";
import { ValidationError, withErrorHandling } from "../utils/errors.js";
import { robustBoolean } from "../utils/schemas.js";

const ExportResultsSchema = z.object({
  results: z
    .array(z.object({}).passthrough())
    .describe("Array of search results to export"),
  format: z
    .enum(["json", "csv", "markdown", "html"])
    .default("json")
    .describe("Export format (json, csv, markdown, html)"),
  include_metadata: robustBoolean()
    .default(false)
    .describe("Include metadata in export"),
  filename: z
    .string()
    .optional()
    .describe(
      "Filename for export (optional, implies saving to disk if supported)",
    ),
});

// JSON Schema for MCP compatibility
const ExportResultsInputSchema = {
  type: "object",
  properties: {
    results: {
      type: "array",
      description:
        "Array of search result objects to export. Each object should contain title, url, description, etc.",
      items: { type: "object" },
    },
    format: {
      type: "string",
      enum: ["json", "csv", "markdown", "html"],
      description:
        "Target format for the export: json, csv, markdown, or html. Defaults to json.",
    },
    include_metadata: {
      type: "boolean",
      description:
        "Whether to include additional metadata (timestamps, query info) in the export. Defaults to false.",
    },
    filename: {
      type: "string",
      description:
        "Optional filename for the exported file. If provided, suggests saving to disk.",
    },
  },
  required: ["results"],
};

function normalizeResults(results, max) {
  const out = Array.isArray(results) ? results.slice(0, max) : [];
  return out.map((r, i) => {
    const url = r.url || r.link || "";
    let domain;
    try {
      if (url) domain = new URL(url).hostname;
    } catch {
      domain = "";
    }
    return {
      title: r.title || r.name || `Result ${i + 1}`,
      url: url,
      snippet: r.snippet || r.description || r.content || "",
      description: r.description || r.snippet || r.content || "",
      source: r.source || domain || "Unknown",
      publishedDate: r.publishedDate || r.date || "",
    };
  });
}

/**
 * Export Search Results Tool
 *
 * Exports search results to various formats (JSON, CSV, Markdown, HTML)
 * with configurable options for filtering, formatting, and file output.
 */
export const exportResultsTool = {
  name: "export_search_results",
  description:
    "Export search results to JSON, CSV, Markdown, or HTML format with optional metadata.",
  inputSchema: ExportResultsInputSchema,
  tags: ["utility", "export"],
  execute: withErrorHandling("export_search_results", async (args) => {
    const parsed = ExportResultsSchema.safeParse(args);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const { results, format } = parsed.data;

    const items = normalizeResults(results, 1000); // Safe max

    let content = "";
    if (format === "json") {
      content = JSON.stringify(items, null, 2);
    } else if (format === "csv") {
      const headers = "Title,URL,Description,Source\n";
      const rows = items
        .map(
          (i) =>
            `"${(i.title || "").replace(/"/g, '""')}","${i.url || ""}","${(i.description || "").replace(/"/g, '""')}","${i.source || ""}"`,
        )
        .join("\n");
      content = headers + rows;
    } else if (format === "markdown") {
      content = items
        .map(
          (i) =>
            `## ${i.title}\n**Source:** ${i.source}\n**URL:** ${i.url}\n\n${i.description}\n`,
        )
        .join("\n");
    } else if (format === "html") {
      content = `<html><head><title>Search Results Export</title></head><body><h1>Search Results</h1>${items
        .map(
          (i) =>
            `<div class="result"><h3><a href="${i.url}">${i.title}</a></h3><p><strong>Source:</strong> ${i.source}</p><p>${i.description}</p></div>`,
        )
        .join("")}</body></html>`;
    }

    return {
      format,
      count: items.length,
      content,
    };
  }),
};
