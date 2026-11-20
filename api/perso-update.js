// Vercel Serverless Function: Securely resolves latest release from private GitHub repo tolmas07/perso-app
// Returns short-lived signed GitHub S3 download URLs so PersoApp.exe never needs a GitHub token.
// Supports both legacy single-file PersoApp.exe (v2.1-v2.3) and full ZIP package PersoApp_Update.zip (v2.4+).

const REPO = process.env.PERSO_GITHUB_REPO || 'tolmas07/perso-app';
const APP_KEY = process.env.PERSO_UPDATE_KEY || 'uzmulk-perso-2026';

async function getSignedAssetUrl(assetId, ghHeaders) {
  const assetRes = await fetch(
    `https://api.github.com/repos/${REPO}/releases/assets/${assetId}`,
    {
      headers: {
        ...ghHeaders,
        Accept: 'application/octet-stream',
      },
      redirect: 'manual',
    }
  );
  return assetRes.headers.get('location') || '';
}

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
    'User-Agent': 'Uzmulk-PersoApp-Updater/2.0',
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
    const assets = release.assets || [];

    const exeAsset = assets.find((a) => a.name.toLowerCase() === 'persoapp.exe');
    const zipAsset = assets.find((a) => a.name.toLowerCase() === 'persoapp_update.zip');

    if (!version || (!exeAsset && !zipAsset)) {
      return res.status(404).json({ error: 'No update asset found in latest release' });
    }

    // 2. Parse optional SHA256 hashes from release body
    const bodyText = String(release.body || '');
    const exeShaMatch = bodyText.match(/(?:^|\n)SHA256:\s*([a-fA-F0-9]{64})/i);
    const zipShaMatch = bodyText.match(/(?:^|\n)ZIP_SHA256:\s*([a-fA-F0-9]{64})/i);
    const sha256 = exeShaMatch ? exeShaMatch[1].toLowerCase() : '';
    const packageSha256 = zipShaMatch ? zipShaMatch[1].toLowerCase() : '';

    // 3. Request temporary signed S3 URLs in parallel
    const [downloadUrl, packageUrl] = await Promise.all([
      exeAsset ? getSignedAssetUrl(exeAsset.id, ghHeaders) : Promise.resolve(''),
      zipAsset ? getSignedAssetUrl(zipAsset.id, ghHeaders) : Promise.resolve(''),
    ]);

    if (!downloadUrl && !packageUrl) {
      return res.status(502).json({ error: 'Failed to obtain signed download URL from GitHub' });
    }

    const cleanNotes = bodyText
      .replace(/(?:^|\n)ZIP_SHA256:\s*[a-fA-F0-9]{64}/gi, '')
      .replace(/(?:^|\n)SHA256:\s*[a-fA-F0-9]{64}/gi, '')
      .trim();

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      version,
      downloadUrl: downloadUrl || packageUrl,
      sha256,
      size: exeAsset ? exeAsset.size : (zipAsset ? zipAsset.size : 0),
      packageUrl: packageUrl || '',
      packageSha256,
      packageSize: zipAsset ? zipAsset.size : 0,
      packageType: packageUrl ? 'zip' : 'exe',
      notes: cleanNotes,
      publishedAt: release.published_at,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
