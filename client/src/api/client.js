const BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api`;

export const getToken = () => localStorage.getItem('apacope_token');
export const setToken = (t) => (t ? localStorage.setItem('apacope_token', t) : localStorage.removeItem('apacope_token'));

async function request(method, url, body, isForm = false) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + url, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && !url.startsWith('/auth/login')) {
      setToken(null);
      window.location.href = '/login';
    }
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b) => request('POST', u, b),
  put: (u, b) => request('PUT', u, b),
  del: (u) => request('DELETE', u),
  upload: (u, formData) => request('POST', u, formData, true),
};

/** Build a query string, skipping empty values */
export const qs = (obj = {}) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** Authenticated file download (PDF, Excel, resources) */
export async function download(url, fallbackName = 'file', { open = false } = {}) {
  const res = await fetch(BASE + url, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.message || 'Download failed');
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  if (open) { window.open(objectUrl, '_blank'); return; }
  const cd = res.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename="([^"]+)"/);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = m ? decodeURIComponent(m[1]) : fallbackName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

/** Fetch a protected file as an object URL (for image/PDF preview) */
export async function blobUrl(url) {
  const res = await fetch(BASE + url, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error('Preview failed');
  return URL.createObjectURL(await res.blob());
}
