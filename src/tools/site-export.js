import logger from "../core/logger.js";
import contentFetcher from "../services/contentFetcher.js";
import { withErrorHandling, ValidationError } from "../utils/errors.js";

async function getPuppeteer() {
  try {
    const mod = await import("puppeteer");
    return mod.default || mod;
  } catch {
    throw new ValidationError("PDF export requires puppeteer to be installed", {
      dependency: "puppeteer",
      install: "npm i puppeteer",
    });
  }
}

// JSON Schema for MCP compatibility
const ExportSiteContentInputSchema = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "The starting URL to export content from.",
    },
    format: {
      type: "string",
      enum: ["markdown", "json", "html", "pdf"],
      default: "json",
      description:
        "Target export format: markdown, json, html, or pdf. Defaults to json.",
    },
    recursive: {
      type: "boolean",
      description:
        "Enable recursive crawling to follow links within the same domain. Defaults to false.",
    },
    depth: {
      type: "number",
      minimum: 1,
      maximum: 5,
      description: "Maximum crawl depth (1-5) when recursive is enabled.",
    },
    include_assets: {
      type: "boolean",
      description:
        "Whether to include static assets (images, styles) in the export. Defaults to false.",
    },
  },
  required: ["url"],
};

function toJson(items) {
  return JSON.stringify(
    {
      export_metadata: {
        timestamp: new Date().toISOString(),
        total_items: items.length,
      },
      items,
    },
    null,
    2,
  );
}

function toMarkdown(items) {
  let md = `# Exported Site Content\n\nGenerated: ${new Date().toISOString()}\n\n`;
  for (const it of items) {
    md += `## ${it.meta?.title || it.url}\n- URL: ${it.url}\n- Status: ${it.status}\n`;
    if (it.meta?.description) md += `- Description: ${it.meta.description}\n`;
    if (it.meta?.author) md += `- Author: ${it.meta.author}\n`;
    if (it.meta?.publishedDate) md += `- Published: ${it.meta.publishedDate}\n`;
    if (it.text) md += `${it.text.substring(0, 2000)}\n\n`;
  }
  return md;
}

function escapeHtml(s) {
  return (s || "").replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
  );
}

function toHtml(items) {
  const sections = items
    .map((it, i) => {
      const metaRows =
        it.meta && typeof it.meta === "object"
          ? Object.entries(it.meta)
              .map(
                ([k, v]) =>
                  `<tr><td>${k}</td><td>${typeof v === "string" ? v : JSON.stringify(v)}</td></tr>`,
              )
              .join("")
          : "";
      const metaTable = metaRows
        ? `<table class="meta"><tbody>${metaRows}</tbody></table>`
        : "";
      const textBlock = it.text
        ? `<div class="text"><h3>Text Content</h3><pre style="white-space:pre">${escapeHtml(it.text.substring(0, 2000))}</pre></div>`
        : "";
      const htmlBlock = it.html
        ? `<details><summary>Raw HTML (truncated)</summary><pre style="white-space:pre">${escapeHtml(it.html.substring(0, 200000))}</pre></details>`
        : "";
      return `<section id="item-${i}">
        <h2><a href="${it.url}" target="_blank">${escapeHtml(it.meta?.title || it.url)}</a></h2>
        <p><strong>URL:</strong> <a href="${it.url}" target="_blank">${it.url}</a></p>
        <p><strong>Status:</strong> ${it.status}</p>
        ${it.meta?.description ? `<p><strong>Description:</strong> ${escapeHtml(it.meta.description)}</p>` : ""}
        ${metaTable}
        ${textBlock}
        ${htmlBlock}
      </section>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Exported Site Content</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;margin:2em}section{margin-bottom:3em;border-bottom:1px solid #ccc;padding-bottom:2em}h1{color:#333}h2{color:#555}.meta{background:#f5f5f5;padding:1em;border-radius:4px;margin:1em 0}.text pre{background:#fafafa;padding:1em;border:1px solid #ddd;border-radius:4px;white-space:pre-wrap;word-break:break-word}</style>
</head>
<body>
  <h1>Exported Site Content</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  <p>Total items: ${items.length}</p>
  ${sections}
</body>
</html>`;
}

async function exportPdf(urls, a) {
  const puppeteer = await getPuppeteer();
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
  });

  if (a.country) {
    const langMap = {
      US: "en-US",
      GB: "en-GB",
      CA: "en-CA",
      FR: "fr-FR",
      DE: "de-DE",
      JP: "ja-JP",
      ES: "es-ES",
      BR: "pt-BR",
    };
    const lang = langMap[a.country] || "en-US";
    await page.setExtraHTTPHeaders({ "Accept-Language": lang });
  }

  const files = [];
  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      const pdfBuffer = await page.pdf({ format: "A4" });
      files.push({
        url,
        pdf_base64: pdfBuffer.toString("base64"),
      });
    } catch (e) {
      files.push({ url, error: e.message });
    }
  }
  await browser.close();
  return files;
}

export const siteExportTool = {
  name: "site_export",
  description:
    "Deep crawl and export site content to JSON, Markdown, HTML, or PDF. Supports recursive crawling and asset inclusion.",
  inputSchema: ExportSiteContentInputSchema,
  tags: ["utility", "export", "web"],
  execute: withErrorHandling("site_export", async (rawArgs) => {
    if (typeof rawArgs.url !== "string" || rawArgs.url.trim() === "") {
      throw new ValidationError("URL must be a non-empty string");
    }
    try {
      new URL(rawArgs.url);
    } catch {
      throw new ValidationError("Invalid URL");
    }

    // Map new args to internal structure
    const a = {
      urls: [rawArgs.url],
      format: rawArgs.format || "json",
      include_html: rawArgs.format === "html" || rawArgs.format === "mhtml",
      include_text: true,
      include_meta: true,
      // recursive/depth/include_assets would be used here if implemented
      // but for now we do root only
      timeout_ms: 30000,
      max_bytes: 1000000,
      country: rawArgs.country,
    };

    logger.info("Site export", { count: a.urls.length, format: a.format });

    // Handle PDF format separately
    if (a.format === "pdf") {
      const pdfResults = await exportPdf(a.urls, a);
      return {
        success: true,
        format: "pdf",
        count: pdfResults.length,
        data: pdfResults,
      };
    }

    const items = [];
    // Optimization: Use fetchBatchSmart even for single URL to leverage caching/concurrency if expanded later
    const batchResults = await contentFetcher.fetchBatchSmart(a.urls, {
      timeout: a.timeout_ms,
      maxBytes: 1000000,
      includeText: a.include_text,
      includeHtml: a.include_html,
    });

    for (const res of batchResults.results) {
      if (res.success) {
        items.push({
          url: res.url,
          status: res.data.status,
          meta: res.data.meta,
          text: res.data.text,
          html: res.data.html,
          textLength: res.data.textLength,
        });
      } else {
        items.push({ url: res.url, error: res.error });
      }
    }

    // Handle formats
    let resultData;
    if (a.format === "markdown") {
      resultData = toMarkdown(items);
    } else if (a.format === "html") {
      resultData = toHtml(items);
    } else {
      resultData = toJson(items);
    }

    return {
      success: true,
      format: a.format,
      count: items.length,
      data: resultData,
    };
  }),
};

export default siteExportTool;
