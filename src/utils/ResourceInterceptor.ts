/**
 * ResourceInterceptor
 *
 * A utility module that handles the interception and modification of resource URLs
 * in HTML documents. It adds CloudFront signed URL parameters from a manifest URL
 * to all resource URLs found in the document, including:
 * - Elements with src, href, and data attributes
 * - Images with srcset attributes
 * - Inline styles with background-image URLs
 * - URLs in style elements
 *
 * This module is used to ensure all resources loaded by an iframe maintain the
 * CloudFront signed URL parameters from the original manifest URL.
 */

/**
 * Adds CloudFront signed URL parameters from a manifest URL to all resource URLs in a document.
 *
 * This function processes the document and modifies all resource URLs to include
 * the CloudFront signed URL parameters from the manifest URL. It handles various types of URLs:
 * - Absolute URLs
 * - Relative URLs
 * - URLs in srcset attributes
 * - URLs in inline styles
 * - URLs in style elements
 *
 * Special URL schemes (data:, blob:, #, javascript:) are preserved without modification.
 * Existing query parameters that don't conflict with CloudFront parameters are preserved.
 * Relative URLs remain relative after parameter addition.
 *
 * @param doc - The HTML document to process. Must be a valid Document object.
 * @param manifestUrl - The manifest URL containing CloudFront signed URL parameters. Must be a valid URL object.
 * @returns void
 */
export const addQueryParamsToResources = (doc: Document, manifestUrl: URL) => {
  // Validate input parameters
  if (!doc || !manifestUrl) {
    return;
  }

  // Extract CloudFront signed URL parameters from manifest URL if available
  let cloudfrontParams = new URLSearchParams();
  if (manifestUrl) {
    try {
      const url = new URL(manifestUrl);
      const allParams = new URLSearchParams(url.search);

      // Only keep CloudFront signed URL parameters
      const cloudfrontParamKeys = [
        "Expires",
        "Policy",
        "Signature",
        "Key-Pair-Id",
      ];
      cloudfrontParamKeys.forEach((key) => {
        const value = allParams.get(key);
        if (value) {
          cloudfrontParams.set(key, value);
        }
      });
    } catch (e) {
      console.error("Error parsing manifestUrl:", e);
    }
  }

  // Add CloudFront parameters to resource URLs directly if they exist
  if (cloudfrontParams.toString()) {
    // Helper to add params to a URL while preserving special URL schemes and non-conflicting params
    const addParams = (url: string): string => {
      if (
        !url ||
        url.startsWith("data:") ||
        url.startsWith("blob:") ||
        url.startsWith("#") ||
        // eslint-disable-next-line no-script-url
        url.startsWith("javascript:")
      ) {
        return url;
      }

      try {
        // Check if URL is relative
        const isRelative =
          !url.startsWith("http://") && !url.startsWith("https://");

        // For relative URLs, we need to handle the path and query separately
        if (isRelative) {
          const [path, existingQuery] = url.split("?");
          const existingParams = new URLSearchParams(existingQuery || "");

          // Add CloudFront params, preserving non-conflicting existing params
          cloudfrontParams.forEach((value, key) => {
            existingParams.set(key, value);
          });

          // Reconstruct URL with combined params
          const queryString = existingParams.toString();
          return queryString ? `${path}?${queryString}` : path;
        }

        // For absolute URLs, use URL object for proper parsing
        const resourceUrl = new URL(url);
        const existingParams = new URLSearchParams(resourceUrl.search);

        // Add CloudFront params, preserving non-conflicting existing params
        cloudfrontParams.forEach((value, key) => {
          existingParams.set(key, value);
        });

        // Reconstruct URL with combined params
        resourceUrl.search = existingParams.toString();
        return resourceUrl.toString();
      } catch (e) {
        console.warn(`Invalid URL "${url}":`, e);
        return url;
      }
    };

    // Process elements with resource attributes (src, href, data)
    ["src", "href", "data"].forEach((attr) => {
      doc.querySelectorAll(`[${attr}]`).forEach((el) => {
        const value = el.getAttribute(attr);
        if (value) {
          el.setAttribute(attr, addParams(value));
        }
      });
    });

    // Process srcset attributes for responsive images
    doc.querySelectorAll("[srcset]").forEach((el) => {
      const srcset = el.getAttribute("srcset");
      if (srcset) {
        const newValue = srcset
          .split(",")
          .map((set) => {
            const parts = set.trim().split(/\s+/);
            if (parts.length > 0) {
              parts[0] = addParams(parts[0]);
            }
            return parts.join(" ");
          })
          .join(", ");
        el.setAttribute("srcset", newValue);
      }
    });

    // Process inline styles containing background-image URLs
    doc.querySelectorAll("[style*='url(']").forEach((el) => {
      const style = el.getAttribute("style");
      if (style) {
        const newStyle = style.replace(
          /url\(['"]?([^'"\)]+)['"]?\)/g,
          (match, url) => `url("${addParams(url)}")`
        );
        el.setAttribute("style", newStyle);
      }
    });

    // Process URLs in style elements
    doc.querySelectorAll("style").forEach((styleEl) => {
      if (styleEl.textContent) {
        styleEl.textContent = styleEl.textContent.replace(
          /url\(['"]?([^'"\)]+)['"]?\)/g,
          (match, url) => `url("${addParams(url)}")`
        );
      }
    });
  }
};
