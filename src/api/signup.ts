// src/api/signup.ts
import type { Env } from "../types";

export async function handleSignup(request: Request, env: Env): Promise<Response> {
  const data = await request.json();
  const email = (data.email || "").toLowerCase().trim();
  if (!email) return new Response("Missing email", { status: 400 });

  try {
    await env.DB.prepare(
      `INSERT INTO users
       (firstName, lastName, email, phone, aiPurpose, dob,
        favoriteColor, favoriteAnimal, stylePrefs)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`
    )
    .bind(
      data.firstName, data.lastName, email, data.phone ?? null,
      data.aiPurpose ?? null, data.dob ?? null,
      data.favoriteColor ?? null, data.favoriteAnimal ?? null,
      data.stylePrefs ?? null
    )
    .run();

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const status = err.message?.includes("UNIQUE") ? 409 : 500;
    return new Response(JSON.stringify({ error: err.message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

