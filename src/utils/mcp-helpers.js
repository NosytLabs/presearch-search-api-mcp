import { zodToJsonSchema } from "zod-to-json-schema";
import logger from "../core/logger.js";

/**
 * Formats a list of tools for the MCP ListToolsRequest
 * Handles Zod to JSON Schema conversion and Smithery compatibility
 * @param {Array} tools - Array of tool objects
 * @returns {Array} Formatted tool objects
 */
export const formatToolList = (tools) => {
  return tools.map((t) => {
    let jsonSchema = { type: "object", properties: {} };
    if (t.inputSchema?._def) {
      try {
        // Force JSON Schema Draft 7 which is widely supported
        jsonSchema = zodToJsonSchema(t.inputSchema, { target: "jsonSchema7" });
        
        // Ensure $schema is removed as it's not valid in the nested inputSchema
        if (jsonSchema && typeof jsonSchema === 'object') {
            delete jsonSchema.$schema;
            
            // Ensure additionalProperties is explicitly set if not present
            // This helps some strict parsers
            if (jsonSchema.type === "object" && jsonSchema.additionalProperties === undefined) {
                jsonSchema.additionalProperties = false;
            }
        }
      } catch (e) {
        logger.error(`Failed to convert schema for ${t.name}`, { error: e.message });
        // Fallback to basic object schema if conversion fails
        jsonSchema = { type: "object", properties: {}, additionalProperties: true };
      }
    } else if (t.inputSchema) {
        jsonSchema = t.inputSchema;
    }
    
    // Smithery compatibility: ensure 'title' is present at top level if available in annotations
    const title = (t.annotations && t.annotations.title) || t.name;

    return {
      name: t.name,
      title: title,
      description: t.description,
      input_schema: jsonSchema,
      inputSchema: jsonSchema,
      annotations: t.annotations || {},
      tags: t.tags || [],
    };
  });
};

/**
 * Formats a list of prompts for the MCP ListPromptsRequest
 * Handles Smithery compatibility
 * @param {Array} prompts - Array of prompt objects
 * @returns {Array} Formatted prompt objects
 */
export const formatPromptList = (prompts) => {
  return prompts.map((p) => {
    // Smithery compatibility: ensure 'title' is present at top level
    const title = p.title || (p.annotations && p.annotations.title) || p.name;
    
    return {
      name: p.name,
      title: title, // Explicitly set title
      description: p.description,
      arguments: p.arguments,
      annotations: p.annotations || { title: title }, // Ensure annotations exist
    };
  });
};
