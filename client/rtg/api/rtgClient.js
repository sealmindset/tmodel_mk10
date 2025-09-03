// XHR-only RTG API client
// Note: open CORS is already enabled server-side for /api/rtg

function xhrJson(method, url, body) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
        } catch (e) {
          resolve({});
        }
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Request timeout'));
    try {
      xhr.send(body ? JSON.stringify(body) : null);
    } catch (e) {
      reject(e);
    }
  });
}

const base = '/api/rtg';

// Fetch projects from core API (same-origin, session-auth)
export async function listProjects() {
  const res = await xhrJson('GET', '/api/projects');
  if (res && res.success && Array.isArray(res.data)) return res.data;
  // Some installs might return the array directly
  if (Array.isArray(res)) return res;
  return [];
}

export function listTemplates(q = '', limit = 20, offset = 0) {
  const url = `${base}/templates?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`;
  return xhrJson('GET', url);
}

export function createTemplate({ name, description, content_md }) {
  return xhrJson('POST', `${base}/templates`, { name, description, content_md });
}

export function getTemplate(id) {
  return xhrJson('GET', `${base}/templates/${encodeURIComponent(id)}`);
}

export function updateTemplate(id, { name, description, content_md }, changelog) {
  const payload = { };
  if (name !== undefined) payload.name = name;
  if (description !== undefined) payload.description = description;
  if (content_md !== undefined) payload.content_md = content_md;
  if (changelog) payload.changelog = changelog;
  return xhrJson('PUT', `${base}/templates/${encodeURIComponent(id)}`, payload);
}

export function deleteTemplate(id) {
  return xhrJson('DELETE', `${base}/templates/${encodeURIComponent(id)}`);
}

export function listVersions(id, limit = 20, offset = 0) {
  const url = `${base}/templates/${encodeURIComponent(id)}/versions?limit=${limit}&offset=${offset}`;
  return xhrJson('GET', url);
}

export function getVersion(id, version) {
  return xhrJson('GET', `${base}/templates/${encodeURIComponent(id)}/versions/${version}`);
}

export function compile({ content, filters }) {
  return xhrJson('POST', `${base}/compile`, { content, filters });
}

export function submit({ content, filters, provider, model, templateId, templateVersion }) {
  return xhrJson('POST', `${base}/submit`, { content, filters, provider, model, templateId, templateVersion });
}
