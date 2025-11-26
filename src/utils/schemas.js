import { z } from "zod";

/**
 * Robust Boolean Schema
 * Handles booleans, strings ("true", "false"), and numbers (1, 0)
 */
export const robustBoolean = () =>
  z.union([z.boolean(), z.string(), z.number()]).transform((val) => {
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val !== 0;
    if (typeof val === "string") {
      const lower = val.toLowerCase().trim();
      return lower === "true" || lower === "1" || lower === "yes";
    }
    return false;
  });

/**
 * Robust Number Schema
 * Handles numbers and numeric strings using Zod coercion
 */
export const robustNumber = () => z.coerce.number();

/**
 * Robust Int Schema
 */
export const robustInt = () => z.coerce.number().int();

/**
 * Robust Array Schema
 * Handles arrays and comma-separated strings or JSON strings
 * @param {z.ZodType} itemSchema
 * @param {Object} options - { min: number, max: number }
 */
export const robustArray = (itemSchema = z.string(), options = {}) => {
  let schema = z.union([z.array(itemSchema), z.string()]).transform((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // Fall through to split
        }
      }
      return trimmed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  });

  if (options.min !== undefined) {
    schema = schema.refine((arr) => arr.length >= options.min, {
      message: `Array must contain at least ${options.min} element(s)`,
    });
  }
  if (options.max !== undefined) {
    schema = schema.refine((arr) => arr.length <= options.max, {
      message: `Array must contain at most ${options.max} element(s)`,
    });
  }

  return schema;
};
