/**
 * createAccount - POSTs the signup form to /api/signup
 * @param {Object} data  The same payload you send today
 * @returns {Promise<Response>}
 */
export async function createAccount(data) {
  const res = await fetch("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    // pass through JSON error from Worker (409 or 500)
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error || `Signup failed (${res.status})`);
  }
  return res.json();
}

