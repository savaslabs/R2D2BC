/**
 * Utility for adding query parameters to resource URLs in iframes
 */

/**
 * Creates a script element that adds query parameters to resource URLs
 */
export function createResourceInterceptorScript(
  manifestUrl: string | URL
): HTMLScriptElement {
  const scriptElement = document.createElement("script");
  scriptElement.type = "text/javascript";
  scriptElement.textContent = generateResourceInterceptorCode(manifestUrl);
  return scriptElement;
}

/**
 * Generates code to add query parameters to resource URLs
 */
export function generateResourceInterceptorCode(
  manifestUrl: string | URL
): string {
  // Extract query string from the manifest URL
  let queryString = "";
  try {
    if (manifestUrl) {
      const url =
        typeof manifestUrl === "string" ? new URL(manifestUrl) : manifestUrl;
      queryString = url.search.startsWith("?")
        ? url.search.substring(1)
        : url.search;
    }
  } catch (e) {
    console.error("Error parsing manifestUrl:", e);
  }

  return `
    // Only process if we have query parameters
    const queryParams = ${JSON.stringify(queryString)};
    if (!queryParams) {
      // Using void(0) instead of return which is illegal at global scope
      void(0);
    } else {
      // Add parameters to a URL
      function addParams(url) {
        if (!url || typeof url !== 'string' || url.startsWith('data:') || 
            url.startsWith('blob:') || url.startsWith('#') || 
            url.startsWith('javascript:')) return url;
        
        const separator = url.includes('?') ? '&' : '?';
        return url + separator + queryParams;
      }

      // Update an element's attribute if needed
      function updateAttribute(element, attr) {
        if (!element.hasAttribute(attr)) return;
        
        const value = element.getAttribute(attr);
        if (!value) return;
        
        // Special handling for srcset
        if (attr === 'srcset') {
          const newValue = value.split(',')
            .map(set => {
              const [url, ...rest] = set.trim().split(/\\s+/);
              return addParams(url) + (rest.length ? ' ' + rest.join(' ') : '');
            })
            .join(', ');
          if (newValue !== value) element.setAttribute(attr, newValue);
          return;
        }
        
        // Regular attribute handling
        const newValue = addParams(value);
        if (newValue !== value) element.setAttribute(attr, newValue);
      }
      
      // Process all resources in the document
      function processResources() {
        // Process all elements with resource attributes
        ['src', 'href', 'data'].forEach(attr => {
          document.querySelectorAll('[' + attr + ']').forEach(el => {
            // Special handling for scripts to ensure they reload
            if (attr === 'src' && el.tagName === 'SCRIPT') {
              const src = el.getAttribute('src');
              const newSrc = addParams(src);
              if (newSrc !== src) {
                const newScript = document.createElement('script');
                Array.from(el.attributes).forEach(a => {
                  newScript.setAttribute(a.name === 'src' ? a.name : a.name, 
                                        a.name === 'src' ? newSrc : a.value);
                });
                el.parentNode?.replaceChild(newScript, el);
              }
            } else {
              updateAttribute(el, attr);
            }
          });
        });
        
        // Handle srcset attribute
        document.querySelectorAll('[srcset]').forEach(el => {
          updateAttribute(el, 'srcset');
        });

        // Handle inline styles with background images
        document.querySelectorAll('[style*="url("]').forEach(el => {
          const style = el.getAttribute('style');
          if (!style) return;
          
          const newStyle = style.replace(/url\\(['"]?([^'"\\)]+)['"]?\\)/g, 
                                      (_, url) => 'url("' + addParams(url) + '")');
          if (newStyle !== style) el.setAttribute('style', newStyle);
        });
      }

      // Run when DOM is loaded
      if (document.readyState !== 'loading') {
        processResources();
      } else {
        document.addEventListener('DOMContentLoaded', processResources);
      }
    }
  `;
}
