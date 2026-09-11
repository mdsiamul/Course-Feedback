// Developer: Md Siamul Islam
// Student ID: 230032201
// Department: TVE

const OPENED_URLS = new Set();
const TAB_PROCESSING = new Set();

async function collectEvaluateUrls(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const absolute = (url) => {
          try {
            return new URL(url, window.location.href).href;
          } catch {
            return null;
          }
        };

        const extractUrl = (el) => {
          if (!el) return null;

          if (el.tagName === "A" && el.href) return absolute(el.href);
          if (el.getAttribute("href")) return absolute(el.getAttribute("href"));
          if (el.getAttribute("data-href")) return absolute(el.getAttribute("data-href"));
          if (el.getAttribute("formaction")) return absolute(el.getAttribute("formaction"));

          const onclick = el.getAttribute("onclick") || "";
          const openMatch = onclick.match(/window\.open\((['\"])(.*?)\1/);
          if (openMatch && openMatch[2]) return absolute(openMatch[2]);

          const hrefMatch = onclick.match(/location(?:\.href)?\s*=\s*(['\"])(.*?)\1/);
          if (hrefMatch && hrefMatch[2]) return absolute(hrefMatch[2]);

          const anchor = el.closest("a[href]");
          if (anchor && anchor.href) return absolute(anchor.href);

          return null;
        };

        const allElements = Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit'], [role='button']"));
        const evaluateElements = allElements.filter((el) => (el.innerText || el.value || "").trim() === "Evaluate");

        const urls = evaluateElements
          .map(extractUrl)
          .filter((url) => typeof url === "string" && url.length > 0);

        return Array.from(new Set(urls));
      }
    });

    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("[AutoCourse] Failed to collect Evaluate links:", error);
    return [];
  }
}

async function openEvaluateTabsFromDashboard(tabId) {
  if (!tabId) {
    return { found: 0, opened: 0 };
  }

  const urls = await collectEvaluateUrls(tabId);
  const found = urls.length;

  if (found === 0) {
    console.log("[AutoCourse] No Evaluate links found on this page.");
    return { found: 0, opened: 0 };
  }

  console.log("[AutoCourse] Found " + found + " evaluation link(s). Opening tabs...");

  let opened = 0;
  for (const url of urls) {
    if (OPENED_URLS.has(url)) {
      console.log("[AutoCourse] Skipping already-opened URL:", url);
      continue;
    }

    OPENED_URLS.add(url);
    const createdTab = await chrome.tabs.create({ url, active: false });
    console.log("[AutoCourse] Opened evaluation tab:", createdTab.id, url);
    opened += 1;
  }

  return { found, opened };
}

async function injectFormFiller(tabId) {
  if (!tabId) {
    return false;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    return true;
  } catch (error) {
    console.debug("[AutoCourse] Injection skipped for tab:", tabId, error?.message || error);
    return false;
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) {
    console.warn("[AutoCourse] No active tab found.");
    return;
  }

  console.log("[AutoCourse] Action clicked. Scanning dashboard tab:", tab.id);

  try {
    await openEvaluateTabsFromDashboard(tab.id);
  } catch (error) {
    console.error("[AutoCourse] Failed to scan dashboard:", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "OPEN_FEEDBACK") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs && tabs[0];
      const tabId = activeTab ? activeTab.id : null;

      const result = await openEvaluateTabsFromDashboard(tabId);
      sendResponse({ ok: true, found: result.found, opened: result.opened });
    });
    return true;
  }

  if (message.type === "SUBMIT_FILL") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs && tabs[0];
      const tabId = activeTab ? activeTab.id : null;

      const ok = await injectFormFiller(tabId);
      sendResponse({ ok });
    });
    return true;
  }

  return false;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab || !tab.url) return;
  if (!/^https?:/i.test(tab.url)) return;
  if (TAB_PROCESSING.has(tabId)) return;

  TAB_PROCESSING.add(tabId);

  try {
    // Delay slightly to handle late-rendered SPA content.
    await new Promise((resolve) => setTimeout(resolve, 700));

    await injectFormFiller(tabId);

    console.log("[AutoCourse] Injected content script into tab:", tabId);
  } finally {
    TAB_PROCESSING.delete(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  TAB_PROCESSING.delete(tabId);
});
