import { describe, it, expect } from "vitest";
import { parseFigmaRef, parseFileKey, normalizeNodeId } from "../src/figma/url.js";

describe("parseFigmaRef", () => {
  it("extracts the key from a /design URL", () => {
    const ref = parseFigmaRef("https://www.figma.com/design/abc123XYZ/My-File?node-id=1-360");
    expect(ref.fileKey).toBe("abc123XYZ");
    expect(ref.nodeId).toBe("1:360");
  });

  it("extracts the key from a legacy /file URL", () => {
    expect(parseFigmaRef("https://www.figma.com/file/KEY12345/Name").fileKey).toBe("KEY12345");
  });

  it("extracts the key from a /board URL", () => {
    expect(parseFigmaRef("https://www.figma.com/board/BOARD999/Jam").fileKey).toBe("BOARD999");
  });

  it("accepts a bare key", () => {
    const ref = parseFigmaRef("zXcVbNmAsDf123");
    expect(ref.fileKey).toBe("zXcVbNmAsDf123");
    expect(ref.nodeId).toBeUndefined();
  });

  it("captures node-id even when other query params precede it", () => {
    const ref = parseFigmaRef("https://www.figma.com/design/K/file?t=abc&node-id=42-7&mode=dev");
    expect(ref.nodeId).toBe("42:7");
  });

  it("throws on unparseable input", () => {
    expect(() => parseFigmaRef("not a url or key !!")).toThrow(/file key/);
  });
});

describe("parseFileKey", () => {
  it("returns just the key", () => {
    expect(parseFileKey("https://www.figma.com/design/onlyKey/Name")).toBe("onlyKey");
  });
});

describe("normalizeNodeId", () => {
  it("converts dashes to colons", () => {
    expect(normalizeNodeId("1-360")).toBe("1:360");
    expect(normalizeNodeId("12-3-4")).toBe("12:3:4");
  });
});
