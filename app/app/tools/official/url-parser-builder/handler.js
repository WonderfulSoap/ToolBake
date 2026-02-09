/**
 * Some tips:
 * - Hover mouse on 'InputUIWidgets' and 'ChangedUIWidget' in the jsdoc to see the generated types
 * - Use 'inputWidgets["widgetId"]' or 'inputWidgets.widgetId' to access the value of a specific input widget value
 * - Use 'changedWidgetIds' to know which input widget triggered the execution
 * - Checks the 'uiWidgets' tab to check and modify the input/output UI widgets of this tool
 * - The 'handler.d.ts' tab shows the full auto generated type definitions for the handler function
 * 
 * !! The jsdoc comment below describes the handler function signature, and provides type information for the editor. Don't remove it.
 *
 * @param {InputUIWidgets} inputWidgets When tool is executed, this object contains all the input widget values.
 * @param {ChangedUIWidget} changedWidgetIds When tool is executed, this string value tells you which input widget triggered the execution.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const { url_input, decode_params, protocol, username, password, hostname, port, pathname, hash, search } = inputWidgets;
  const shouldDecode = decode_params === true;

  // On initial load (changedWidgetIds is undefined), parse the URL input
  if (changedWidgetIds === undefined || changedWidgetIds === "url_input") {
    return parseUrl(url_input, shouldDecode);
  }

  // If any other component changed, rebuild the URL
  return rebuildUrl(inputWidgets, shouldDecode);
}

function parseUrl(urlStr, shouldDecode) {
  const trimmedUrl = (urlStr || "").trim();

  if (!trimmedUrl) {
    return {
      protocol    : "",
      username    : "",
      password    : "",
      hostname    : "",
      port        : "",
      pathname    : "",
      search      : "",
      hash        : "",
      query_params: ""
    };
  }

  try {
    const url = new URL(trimmedUrl);

    // Parse query parameters
    const params = [];
    if (shouldDecode) {
      url.searchParams.forEach((value, key) => {
        const decodedKey = decodeURIComponent(key);
        const decodedValue = decodeURIComponent(value);
        params.push(`${decodedKey}: ${decodedValue}`);
      });
    } else {
      const searchStr = url.search;
      if (searchStr) {
        const queryString = searchStr.substring(1);
        const pairs = queryString.split("&");
        pairs.forEach(pair => {
          params.push(pair);
        });
      }
    }
    const queryParamsStr = params.length > 0 ? params.join("\n") : "(no parameters)";

    // Decode search string if needed
    let searchStr = url.search || "(empty)";
    if (shouldDecode && searchStr !== "(empty)") {
      searchStr = decodeURIComponent(searchStr);
    }

    const queryTableHtml = generateQueryTable(url, shouldDecode);

    return {
      protocol          : url.protocol.replace(":", ""),
      username          : url.username || "(empty)",
      password          : url.password || "(empty)",
      hostname          : url.hostname || "(empty)",
      port              : url.port || "(empty)",
      pathname          : url.pathname || "/",
      search            : searchStr,
      hash              : url.hash ? url.hash.substring(1) : "(empty)",
      query_params      : queryParamsStr,
      query_params_table: queryTableHtml
    };
  } catch (error) {
    return {
      protocol    : "ERROR",
      username    : "Invalid URL",
      password    : "",
      hostname    : error.message,
      port        : "",
      pathname    : "",
      search      : "",
      hash        : "",
      query_params: ""
    };
  }
}

function rebuildUrl(inputWidgets, shouldDecode) {
  const { url_input, protocol, username, password, hostname, port, pathname, hash, search } = inputWidgets;

  try {
    // Build URL from components
    const proto = (protocol || "").trim() || "https";
    const host = (hostname || "").trim();

    if (!host) {
      return { url_input: "ERROR: hostname is required" };
    }

    let urlStr = `${proto}://`;

    // Add credentials if provided
    const user = (username || "").trim();
    const pass = (password || "").trim();
    if (user && user !== "(empty)") {
      urlStr += user;
      if (pass && pass !== "(empty)") {
        urlStr += `:${pass}`;
      }
      urlStr += "@";
    }

    // Add hostname and port
    urlStr += host;
    const p = (port || "").trim();
    if (p && p !== "(empty)") {
      urlStr += `:${p}`;
    }

    // Add pathname
    const path = (pathname || "").trim();
    if (path && path !== "/") {
      urlStr += path;
    } else {
      urlStr += "/";
    }

    // Add search
    const searchVal = (search || "").trim();
    if (searchVal && searchVal !== "(empty)") {
      if (shouldDecode) {
        // If decode is enabled, the search value is decoded, so we need to encode it
        urlStr += encodeURI(searchVal);
      } else {
        // If decode is disabled, the search value is already in encoded format
        urlStr += searchVal;
      }
    }

    // Add hash
    const hashVal = (hash || "").trim();
    if (hashVal && hashVal !== "(empty)") {
      urlStr += `#${hashVal}`;
    }

    // Parse the rebuilt URL to get query params
    const url = new URL(urlStr);
    const params = [];
    if (shouldDecode) {
      url.searchParams.forEach((value, key) => {
        const decodedKey = decodeURIComponent(key);
        const decodedValue = decodeURIComponent(value);
        params.push(`${decodedKey}: ${decodedValue}`);
      });
    } else {
      const searchStr = url.search;
      if (searchStr) {
        const queryString = searchStr.substring(1);
        const pairs = queryString.split("&");
        pairs.forEach(pair => {
          params.push(pair);
        });
      }
    }
    const queryParamsStr = params.length > 0 ? params.join("\n") : "(no parameters)";
    const queryTableHtml = generateQueryTable(url, shouldDecode);

    return {
      url_input         : urlStr,
      query_params      : queryParamsStr,
      query_params_table: queryTableHtml
    };
  } catch (error) {
    return {
      url_input: `ERROR: ${error.message}`
    };
  }
}

function generateQueryTable(url, shouldDecode) {
  const params = [];
  url.searchParams.forEach((value, key) => {
    const displayKey = shouldDecode ? decodeURIComponent(key) : key;
    const displayValue = shouldDecode ? decodeURIComponent(value) : value;
    params.push({ key: displayKey, value: displayValue });
  });

  if (params.length === 0) {
    return "<div class='text-sm text-muted-foreground py-4 text-center'>No query parameters</div>";
  }

  let html = "<table class='w-full border-collapse text-sm'><thead><tr class='border-b border-border'><th class='text-left py-2 px-2 font-semibold text-foreground'>Key</th><th class='text-left py-2 px-2 font-semibold text-foreground'>Value</th></tr></thead><tbody>";

  params.forEach((param, index) => {
    const bgClass = index % 2 === 0 ? "bg-muted/30" : "";
    const escapedKey = escapeHtml(param.key);
    const escapedValue = escapeHtml(param.value);
    html += `<tr class='border-b border-border/50 ${bgClass}'><td class='py-2 px-2 text-foreground'>${escapedKey}</td><td class='py-2 px-2 text-foreground break-words'>${escapedValue}</td></tr>`;
  });

  html += "</tbody></table>";
  return html;
}

function escapeHtml(text) {
  const map = {
    "&" : "&amp;",
    "<" : "&lt;",
    ">" : "&gt;",
    "\"": "&quot;",
    "'" : "&#039;"
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

