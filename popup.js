const statusEl = document.getElementById("status");
const feedbackBtn = document.getElementById("feedbackBtn");
const versionTextEl = document.getElementById("versionText");

if (versionTextEl) {
  const version = chrome.runtime.getManifest().version;
  versionTextEl.textContent = "Version " + version;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function send(type) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false });
    });
  });
}

feedbackBtn.addEventListener("click", async () => {
  feedbackBtn.disabled = true;
  setStatus("Opening feedback tabs and starting auto-submit...");

  const openResult = await send("OPEN_FEEDBACK");
  if (!openResult.ok) {
    setStatus("Unable to open feedback tabs.");
    feedbackBtn.disabled = false;
    return;
  }

  setStatus("Opened " + openResult.opened + " tab(s). Auto-submitting current tab...");

  const fillResult = await send("SUBMIT_FILL");
  if (!fillResult.ok) {
    setStatus("Opened " + openResult.opened + " tab(s). Could not auto-submit this tab.");
    feedbackBtn.disabled = false;
    return;
  }

  setStatus("Done. Found " + openResult.found + ", opened " + openResult.opened + " tab(s), and auto-submitted available forms.");
  feedbackBtn.disabled = false;
});
