// js-capture_database.js
async function insertCapture(record) {
  const resp = await fetch('capture_database.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record)
  });

  const text = await resp.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}

  if (!resp.ok) {
    throw new Error(data?.message || text || 'Failed to insert capture record');
  }
  return data;
}

async function fetchCaptures(opts = {}) {
  const params = new URLSearchParams(opts).toString();
  const resp = await fetch('capture_database.php' + (params ? ('?' + params) : ''));
  const text = await resp.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}

  if (!resp.ok) {
    throw new Error(data?.message || text || 'Failed to fetch capture records');
  }
  if (!data || !Array.isArray(data.records)) throw new Error('Invalid response from server');
  return data.records;
}
