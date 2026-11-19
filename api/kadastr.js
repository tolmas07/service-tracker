// Vercel Serverless Proxy for Kadastr Print Control API (http://195.158.3.130:22666)
// Bridges HTTPS (uzmulk tracker) -> HTTP (Kadastr server) without Mixed Content errors.

const TARGET_ORIGIN = 'http://195.158.3.130:22666';

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, hl');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { endpoint, ...restQuery } = req.query || {};
  const targetPath = Array.isArray(endpoint) ? endpoint[0] : endpoint;

  if (!targetPath || typeof targetPath !== 'string' || !targetPath.startsWith('/api/v2/')) {
    return res.status(400).json({ message: 'Invalid endpoint. Only /api/v2/* paths are allowed.' });
  }

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(restQuery)) {
    if (Array.isArray(v)) {
      v.forEach((item) => params.append(k, String(item)));
    } else if (v !== undefined) {
      params.append(k, String(v));
    }
  }
  const qs = params.toString();
  const targetUrl = `${TARGET_ORIGIN}${targetPath}${qs ? `?${qs}` : ''}`;

  const headers = {};
  if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  if (req.headers['hl']) headers['hl'] = req.headers['hl'];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const fetchOptions = {
      method: req.method,
      headers,
      signal: controller.signal,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeout);

    const contentType = upstream.headers.get('content-type') || 'application/json';
    const text = await upstream.text();

    res.setHeader('Content-Type', contentType);
    return res.status(upstream.status).send(text);
  } catch (err) {
    clearTimeout(timeout);
    const isAbort = err && err.name === 'AbortError';
    return res.status(504).json({
      error: 'UPSTREAM_UNREACHABLE',
      message: isAbort
        ? 'Сервер кадастра (195.158.3.130:22666) не ответил за 9 сек — возможно, закрыт доступ для зарубежных IP (Vercel).'
        : `Не удалось подключиться к серверу кадастра: ${err?.message || 'Network error'}`,
    });
  }
}
