/**
 * Type definitions for the LLM chat application.
 */
import type { D1Database, Ai, Fetcher } from "@cloudflare/workers-types";
export interface Env {
  /**
   * Binding for the Workers AI API.
   */
  AI: Ai;
  DB: D1Database;
  ASSETS: Fetcher;
  /**
   * Binding for static assets.
   */
  /**ASSETS: { fetch: (request: Request) => Promise<Response> };
   *
   */
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
