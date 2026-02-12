/**
 * Email Tracking Utilities
 *
 * Functions for open tracking (pixel) and click tracking (link wrapping)
 */

/**
 * Generate a tracking ID from email ID
 * Uses base64url encoding for URL safety
 */
export function generateTrackingId(emailId: string): string {
  return Buffer.from(emailId).toString('base64url');
}

/**
 * Decode tracking ID back to email ID
 */
export function decodeTrackingId(trackingId: string): string {
  return Buffer.from(trackingId, 'base64url').toString('utf8');
}

/**
 * Inject tracking pixel before </body> tag
 *
 * @param html - The HTML email body
 * @param trackingId - The tracking ID for this email
 * @param baseUrl - The API base URL (e.g., https://api.example.com)
 * @returns Modified HTML with tracking pixel
 */
export function injectTrackingPixel(html: string, trackingId: string, baseUrl: string): string {
  const pixelUrl = `${baseUrl}/api/v1/t/o/${trackingId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" alt="" />`;

  // Try to insert before </body>
  if (html.toLowerCase().includes('</body>')) {
    return html.replace(/<\/body>/i, `${pixel}</body>`);
  }

  // If no </body>, try before </html>
  if (html.toLowerCase().includes('</html>')) {
    return html.replace(/<\/html>/i, `${pixel}</html>`);
  }

  // Fallback: append to the end
  return html + pixel;
}

/**
 * Wrap all links in HTML with tracking URLs
 *
 * @param html - The HTML email body
 * @param trackingId - The tracking ID for this email
 * @param baseUrl - The API base URL (e.g., https://api.example.com)
 * @returns Modified HTML with wrapped links
 */
export function wrapLinksForTracking(html: string, trackingId: string, baseUrl: string): string {
  // Match href attributes with various quote styles
  const linkRegex = /href\s*=\s*["']([^"']+)["']/gi;

  return html.replace(linkRegex, (match, url: string) => {
    // Skip non-http links
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return match;
    }

    // Skip mailto, tel, and anchor links
    if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#')) {
      return match;
    }

    // Skip if already wrapped (contains /t/c/)
    if (url.includes('/t/c/')) {
      return match;
    }

    // Skip unsubscribe links (don't track these)
    if (url.toLowerCase().includes('unsubscribe')) {
      return match;
    }

    // Wrap the link
    const encodedUrl = encodeURIComponent(url);
    const trackingUrl = `${baseUrl}/api/v1/t/c/${trackingId}?url=${encodedUrl}`;

    return `href="${trackingUrl}"`;
  });
}

/**
 * Apply both tracking pixel and link wrapping
 *
 * @param html - The HTML email body
 * @param trackingId - The tracking ID for this email
 * @param baseUrl - The API base URL
 * @param options - What tracking to apply
 * @returns Modified HTML with tracking
 */
export function applyEmailTracking(
  html: string,
  trackingId: string,
  baseUrl: string,
  options: {
    trackOpens?: boolean;
    trackClicks?: boolean;
  } = {}
): string {
  const { trackOpens = true, trackClicks = true } = options;

  let result = html;

  if (trackClicks) {
    result = wrapLinksForTracking(result, trackingId, baseUrl);
  }

  if (trackOpens) {
    result = injectTrackingPixel(result, trackingId, baseUrl);
  }

  return result;
}

/**
 * 1x1 transparent GIF as a Buffer
 * Used for the tracking pixel response
 */
export const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * Validate a URL to prevent open redirect vulnerabilities
 */
export function isValidTrackingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
