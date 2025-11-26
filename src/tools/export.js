import { z } from "zod";

import logger from "../core/logger.js";
import apiClient from "../core/apiClient.js";
import presearchService from "../services/presearchService.js";
import { resultProcessor } from "../services/resultProcessor.js";
import fs from "fs/promises";
import path from "path";
import {
  ValidationError,
  RateLimitError,
  withErrorHandling,
} from "../utils/errors.js";
import { robustBoolean, robustInt } from "../utils/schemas.js";

const exportSchema = z.object({
  query: z.string().min(1).describe("Search query to export results for"),
  format: z
    .enum(["csv", "json", "markdown", "excel", "html"])
    .default("json")
    .describe("Export format"),
  count: robustInt()
    .min(1)
    .max(200)
    .default(25)
    .describe("Maximum results to include (1-200). Accepts number or string."),
  language: z.string().optional().describe("Language code (optional)"),
  country: z.string().optional().describe("Country code (optional)"),
  safesearch: z
    .enum(["off", "moderate", "strict"])
    .default("moderate")
    .describe("SafeSearch setting"),
  freshness: z
    .enum(["any", "day", "week", "month", "year"])
    .default("any")
    .describe("Freshness filter"),
  file_output: robustBoolean()
    .default(false)
    .describe(
      "Save export to `exports/` directory. Accepts boolean or string 'true'/'false'.",
    ),
  filename: z
    .string()
    .max(100)
    .optional()
    .describe("Filename (without extension)"),
});

function normalizeResults(results, max) {
  const out = Array.isArray(results) ? results.slice(0, max) : [];
  return out.map((r, i) => {
    const url = r.url || r.link || "";
    let domain;
    try {
      if (url) domain = new URL(url).hostname;
    } catch {
      domain = undefined;
    }
    return {
      title: r.title || r.name || "",
      url,
      description: r.description || r.snippet || r.summary || "",
      domain,
      publishedDate: r.publishedDate || r.date || undefined,
      position: r.position || i + 1,
      qualityScore: resultProcessor?.calculateQualityScore
        ? resultProcessor.calculateQualityScore(r)
        : undefined,
    };
  });
}

function toJSON(results) {
  return JSON.stringify(
    {
      export_metadata: {
        timestamp: new Date().toISOString(),
        total_results: results.length,
      },
      results,
    },
    null,
    2,
  );
}

function toCSV(results) {
  const headers = [
    "Title",
    "URL",
    "Description",
    "Domain",
    "Published",
    "Position",
    "QualityScore",
  ];
  const rows = results.map((r) => {
    const vals = [
      r.title,
      r.url,
      r.description,
      r.domain || "",
      r.publishedDate || "",
      String(r.position),
      r.qualityScore ?? "",
    ];
    return vals
      .map((v) => {
        const s = (v ?? "").toString().replace(/"/g, '""');
        return `"${s}"`;
      })
      .join(",");
  });
  return `${headers.join(",")}\n${rows.join("\n")}`;
}

function toMarkdown(results) {
  let md = `# Exported Search Results\n\nGenerated: ${new Date().toISOString()}\nResults: ${results.length}\n\n`;
  results.forEach((r, i) => {
    md += `## ${i + 1}. ${r.title || "Untitled"}\n- URL: ${r.url}\n- Description: ${r.description || "None"}\n- Domain: ${r.domain || "Unknown"}\n- Published: ${r.publishedDate || "N/A"}\n`;
    if (typeof r.qualityScore === "number")
      md += `- QualityScore: ${r.qualityScore}\n`;
    md += `\n`;
  });
  return md;
}

function toHTML(results) {
  const items = results
    .map(
      (r, i) => `
    <div class="item">
      <h3>${i + 1}. ${r.title || "Untitled"}</h3>
      <p><strong>URL:</strong> <a href="${r.url}" target="_blank">${r.url}</a></p>
      <p><strong>Description:</strong> ${r.description || "None"}</p>
      <p><strong>Domain:</strong> ${r.domain || "Unknown"}</p>
      ${r.publishedDate ? `<p><strong>Published:</strong> ${r.publishedDate}</p>` : ""}
      ${typeof r.qualityScore === "number" ? `<p><strong>QualityScore:</strong> ${r.qualityScore}</p>` : ""}
    </div>
  `,
    )
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Export</title>
  <style>body{font-family:Arial,sans-serif;max-width:900px;margin:20px auto;padding:0 20px} .item{border:1px solid #ddd;padding:12px;margin:10px 0;border-radius:6px}</style>
  </head><body><h1>Exported Search Results</h1><p>Generated: ${new Date().toISOString()}</p>${items}</body></html>`;
}

export const exportResultsTool = {
  name: "export_search_results",
  description:
    "Export Presearch results in JSON, CSV, Markdown, or HTML without synthetic metrics. Uses deterministic fields only.",
  inputSchema: exportSchema,
  execute: withErrorHandling("exportResultsTool", async (rawArgs, context) => {
    const parsed = exportSchema.safeParse(rawArgs);
    if (!parsed.success) {
      throw new ValidationError("Invalid arguments", {
        errors: parsed.error.flatten(),
      });
    }
    const args = parsed.data;

    if (
      !args.query ||
      typeof args.query !== "string" ||
      args.query.trim().length === 0
    ) {
      throw new ValidationError("Query cannot be empty", {
        parameter: "query",
      });
    }

    logger.info("Exporting search results", {
      query: args.query,
      format: args.format,
      count: args.count,
    });

    let data;
    try {
      const searchParams = {
        q: args.query,
        lang: args.language,
        country: args.country,
        safe: args.safesearch,
        time: args.freshness,
        page: 1,
      };
      data = await presearchService.search(
        Object.fromEntries(
          Object.entries(searchParams).filter(([, v]) => v !== undefined),
        ),
        context?.apiKey,
      );
    } catch (error) {
      if (error.status === 429 || error.response?.status === 429) {
        const retryAfter = error.response?.headers?.["retry-after"];
        throw new RateLimitError(
          "Search rate limit exceeded",
          retryAfter ? parseInt(retryAfter) : null,
          {},
        );
      }
      throw error;
    }

    const arr =
      data?.results ||
      data?.standardResults ||
      data?.data?.results ||
      data?.data?.standardResults ||
      [];
    const normalized = normalizeResults(arr, args.count);

    let output;
    switch (args.format) {
      case "csv":
      case "excel":
        output = toCSV(normalized);
        break;
      case "markdown":
        output = toMarkdown(normalized);
        break;
      case "html":
        output = toHTML(normalized);
        break;
      case "json":
      default:
        output = toJSON(normalized);
        break;
    }

    let file_path = null;
    if (args.file_output) {
      const exportsDir = path.join(process.cwd(), "exports");
      await fs.mkdir(exportsDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const base = args.filename || `export_${ts}`;
      const ext = args.format === "excel" ? "csv" : args.format;
      file_path = path.join(exportsDir, `${base}.${ext}`);
      await fs.writeFile(file_path, output, "utf8");
      logger.info("Export file saved", { file_path });
    }

    return {
      success: true,
      query: args.query,
      format: args.format,
      result_count: normalized.length,
      export_data: output,
      file_path,
      metadata: {
        generated_at: new Date().toISOString(),
        rateLimit: apiClient.getRateLimitStats(),
      },
    };
  }),
};
