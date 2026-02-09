import { type ZodTypeAny } from "zod";

function wrapUnion(parts: string[]) {
  return parts.filter(Boolean).join(" | ") || "unknown";
}

function needsParens(type: string) {
  return type.includes(" | ") || type.includes("&");
}

function withNullable(type: string, suffix: string) {
  const base = needsParens(type) ? `(${type})` : type;
  return `${base} ${suffix}`;
}

function indentBlock(block: string, indent = "  ") {
  return block
    .split("\n")
    .map((line) => (line.length ? `${indent}${line}` : line))
    .join("\n");
}

export function zodSchemaToTs(schema: ZodTypeAny): string {
  if (!schema) return "unknown";
  const description = schema.description?.trim();
  if (description) return description;
  const def: any = schema._def;
  if (!def) return "unknown";
  switch (def.type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "bigint":
      return "bigint";
    case "date":
      return "Date";
    case "literal":
      return JSON.stringify(def.values[0]);
    case "enum":
      return wrapUnion(Object.values(def.entries).map((entry) => JSON.stringify(entry)));
    case "union":
      return wrapUnion(def.options.map((option: ZodTypeAny) => zodSchemaToTs(option)));
    case "array": {
      const element = zodSchemaToTs(def.element);
      return needsParens(element) ? `(${element})[]` : `${element}[]`;
    }
    case "tuple":
      return `[${def.items.map((item: ZodTypeAny) => zodSchemaToTs(item)).join(", ")}]`;
    case "record": {
      const keySchema: ZodTypeAny | undefined =
        def.keyType ?? (schema as any).keySchema;
      const valueSchema: ZodTypeAny | undefined =
        def.valueType ?? (schema as any).valueType ?? (schema as any).valueSchema;
      const key = zodSchemaToTs(keySchema as ZodTypeAny);
      const value = zodSchemaToTs(valueSchema as ZodTypeAny);
      return `Record<${key}, ${value}>`;
    }
    case "object": {
      const shape = typeof def.shape === "function" ? def.shape() : def.shape;
      const entries = Object.entries(shape ?? {});
      if (!entries.length) return "{}";
      const content = entries
        .map(([key, value]) => `${JSON.stringify(key)}: ${zodSchemaToTs(value as ZodTypeAny)};`)
        .join("\n");
      return `{\n${indentBlock(content)}\n}`;
    }
    case "optional":
      return withNullable(zodSchemaToTs(def.innerType), "| undefined");
    case "nullable":
      return withNullable(zodSchemaToTs(def.innerType), "| null");
    case "default":
    case "catch":
    case "readonly":
      return zodSchemaToTs(def.innerType);
    case "lazy":
      return zodSchemaToTs(def.getter());
    case "effects":
      return zodSchemaToTs(def.schema);
    case "promise":
      return `Promise<${zodSchemaToTs(def.type)}>`;
    case "nativeEnum":
      return wrapUnion(Object.values(def.values).map((value) => JSON.stringify(value)));
    case "set":
      return `Set<${zodSchemaToTs(def.valueType)}>`;
    case "map":
      return `Map<${zodSchemaToTs(def.keyType)}, ${zodSchemaToTs(def.valueType)}>`;
    default:
      return "unknown";
  }
}
