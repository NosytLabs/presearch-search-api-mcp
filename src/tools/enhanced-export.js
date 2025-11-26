import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../core/logger.js";
import apiClient from "../core/apiClient.js";
import contentFetcher from "../services/contentFetcher.js";
import { withErrorHandling, ValidationError } from "../utils/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getPuppeteer() {
  try {
    const mod = await import("puppeteer");
    return mod.default || mod;
  } catch (e) {
    throw new ValidationError("PDF export requires puppeteer to be installed", {
      dependency: "puppeteer",
      install: "npm i puppeteer",
    });
  }
}

const inputSchema = {
  type: "object",
  properties: {
    urls: {
      type: "array",
      items: { type: "string", format: "uri" },
      minItems: 1,
      description: "List of URLs to export",
    },
    format: {
      type: "string",
      enum: ["html", "json", "markdown", "pdf"],
      default: "json",
      description: "Export format",
    },
    include_html: {
      type: "boolean",
      default: true,
      description: "Include raw HTML in results (non-PDF formats)",
    },
    include_text: {
      type: "boolean",
      default: true,
      description: "Include extracted readable text (non-PDF formats)",
    },
    include_meta: {
      type: "boolean",
      default: true,
      description: "Include parsed meta tags (non-PDF formats)",
    },
    timeout_ms: {
      type: "number",
      minimum: 1000,
      maximum: 60000,
      default: 15000,
    },
    max_bytes: {
      type: "number",
      minimum: 10000,
      maximum: 5000000,
      default: 1000000,
    },
    file_output: { type: "boolean", default: false },
    filename: { type: "string", maxLength: 100 },
    pdf_mode: {
      type: "string",
      enum: ["dom", "screenshot"],
      default: "dom",
      description: "PDF capture mode using headless browser",
    },
    pdf_paper: {
      type: "string",
      enum: ["letter", "legal", "tabloid", "ledger", "a4", "a3"],
      default: "a4",
    },
    pdf_margin_mm: { type: "number", minimum: 0, maximum: 50, default: 10 },
    wait_until: {
      type: "string",
      enum: ["load", "domcontentloaded", "networkidle0", "networkidle2"],
      default: "networkidle2",
    },
    render_timeout_ms: {
      type: "number",
      minimum: 1000,
      maximum: 60000,
      default: 15000,
    },
    viewport: {
      type: "object",
      properties: {
        width: { type: "number" },
        height: { type: "number" },
        deviceScaleFactor: { type: "number" },
      },
      default: { width: 1280, height: 800, deviceScaleFactor: 1 },
    },
    country: {
      type: "string",
      pattern: "^[A-Z]{2}$",
      description: "Country code for locale emulation (e.g. US, GB)",
    },
  },
  required: ["urls"],
};

const zodSchema = z.object({
  urls: z.array(z.string().url()).min(1),
  format: z.enum(["html", "json", "markdown", "pdf"]).default("json"),
  include_html: z.boolean().default(true),
  include_text: z.boolean().default(true),
  include_meta: z.boolean().default(true),
  timeout_ms: z.number().int().min(1000).max(60000).default(15000),
  max_bytes: z.number().int().min(10000).max(5000000).default(1000000),
  file_output: z.boolean().default(false),
  filename: z.string().max(100).optional(),
  pdf_mode: z.enum(["dom", "screenshot"]).default("dom"),
  pdf_paper: z
    .enum(["letter", "legal", "tabloid", "ledger", "a4", "a3"])
    .default("a4"),
  pdf_margin_mm: z.number().min(0).max(50).default(10),
  wait_until: z
    .enum(["load", "domcontentloaded", "networkidle0", "networkidle2"])
    .default("networkidle2"),
  render_timeout_ms: z.number().int().min(1000).max(60000).default(15000),
  viewport: z
    .object({
      width: z.number().default(1280),
      height: z.number().default(800),
      deviceScaleFactor: z.number().default(1),
    })
    .default({ width: 1280, height: 800, deviceScaleFactor: 1 }),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
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
  inputSchema,
  execute: withErrorHandling("export_site_content", async (args, context) => {
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
        count: pdfFiles.length,
        pdf_files: pdfFiles,
        file_output: a.file_output,
        metadata: {
          generated_at: new Date().toISOString(),
          rateLimit: apiClient.getRateLimitStats(),
        },
      };
    }

    logger.info("Enhanced export starting", {
      count: a.urls.length,
      format: a.format,
    });

    const items = [];
    for (const url of a.urls) {
      try {
        const res = await contentFetcher.fetch(url, {
          timeout: a.timeout_ms,
          maxBytes: a.max_bytes,
          includeText: a.include_text,
          includeHtml: a.include_html,
        });
        items.push({
          url,
          status: res.status,
          meta: a.include_meta ? res.meta : undefined,
          text: a.include_text ? res.text : undefined,
          textLength: res.textLength,
          html: a.include_html ? res.html : undefined,
        });
      } catch (e) {
        items.push({ url, error: e.message });
      }
    }

    let export_data;
    switch (a.format) {
      case "markdown":
        export_data = toMarkdown(items);
        break;
      case "html":
        export_data = toHtml(items);
        break;
      case "json":
      default:
        export_data = toJson(items);
        break;
    }

    let file_path = null;
    if (a.file_output) {
      const exportsDir = path.join(process.cwd(), "exports");
      await fs.mkdir(exportsDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const base = a.filename || `sites_${ts}`;
      const ext = a.format;
      file_path = path.join(exportsDir, `${base}.${ext}`);
      await fs.writeFile(file_path, export_data, "utf8");
      logger.info("Enhanced export file saved", { file_path });
    }

    return {
      success: true,
      count: items.length,
      items,
      export_data,
      file_path,
      metadata: {
        generated_at: new Date().toISOString(),
        rateLimit: apiClient.getRateLimitStats(),
      },
    };
  }),
};

export default enhancedExportTool;
export { enhancedExportTool as enhancedExport };
