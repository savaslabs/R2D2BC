/**
 * ResourceInterceptor
 *
 * A utility module that handles the interception and modification of resource URLs
 * in HTML documents. It adds query parameters from a manifest URL to all resource
 * URLs found in the document, including:
 * - Elements with src, href, and data attributes
 * - Images with srcset attributes
 * - Inline styles with background-image URLs
 * - URLs in style elements
 *
 * This module is used to ensure all resources loaded by an iframe maintain the
 * query parameters from the original manifest URL.
 */

/**
 * Adds query parameters from a manifest URL to all resource URLs in a document.
 *
 * This function processes the document and modifies all resource URLs to include
 * the query parameters from the manifest URL. It handles various types of URLs:
 * - Absolute URLs
 * - Relative URLs
 * - URLs in srcset attributes
 * - URLs in inline styles
 * - URLs in style elements
 *
 * Special URL schemes (data:, blob:, #, javascript:) are preserved without modification.
 *
 * @param doc - The HTML document to process. Must be a valid Document object.
 * @param manifestUrl - The manifest URL containing query parameters to add. Must be a valid URL object.
 * @returns void
 */
export const addQueryParamsToResources = (doc: Document, manifestUrl: URL) => {
  // Validate input parameters
  if (!doc || !manifestUrl) {
    return;
  }

  // Extract query parameters from manifest URL if available
  let queryString = "";
  if (manifestUrl) {
    try {
      const url = new URL(manifestUrl);
      queryString = url.search.startsWith("?")
        ? url.search.substring(1)
        : url.search;
    } catch (e) {
      console.error("Error parsing manifestUrl:", e);
    }
  }

  // Add query parameters to resource URLs directly if query string exists
  if (queryString) {
    // Helper to add params to a URL while preserving special URL schemes
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

      const separator = url.includes("?") ? "&" : "?";
      return url + separator + queryString;
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
