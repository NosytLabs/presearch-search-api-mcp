import { searchTool } from "./search.js";
import { searchAndScrapeTool } from "./search-scrape.js";
import { deepResearchTool } from "./deep-research.js";
import { exportResultsTool } from "./export.js";
import { contentAnalysisTool } from "./content-analysis.js";
import { scrapeTool } from "./scrape.js";
import { cacheStatsTool, cacheClearTool } from "./cache.js";
import { healthTool } from "./health.js";
import { nodeStatusTool } from "./node-status.js";
import { siteExportTool } from "./site-export.js";

export {
  searchTool,
  searchAndScrapeTool,
  deepResearchTool,
  exportResultsTool,
  contentAnalysisTool,
  scrapeTool,
  cacheStatsTool,
  cacheClearTool,
  healthTool,
  nodeStatusTool,
  siteExportTool,
};

export const tools = [
  searchTool,
  searchAndScrapeTool,
  deepResearchTool,
  exportResultsTool,
  contentAnalysisTool,
  scrapeTool,
  cacheStatsTool,
  cacheClearTool,
  healthTool,
  nodeStatusTool,
  siteExportTool,
];
