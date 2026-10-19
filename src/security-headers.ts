import { dashboardInlineScript } from './dashboard';
import { productsInlineScript } from './products-page';
import { sentInlineScript } from './sent-dms';
import { settingsInlineScript } from './settings-page';

let policy: Promise<string> | undefined;

async function htmlPolicy(): Promise<string> {
  // Hash only our static script sources, never scripts extracted from a response
  // that could contain merchant input. Include the English date-locale variants.
  const sources = [dashboardInlineScript('overview'), dashboardInlineScript('automations'), productsInlineScript(), sentInlineScript, settingsInlineScript()];
  const variants = new Set(sources.flatMap(source => [source, source.replaceAll('"ar-LY"', '"en-GB"').replaceAll("'ar-LY'", "'en-GB'")]));
  const hashes = await Promise.all([...variants].map(async source => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    return `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
  }));
  return [
    "default-src 'self'", `script-src 'self' ${hashes.join(' ')}`, "script-src-attr 'none'",
    // Existing templates and transition geometry use inline styles, never inline handlers.
    "style-src 'self' 'unsafe-inline'", "font-src 'self'", "img-src 'self' data: blob: https:",
    "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'self'",
    "frame-src 'none'", "frame-ancestors 'none'"
  ].join('; ');
}

export async function secureHtmlResponse(response: Response): Promise<Response> {
  if (!response.headers.get('content-type')?.includes('text/html')) return response;
  const headers = new Headers(response.headers);
  headers.set('content-security-policy', await (policy ??= htmlPolicy()));
  headers.set('x-frame-options', 'DENY');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(response.body, {status:response.status, statusText:response.statusText, headers});
}
