// Vercel Serverless Function: Securely resolves latest release from private GitHub repo tolmas07/perso-app
// Returns a short-lived signed GitHub S3 download URL so PersoApp.exe never needs a GitHub token.

const REPO = process.env.PERSO_GITHUB_REPO || 'tolmas07/perso-app';
const APP_KEY = process.env.PERSO_UPDATE_KEY || 'uzmulk-perso-2026';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const providedKey = req.headers['x-perso-key'] || req.query?.key;
  if (providedKey !== APP_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ghToken = process.env.PERSO_GITHUB_TOKEN;
  if (!ghToken) {
    return res.status(503).json({
      error: 'PERSO_GITHUB_TOKEN is not configured in Vercel Environment Variables'
    });
  }

  const ghHeaders = {
    Authorization: `Bearer ${ghToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Uzmulk-PersoApp-Updater/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    // 1. Fetch latest release metadata from private repo
    const releaseRes = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: ghHeaders,
    });

    if (releaseRes.status === 404) {
      return res.status(404).json({ error: 'No releases found' });
    }
    if (!releaseRes.ok) {
      const txt = await releaseRes.text();
      return res.status(releaseRes.status).json({ error: 'GitHub API error', details: txt });
    }

    const release = await releaseRes.json();
    const version = String(release.tag_name || '').replace(/^v/i, '').trim();
    const exeAsset = (release.assets || []).find(
      (a) => a.name.toLowerCase() === 'persoapp.exe'
    );

    if (!version || !exeAsset) {
      return res.status(404).json({ error: 'PersoApp.exe asset not found in latest release' });
    }

    // 2. Parse optional SHA256 from release body (format: "SHA256: <64-hex>")
    const bodyText = String(release.body || '');
    const shaMatch = bodyText.match(/SHA256:\s*([a-fA-F0-9]{64})/);
    const sha256 = shaMatch ? shaMatch[1].toLowerCase() : '';

    // 3. Request temporary signed S3 URL for the private release asset (no redirect follow)
    const assetRes = await fetch(
      `https://api.github.com/repos/${REPO}/releases/assets/${exeAsset.id}`,
      {
        headers: {
          ...ghHeaders,
          Accept: 'application/octet-stream',
        },
        redirect: 'manual',
      }
    );

    const downloadUrl = assetRes.headers.get('location');
    if (!downloadUrl) {
      return res.status(502).json({
        error: 'Failed to obtain signed download URL from GitHub',
        status: assetRes.status,
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      version,
      downloadUrl,
      sha256,
      size: exeAsset.size,
      notes: bodyText.replace(/SHA256:\s*[a-fA-F0-9]{64}/gi, '').trim(),
      publishedAt: release.published_at,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
