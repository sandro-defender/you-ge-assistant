/** Copy helper with an explicit fallback for browsers without async clipboard. */
export async function copyText(text, options = {}) {
  const nav = options.navigator || (typeof navigator === 'undefined' ? null : navigator);
  const doc = options.document || (typeof document === 'undefined' ? null : document);
  try {
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      await nav.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    // Permission denials and insecure contexts fall through to the legacy path.
  }
  try {
    if (!doc || !doc.body || typeof doc.createElement !== 'function') return 'failed';
    const field = doc.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    doc.body.appendChild(field);
    field.select();
    const copied = typeof doc.execCommand === 'function' ? doc.execCommand('copy') : false;
    field.remove();
    return copied ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}
