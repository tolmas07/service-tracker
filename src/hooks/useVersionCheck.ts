import { useState, useEffect, useCallback } from 'react';
import { APP_VERSION } from '../lib/constants';

interface VersionInfo {
  version: string;
  minVersion: string;
  apkUrl: string;
  changelog: string;
  forceUpdate: boolean;
}

interface VersionCheckResult {
  needsUpdate: boolean;
  forceUpdate: boolean;
  latestVersion: string;
  apkUrl: string;
  changelog: string;
  checking: boolean;
  dismissed: boolean;
  dismiss: () => void;
}

function isNewerVersion(current: string, latest: string): boolean {
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export function useVersionCheck(): VersionCheckResult {
  const [result, setResult] = useState<VersionCheckResult>({
    needsUpdate: false,
    forceUpdate: false,
    latestVersion: APP_VERSION,
    apkUrl: '',
    changelog: '',
    checking: true,
    dismissed: false,
    dismiss: () => setResult(prev => ({ ...prev, dismissed: true })),
  });

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) return;
      const info: VersionInfo = await res.json();

      const needsUpdate = isNewerVersion(APP_VERSION, info.version);
      const force = info.forceUpdate || isNewerVersion(APP_VERSION, info.minVersion);

      setResult(prev => ({
        ...prev,
        needsUpdate,
        forceUpdate: force,
        latestVersion: info.version,
        apkUrl: info.apkUrl,
        changelog: info.changelog,
        checking: false,
      }));
    } catch {
      setResult(prev => ({ ...prev, checking: false }));
    }
  }, []);

  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  return result;
}
