// Figma REST API types — only the fields we actually use.
// Refs:
//   https://developers.figma.com/docs/rest-api/comments-types/
//   https://developers.figma.com/docs/rest-api/comments-property-types/

export interface FigmaUser {
  id?: string;
  handle: string;
  img_url?: string;
}

export interface Vector {
  x: number;
  y: number;
}

/** client_meta shape 1: bare absolute canvas coordinate (no node attached). */
export interface ClientMetaVector {
  x: number;
  y: number;
}

/** client_meta shape 2: pin attached to a frame/node. */
export interface ClientMetaFrameOffset {
  node_id: string;
  node_offset: Vector;
}

/** client_meta shape 3: rectangular region in absolute coords. */
export interface ClientMetaRegion {
  x: number;
  y: number;
  region_height: number;
  region_width: number;
}

/** client_meta shape 4: region attached to a node. */
export interface ClientMetaFrameOffsetRegion {
  node_id: string;
  node_offset: Vector;
  region_height: number;
  region_width: number;
}

export type ClientMeta =
  | ClientMetaVector
  | ClientMetaFrameOffset
  | ClientMetaRegion
  | ClientMetaFrameOffsetRegion
  | null;

export interface Reaction {
  user: FigmaUser;
  emoji: string;
  created_at: string;
}

export interface Comment {
  id: string;
  file_key: string;
  parent_id: string;
  user: FigmaUser;
  created_at: string;
  resolved_at?: string | null;
  /** Only present on root comments; the number shown on the UI pin. */
  order_id?: string | null;
  message: string;
  reactions?: Reaction[];
  client_meta?: ClientMeta;
}

export interface CommentsResponse {
  comments: Comment[];
}

// --- Node tree (GET /v1/files/:key) ---

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  absoluteBoundingBox?: BoundingBox | null;
  children?: FigmaNode[];
}

export interface FileResponse {
  name: string;
  document: FigmaNode;
}

export interface ImagesResponse {
  err: string | null;
  images: Record<string, string | null>;
}

// --- Type guards for client_meta ---

export function hasNodeId(
  meta: ClientMeta,
): meta is ClientMetaFrameOffset | ClientMetaFrameOffsetRegion {
  return !!meta && typeof (meta as ClientMetaFrameOffset).node_id === "string";
}

export function hasCoords(
  meta: ClientMeta,
): meta is ClientMetaVector | ClientMetaRegion {
  return (
    !!meta &&
    !hasNodeId(meta) &&
    typeof (meta as ClientMetaVector).x === "number" &&
    typeof (meta as ClientMetaVector).y === "number"
  );
}
