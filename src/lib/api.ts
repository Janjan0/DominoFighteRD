const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/domino-game`;

const headers = () => ({
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
});

export async function apiCall(body: Record<string, unknown>) {
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}
