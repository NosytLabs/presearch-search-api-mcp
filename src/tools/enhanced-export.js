import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import logger from "../core/logger.js";
import contentFetcher from "../services/contentFetcher.js";
import { withErrorHandling, ValidationError } from "../utils/errors.js";
import {
  robustBoolean,
  robustNumber,
  robustInt,
  robustArray,
} from "../utils/schemas.js";

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

const zodSchema = z.object({
  urls: robustArray(z.string().url(), { min: 1 }).describe(
    "List of URLs to export. Can be a single URL string or an array of URL strings. Accepts JSON string or comma-separated list.",
  ),
  format: z
    .enum(["html", "json", "markdown", "pdf"])
    .default("json")
    .describe(
      "Export format: 'json' (structured data), 'markdown' (readable text), 'html' (web archive), or 'pdf' (visual capture).",
    ),
  include_html: robustBoolean()
    .default(true)
    .describe(
      "Include raw HTML content in the result (for non-PDF formats). Useful for debugging or custom parsing. Accepts boolean or string 'true'/'false'.",
    ),
  include_text: robustBoolean()
    .default(true)
    .describe(
      "Include extracted readable text content (for non-PDF formats). Ideal for LLM context. Accepts boolean or string 'true'/'false'.",
    ),
  include_meta: robustBoolean()
    .default(true)
    .describe(
      "Include parsed metadata (title, description, author) in the result. Accepts boolean or string 'true'/'false'.",
    ),
  timeout_ms: robustInt()
    .min(1000)
    .max(60000)
    .default(15000)
    .describe(
      "Timeout in milliseconds for the request. Accepts number or string.",
    ),
  max_bytes: robustInt()
    .min(10000)
    .max(5000000)
    .default(1000000)
    .describe(
      "Maximum size in bytes to download per URL. Accepts number or string.",
    ),
  file_output: robustBoolean()
    .default(false)
    .describe(
      "If true, saves the result to a file on the server instead of returning full content. Returns the file path. Accepts boolean or string 'true'/'false'.",
    ),
  filename: z
    .string()
    .max(100)
    .optional()
    .describe(
      "Optional filename prefix for saved files (used with file_output).",
    ),
  pdf_mode: z
    .enum(["dom", "screenshot"])
    .default("dom")
    .describe(
      "PDF capture mode: 'dom' (standard print) or 'screenshot' (image-based PDF). 'screenshot' is better for complex layouts.",
    ),
  pdf_paper: z
    .enum(["letter", "legal", "tabloid", "ledger", "a4", "a3"])
    .default("a4")
    .describe("Paper size for PDF export (e.g., 'a4', 'letter')."),
  pdf_margin_mm: robustNumber()
    .min(0)
    .max(50)
    .default(10)
    .describe("PDF margin in millimeters. Accepts number or string."),
  wait_until: z
    .enum(["load", "domcontentloaded", "networkidle0", "networkidle2"])
    .default("networkidle2")
    .describe(
      "Puppeteer wait condition: 'networkidle2' (recommended), 'load', 'domcontentloaded', or 'networkidle0'.",
    ),
  render_timeout_ms: robustInt()
    .min(1000)
    .max(60000)
    .default(15000)
    .describe("Timeout for PDF rendering/screenshot generation."),
  viewport: z
    .union([
      z.object({
        width: z.number().default(1280),
        height: z.number().default(800),
        deviceScaleFactor: z.number().default(1),
      }),
      z.string().transform((val) => {
        try {
          return JSON.parse(val);
        } catch {
          return { width: 1280, height: 800, deviceScaleFactor: 1 };
        }
      }),
    ])
    .default({ width: 1280, height: 800, deviceScaleFactor: 1 })
    .describe(
      "Viewport settings for headless browser {width, height, deviceScaleFactor}. Can be an object or JSON string.",
    ),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .describe("Country code for locale emulation (e.g. US, GB)."),
});

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
  let md = `# Exported Site Content\n\nGenerated: ${new Date().toISOString()}\nItems: ${items.length}\n\n`;
  for (const it of items) {
    md += `## ${it.meta?.title || it.url}\n- URL: ${it.url}\n- Status: ${it.status}\n- Description: ${it.meta?.description || ""}\n- TextLength: ${it.textLength}\n\n`;
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
                  `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(typeof v === "string" ? v : JSON.stringify(v))}</td></tr>`,
              )
              .join("")
          : "";
      const textBlock = it.text
        ? `<pre style="white-space:pre-wrap">${escapeHtml(it.text)}</pre>`
        : "";
      const htmlBlock = it.html
        ? `<details><summary>Raw HTML</summary><pre style="white-space:pre">${escapeHtml(it.html.substring(0, 200000))}</pre></details>`
        : "";
      return `
      <section class="item">
        <h2>${i + 1}. ${escapeHtml(it.meta?.title || it.url)}</h2>
        <p><strong>URL:</strong> <a href="${it.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.url)}</a></p>
        <p><strong>Status:</strong> ${it.status}</p>
        ${it.meta?.description ? `<p><strong>Description:</strong> ${escapeHtml(it.meta.description)}</p>` : ""}
        ${metaRows ? `<table class="meta"><tbody>${metaRows}</tbody></table>` : ""}
        ${textBlock}
        ${htmlBlock}
      </section>
    `;
    })
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Exported Site Content</title>
  <style>body{font-family:Arial,sans-serif;max-width:1000px;margin:20px auto;padding:0 20px} .item{border:1px solid #ddd;padding:12px;margin:10px 0;border-radius:6px} table.meta{border-collapse:collapse;width:100%} table.meta td{border:1px solid #eee;padding:6px}</style>
  </head><body><h1>Exported Site Content</h1><p>Generated: ${new Date().toISOString()}</p>${sections}</body></html>`;
}

async function exportPdf(urls, a) {
  const puppeteer = await getPuppeteer();
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({
    width: a.viewport.width,
    height: a.viewport.height,
    deviceScaleFactor: a.viewport.deviceScaleFactor,
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

  const exportsDir = path.join(process.cwd(), "exports");
  if (a.file_output) await fs.mkdir(exportsDir, { recursive: true });

  const files = [];
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const base = a.filename || `sites_${ts}`;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      await page.goto(url, {
        waitUntil: a.wait_until,
        timeout: a.render_timeout_ms,
      });
      let pdfBuffer;
      if (a.pdf_mode === "dom") {
        pdfBuffer = await page.pdf({
          format: a.pdf_paper.toUpperCase(),
          margin: {
            top: `${a.pdf_margin_mm}mm`,
            right: `${a.pdf_margin_mm}mm`,
            bottom: `${a.pdf_margin_mm}mm`,
            left: `${a.pdf_margin_mm}mm`,
          },
          printBackground: true,
        });
      } else {
        const shot = await page.screenshot({ fullPage: true });
        const html = `<html><body style="margin:0"><img src="data:image/png;base64,${shot.toString("base64")}" style="width:100%"/></body></html>`;
        await page.setContent(html, { waitUntil: "load" });
        pdfBuffer = await page.pdf({
          format: a.pdf_paper.toUpperCase(),
          margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
          printBackground: true,
        });
      }
      if (a.file_output) {
        const filePath = path.join(exportsDir, `${base}-${i + 1}.pdf`);
        await fs.writeFile(filePath, pdfBuffer);
        files.push({ url, file_path: filePath });
      } else {
        files.push({ url, pdf_base64: pdfBuffer.toString("base64") });
      }
    } catch (e) {
      files.push({ url, error: e.message });
    }
  }

  await browser.close();
  return files;
}

export const enhancedExportTool = {
  name: "export_site_content",
  description:
    "Exports site content for given URLs as JSON, Markdown, HTML, or PDF (headless capture).",
  inputSchema: zodSchema,
  execute: withErrorHandling("export_site_content", async (args) => {
    const parsed = zodSchema.safeParse(args);
    if (!parsed.success)
      throw new ValidationError("Invalid arguments", {
        errors: parsed.error.flatten(),
      });
    const a = parsed.data;

    if (a.format === "pdf") {
      const pdfFiles = await exportPdf(a.urls, a);
      return {
        success: true,
        format: "pdf",
        count: pdfFiles.length,
        items: pdfFiles,
      };
    }

    logger.info("Enhanced export", { count: a.urls.length, format: a.format });
    const items = [];
    for (const url of a.urls) {
      try {
        const res = await contentFetcher.fetch(url, {
          timeout: a.timeout_ms,
          maxBytes: a.max_bytes,
          includeText: a.include_text || a.format === "markdown",
        });
        items.push({
          url,
          status: res.status,
          meta: a.include_meta ? res.meta : undefined,
          text: a.include_text ? res.text : undefined,
          html: a.include_html ? res.html : undefined,
          textLength: res.textLength,
        });
      } catch (e) {
        items.push({ url, error: e.message });
      }
    }

    if (a.file_output) {
      const exportsDir = path.join(process.cwd(), "exports");
      await fs.mkdir(exportsDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const base = a.filename || `export_${ts}`;
      let content = "";
      let ext = a.format;
      if (a.format === "json") content = toJson(items);
      else if (a.format === "markdown") {
        content = toMarkdown(items);
        ext = "md";
      } else if (a.format === "html") content = toHtml(items);

      const filePath = path.join(exportsDir, `${base}.${ext}`);
      await fs.writeFile(filePath, content, "utf8");
      return {
        success: true,
        format: a.format,
        count: items.length,
        file_path: filePath,
        items: items.map((i) => ({ url: i.url, status: i.status || "error" })),
      };
    }

    let resultData = items;
    if (a.format === "markdown") resultData = toMarkdown(items);
    else if (a.format === "html") resultData = toHtml(items);
    else if (a.format === "json") resultData = toJson(items);

    return {
      success: true,
      format: a.format,
      count: items.length,
      data: resultData,
    };
  }),
};
