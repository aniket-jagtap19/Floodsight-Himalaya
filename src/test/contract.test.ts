import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { RunResultSchema } from "../lib/schemas";

const SCHEMA_PATH = path.resolve(__dirname, "../../backend/data/runresult.schema.json");

interface Difference {
  path: string;
  type: "missing_field" | "extra_field" | "nullability_mismatch";
  message: string;
  backend?: unknown;
  frontend?: unknown;
}

interface JsonSchemaNode {
  type?: string | string[];
  $defs?: Record<string, JsonSchemaNode>;
  $ref?: string;
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  prefixItems?: JsonSchemaNode[];
  default?: unknown;
  [key: string]: unknown;
}

function resolveJsonNode(
  node: JsonSchemaNode,
  defs: Record<string, JsonSchemaNode>,
): {
  resolved: JsonSchemaNode;
  isNullable: boolean;
} {
  let isNullable = false;
  let current = node;

  if (current.anyOf) {
    const hasNull = current.anyOf.some((s) => s.type === "null");
    if (hasNull) isNullable = true;
    const nonNull = current.anyOf.filter((s) => s.type !== "null");
    if (nonNull.length === 1 && nonNull[0]) {
      current = nonNull[0];
    }
  }

  const ref = current["$ref"];
  if (ref) {
    const refKey = ref.replace("#/$defs/", "");
    const def = defs[refKey];
    if (!def) {
      throw new Error(`Unresolved $ref: ${ref}`);
    }
    const inner = resolveJsonNode(def, defs);
    return { resolved: inner.resolved, isNullable: isNullable || inner.isNullable };
  }

  return { resolved: current, isNullable };
}

function unwrapZod(zodNode: z.ZodTypeAny): {
  inner: z.ZodTypeAny;
  isNullable: boolean;
  isOptional: boolean;
} {
  let current = zodNode;
  let isNullable = false;
  let isOptional = false;

  while (true) {
    if (current instanceof z.ZodNullable) {
      isNullable = true;
      current = current.unwrap();
    } else if (current instanceof z.ZodOptional) {
      isOptional = true;
      current = current.unwrap();
    } else if (current instanceof z.ZodDefault) {
      current = current._def.innerType;
    } else if (current instanceof z.ZodEffects) {
      current = current._def.schema;
    } else {
      break;
    }
  }

  return { inner: current, isNullable, isOptional };
}

export function compareContract(
  jsonNode: JsonSchemaNode,
  zodNode: z.ZodTypeAny,
  currentPath: string,
  defs: Record<string, JsonSchemaNode>,
): Difference[] {
  const diffs: Difference[] = [];
  const { resolved: jsonResolved, isNullable: jsonNullable } = resolveJsonNode(jsonNode, defs);
  const { inner: zodInner, isNullable: zodNullable, isOptional: zodOptional } = unwrapZod(zodNode);

  const backendAllowsNull = jsonNullable;
  const frontendAllowsNull = zodNullable || (zodOptional && jsonNullable);

  if (backendAllowsNull !== frontendAllowsNull) {
    diffs.push({
      path: currentPath,
      type: "nullability_mismatch",
      message: `Nullability mismatch at '${currentPath}': Backend allows null = ${backendAllowsNull}, but Frontend allows null = ${frontendAllowsNull}`,
      backend: backendAllowsNull,
      frontend: frontendAllowsNull,
    });
  }

  if (jsonResolved.type === "object" || jsonResolved.properties) {
    if (!(zodInner instanceof z.ZodObject)) {
      diffs.push({
        path: currentPath,
        type: "missing_field",
        message: `Type mismatch at '${currentPath}': Backend expects object, Frontend has ${zodInner.constructor.name}`,
      });
      return diffs;
    }

    const jsonProps: Record<string, JsonSchemaNode> = jsonResolved.properties || {};
    const zodShape: Record<string, z.ZodTypeAny> = zodInner.shape;

    const jsonKeys = new Set(Object.keys(jsonProps));
    const zodKeys = new Set(Object.keys(zodShape));

    for (const key of jsonKeys) {
      if (!zodKeys.has(key)) {
        diffs.push({
          path: `${currentPath}.${key}`,
          type: "missing_field",
          message: `Missing field in frontend schema at '${currentPath}.${key}' (defined in backend schema)`,
        });
      }
    }

    for (const key of zodKeys) {
      if (!jsonKeys.has(key)) {
        diffs.push({
          path: `${currentPath}.${key}`,
          type: "extra_field",
          message: `Extra field in frontend schema at '${currentPath}.${key}' (not found in backend schema)`,
        });
      }
    }

    for (const key of jsonKeys) {
      if (zodKeys.has(key) && jsonProps[key] && zodShape[key]) {
        const nestedDiffs = compareContract(
          jsonProps[key],
          zodShape[key],
          `${currentPath}.${key}`,
          defs,
        );
        diffs.push(...nestedDiffs);
      }
    }

    return diffs;
  }

  if (jsonResolved.type === "array") {
    if (zodInner instanceof z.ZodArray) {
      if (jsonResolved.items) {
        const itemDiffs = compareContract(
          jsonResolved.items,
          zodInner.element,
          `${currentPath}[]`,
          defs,
        );
        diffs.push(...itemDiffs);
      }
    } else if (zodInner instanceof z.ZodTuple) {
      if (jsonResolved.prefixItems) {
        jsonResolved.prefixItems.forEach((itemNode: JsonSchemaNode, idx: number) => {
          if (idx < zodInner.items.length && zodInner.items[idx]) {
            const itemDiffs = compareContract(
              itemNode,
              zodInner.items[idx],
              `${currentPath}[${idx}]`,
              defs,
            );
            diffs.push(...itemDiffs);
          }
        });
      }
    } else {
      diffs.push({
        path: currentPath,
        type: "missing_field",
        message: `Type mismatch at '${currentPath}': Backend expects array, Frontend has ${zodInner.constructor.name}`,
      });
    }
  }

  return diffs;
}

describe("Frontend/Backend Contract Guard", () => {
  it("confirms backend/data/runresult.schema.json exists before testing", () => {
    const exists = fs.existsSync(SCHEMA_PATH);
    expect(
      exists,
      `Contract schema file missing at ${SCHEMA_PATH}. Run 'npm run contract:check' or 'python backend/scripts/export_schema.py' first.`,
    ).toBe(true);
  });

  it("verifies RunResult JSON Schema matches frontend RunResultSchema recursively", () => {
    expect(fs.existsSync(SCHEMA_PATH)).toBe(true);
    const raw = fs.readFileSync(SCHEMA_PATH, "utf8");
    const jsonSchema = JSON.parse(raw) as JsonSchemaNode;
    const defs = jsonSchema["$defs"] || {};

    const diffs = compareContract(jsonSchema, RunResultSchema, "RunResult", defs);

    if (diffs.length > 0) {
      const formatted = diffs.map((d) => `  - [${d.type}] ${d.message}`).join("\n");
      expect.fail(
        `Contract verification failed with ${diffs.length} discrepancy(ies):\n${formatted}`,
      );
    }

    expect(diffs).toEqual([]);
  });

  it("detects deliberate contract drift (missing field)", () => {
    const fakeSchema: JsonSchemaNode = {
      type: "object",
      properties: {
        runId: { type: "string" },
        unexpectedNewBackendField: { type: "string" },
      },
      required: ["runId", "unexpectedNewBackendField"],
    };

    const diffs = compareContract(fakeSchema, RunResultSchema, "RunResult", {});
    const missing = diffs.find(
      (d) => d.type === "missing_field" && d.path.includes("unexpectedNewBackendField"),
    );
    expect(missing).toBeDefined();
    expect(missing?.message).toContain("unexpectedNewBackendField");
  });

  it("detects deliberate contract drift (nullability mismatch)", () => {
    const miniJsonSchema: JsonSchemaNode = {
      type: "object",
      properties: {
        runId: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
      },
    };
    const miniZodSchema = z.object({
      runId: z.string(),
    });

    const diffs = compareContract(miniJsonSchema, miniZodSchema, "Mini", {});
    const mismatch = diffs.find((d) => d.type === "nullability_mismatch");
    expect(mismatch).toBeDefined();
    expect(mismatch?.message).toContain("Nullability mismatch at 'Mini.runId'");
  });
});
