const pathNames = ['mismatch', 'noConsent', 'complete'];

export function previewReturnPaths(href) {
  const current = new URL(href);
  const fragment = new URLSearchParams(current.hash.slice(1));
  const previewId = current.searchParams.get('PROLIFIC_PID');
  if (current.searchParams.get('route') !== 'prolific' ||
      !/^[a-f0-9]{24}$/i.test(previewId || '') ||
      previewId !== fragment.get('preview_pid')) return {};

  const paths = {};
  for (const name of pathNames) {
    const raw = fragment.get(`return_${name}`);
    if (!raw) continue;
    let target;
    try { target = new URL(raw); } catch { continue; }
    if (target.origin !== 'https://app.prolific.com' ||
        target.pathname !== '/submissions/complete' ||
        target.hash || target.searchParams.size !== 1 ||
        !/^[A-Z0-9]{8}$/.test(target.searchParams.get('cc') || '')) continue;
    paths[name] = target.href;
  }
  return paths;
}
