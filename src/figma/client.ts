import type {
  Comment,
  CommentsResponse,
  FileResponse,
  ImagesResponse,
  Reaction,
} from "./types.js";

const BASE_URL = "https://api.figma.com";
const MAX_RETRIES = 3;

export class FigmaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FigmaApiError";
  }
}

interface ReactionsResponse {
  reactions: Reaction[];
  pagination?: { next_page?: string | null };
}

export interface PostCommentBody {
  message: string;
  /** Root comment id when posting a reply. Must reference a root (top-level) comment. */
  comment_id?: string;
  client_meta?: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class FigmaClient {
  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  // --- Reads ---

  async listComments(fileKey: string, asMarkdown = true): Promise<Comment[]> {
    const qs = asMarkdown ? "?as_md=true" : "";
    const data = await this.request<CommentsResponse>(
      `/v1/files/${encodeURIComponent(fileKey)}/comments${qs}`,
    );
    return data.comments ?? [];
  }

  async getFile(fileKey: string, depth = 0): Promise<FileResponse> {
    // Bound the tree depth: an unbounded fetch on a large file can exceed what
    // the connection will deliver and gets terminated (UND_ERR_SOCKET).
    const qs = depth > 0 ? `?depth=${depth}` : "";
    return this.request<FileResponse>(`/v1/files/${encodeURIComponent(fileKey)}${qs}`);
  }

  async getImages(
    fileKey: string,
    nodeIds: string[],
    scale = 2,
    format: "png" | "svg" | "jpg" | "pdf" = "png",
  ): Promise<ImagesResponse> {
    const params = new URLSearchParams({
      ids: nodeIds.join(","),
      scale: String(scale),
      format,
    });
    return this.request<ImagesResponse>(
      `/v1/images/${encodeURIComponent(fileKey)}?${params.toString()}`,
    );
  }

  async getReactions(fileKey: string, commentId: string): Promise<Reaction[]> {
    const reactions: Reaction[] = [];
    let cursor: string | null | undefined;
    do {
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const data = await this.request<ReactionsResponse>(
        `/v1/files/${encodeURIComponent(fileKey)}/comments/${encodeURIComponent(commentId)}/reactions${qs}`,
      );
      reactions.push(...(data.reactions ?? []));
      cursor = data.pagination?.next_page ?? null;
    } while (cursor);
    return reactions;
  }

  // --- Writes ---

  async postComment(fileKey: string, body: PostCommentBody): Promise<Comment> {
    return this.request<Comment>(
      `/v1/files/${encodeURIComponent(fileKey)}/comments`,
      { method: "POST", body },
    );
  }

  async postReaction(
    fileKey: string,
    commentId: string,
    emoji: string,
  ): Promise<unknown> {
    return this.request(
      `/v1/files/${encodeURIComponent(fileKey)}/comments/${encodeURIComponent(commentId)}/reactions`,
      { method: "POST", body: { emoji } },
    );
  }

  // --- Core request with error mapping + 429 backoff ---

  private async request<T>(
    path: string,
    opts: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const init: RequestInit = {
      method: opts.method ?? "GET",
      headers: {
        "X-Figma-Token": this.token,
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    };

    let attempt = 0;
    while (true) {
      const res = await this.fetchImpl(url, init);

      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 2 ** attempt * 1000;
        attempt += 1;
        await sleep(delay);
        continue;
      }

      if (!res.ok) {
        throw new FigmaApiError(await this.errorMessage(res), res.status);
      }

      // Some write endpoints return empty bodies.
      const text = await res.text();
      return (text ? JSON.parse(text) : {}) as T;
    }
  }

  private async errorMessage(res: Response): Promise<string> {
    let detail = "";
    try {
      const body = await res.text();
      detail = body ? ` — ${body.slice(0, 300)}` : "";
    } catch {
      /* ignore */
    }

    switch (res.status) {
      case 403:
        return (
          "Figma API 403 (forbidden): token is invalid/expired or missing a required scope " +
          "(need file_comments:read + file_content:read; file_comments:write for write tools)." +
          detail
        );
      case 404:
        return (
          "Figma API 404 (not found): wrong file key, or the token's account cannot access this file. " +
          "Check the file key and that the file is shared with the token owner." +
          detail
        );
      case 429:
        return "Figma API 429 (rate limited): retries exhausted. Try again shortly." + detail;
      default:
        return `Figma API ${res.status} (${res.statusText})${detail}`;
    }
  }
}
