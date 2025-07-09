/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE)
 * **/
// src/index.ts
import { Env, ChatMessage } from "./types";
import { handleSignup } from "./api/signup";

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant. Provide concise and accurate responses.";

export default <ExportedHandler<Env>>{
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    // 1️⃣  Static assets
    if (pathname === "/" || !pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // 2️⃣  API routes
    if (pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }
    if (pathname === "/api/signup" && request.method === "POST") {
      return handleSignup(request, env);           // <- delegates to D1 helper
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleChat(request: Request, env: Env): Promise<Response> {
  try {
    const { messages = [] } = (await request.json()) as { messages?: ChatMessage[] };

    // Add system prompt if not present
    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    const response = await env.AI.run(
      MODEL_ID,
      {
        messages,
        max_tokens: 1024,
      },
      {
        returnRawResponse: true,
        // Uncomment to use AI Gateway
        // gateway: {
        //   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
        //   skipCache: false,      // Set to true to bypass cache
        //   cacheTtl: 3600,        // Cache time-to-live in seconds
        // },
      },
    );

    // Return streaming response
    return response;
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
