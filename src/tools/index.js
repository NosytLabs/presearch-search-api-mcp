import { searchTool } from "./search.js";
import { searchAndScrapeTool } from "./search-scrape.js";
import { deepResearchTool } from "./deep-research.js";
import { exportResultsTool } from "./export.js";
import { siteExportTool } from "./site-export.js";
import { contentAnalysisTool } from "./content-analysis.js";
import { scrapeTool } from "./scrape.js";
import { cacheStatsTool, cacheClearTool } from "./cache.js";
import { healthTool } from "./health.js";
import { nodeStatusTool } from "./node-status.js";

export { searchTool } from "./search.js";
export { searchAndScrapeTool } from "./search-scrape.js";
export { deepResearchTool } from "./deep-research.js";
export { exportResultsTool } from "./export.js";
export { siteExportTool } from "./site-export.js";
export { contentAnalysisTool } from "./content-analysis.js";
export { scrapeTool } from "./scrape.js";
export { cacheStatsTool, cacheClearTool } from "./cache.js";
export { healthTool } from "./health.js";
export { nodeStatusTool } from "./node-status.js";

export const tools = [
  searchTool,
  searchAndScrapeTool,
  deepResearchTool,
  exportResultsTool,
  siteExportTool,
  contentAnalysisTool,
  scrapeTool,
  cacheStatsTool,
  cacheClearTool,
  healthTool,
  nodeStatusTool,
];
