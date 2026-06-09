export default async function handler(req, res) {
  try {
    const response = await fetch(
      'https://boorsqnfkwglzvnhtwcx.supabase.co/rest/v1/admin_settings?select=id&limit=1',
      {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb3JzcW5ma3dnbHp2bmh0d2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NDE3NDEsImV4cCI6MjA3MjExNzc0MX0.eU0BSY8u1b-qcx3OTgvGIW-EQHotI4SwNuWAg0eqed0',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb3JzcW5ma3dnbHp2bmh0d2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NDE3NDEsImV4cCI6MjA3MjExNzc0MX0.eU0BSY8u1b-qcx3OTgvGIW-EQHotI4SwNuWAg0eqed0'
        }
      }
    );
    res.status(200).json({ ok: true, supabase: response.status, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
