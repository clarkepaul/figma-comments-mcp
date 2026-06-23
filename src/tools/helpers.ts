import { FigmaApiError } from "../figma/client.js";

export interface ToolResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  >;
  isError?: boolean;
  // The SDK's CallToolResult carries an index signature; mirror it so our
  // handler return type is assignable to what registerTool expects.
  [key: string]: unknown;
}

export function text(value: string): ToolResult {
  return { content: [{ type: "text", text: value }] };
}

export function json(value: unknown): ToolResult {
  return text(JSON.stringify(value, null, 2));
}

export function errorResult(err: unknown): ToolResult {
  const message =
    err instanceof FigmaApiError || err instanceof Error
      ? err.message
      : String(err);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/** Wrap an async handler so thrown errors become structured tool errors. */
export function safe<TArgs>(
  handler: (args: TArgs) => Promise<ToolResult>,
): (args: TArgs) => Promise<ToolResult> {
  return async (args: TArgs) => {
    try {
      return await handler(args);
    } catch (err) {
      return errorResult(err);
    }
  };
}
