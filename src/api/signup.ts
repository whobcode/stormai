// src/api/signup.ts
export async function handleSignup(request: Request, env: Env): Promise<Response> {
  const data = await request.json();

  const email = (data.email || "").toLowerCase().trim();
  if (!email) return new Response("Missing email", { status: 400 });

  await env.USER_DATA.put(email, JSON.stringify(data));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
}

