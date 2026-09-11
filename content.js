// Developer: Md Siamul Islam
// Student ID: 230032201
// Department: TVE

(() => {
  if (window.__autoCourseFeedbackBootstrapped) {
    console.debug("[AutoCourse] Content script already bootstrapped.");
    return;
  }
  window.__autoCourseFeedbackBootstrapped = true;

  const LOG_PREFIX = "[AutoCourse]";
  let hasFilledOnce = false;
  let hasSubmittedOnce = false;

  const trigger = (element, eventName) => {
    element.dispatchEvent(new Event(eventName, { bubbles: true }));
  };

  const clickWithMouseEvents = (element) => {
    if (!element) return;
    try {
      element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      element.click();
    } catch {
      element.click();
    }
  };

  const findRadioClickTarget = (radio) => {
    if (!radio) return null;

    if (radio.id) {
      const labelByFor = document.querySelector("label[for='" + radio.id + "']");
      if (labelByFor) return labelByFor;
    }

    const wrappingLabel = radio.closest("label");
    if (wrappingLabel) return wrappingLabel;

    const roleRadio = radio.closest("[role='radio']");
    if (roleRadio) return roleRadio;

    const clickableAncestor = radio.closest(".radio, .option, .choice, li, td, div");
    if (clickableAncestor) return clickableAncestor;

    return radio;
  };

  const fillForm = () => {
    const radios = Array.from(document.querySelectorAll("input[type='radio'][value='5']"))
      .filter((radio) => !radio.disabled);
    const textareas = Array.from(document.querySelectorAll("textarea"));

    if (radios.length === 0 && textareas.length === 0) {
      return false;
    }

    radios.forEach((radio) => {
      if (!radio.checked) {
        // Use a real click on the rendered bullet option so validation state updates.
        const clickTarget = findRadioClickTarget(radio);
        clickWithMouseEvents(clickTarget);
        radio.checked = true;
      }
      trigger(radio, "input");
      trigger(radio, "change");
      trigger(radio, "blur");
    });

    textareas.forEach((textarea) => {
      if (textarea.value !== "N/A") {
        textarea.value = "N/A";
      }
      trigger(textarea, "input");
      trigger(textarea, "change");
    });

    console.log(LOG_PREFIX + " Filled form: radios=" + radios.length + ", textareas=" + textareas.length);
    hasFilledOnce = true;
    return true;
  };

  const isVisible = (el) => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };

  const findSubmitButton = () => {
    const candidates = Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button'], [role='button']"))
      .filter((el) => !el.disabled)
      .filter((el) => {
        const text = (el.innerText || el.value || "").trim().toLowerCase();
        return text === "submit" || text.includes("submit");
      })
      .filter(isVisible);

    if (candidates.length === 0) {
      return null;
    }

    // Prefer a lower-left submit button when multiple submit controls exist.
    candidates.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const scoreA = ra.bottom * 10000 - ra.left;
      const scoreB = rb.bottom * 10000 - rb.left;
      return scoreB - scoreA;
    });

    return candidates[0];
  };

  const submitForm = () => {
    if (hasSubmittedOnce) {
      return false;
    }

    const submitButton = findSubmitButton();
    if (!submitButton) {
      return false;
    }

    trigger(submitButton, "mousedown");
    trigger(submitButton, "mouseup");
    submitButton.click();
    hasSubmittedOnce = true;
    window.__autoCourseFeedbackSubmitted = true;
    console.log(LOG_PREFIX + " Submit clicked automatically.");
    return true;
  };

  const runWhenReady = () => {
    if (fillForm()) {
      setTimeout(() => {
        submitForm();
      }, 250);
    }

    let retries = 0;
    const maxRetries = 10;
    const retryDelayMs = 700;

    const retryTimer = setInterval(() => {
      retries += 1;
      const didFill = fillForm();
      if (didFill) {
        setTimeout(() => {
          submitForm();
        }, 250);
      }
      if (didFill || retries >= maxRetries) {
        clearInterval(retryTimer);
      }
    }, retryDelayMs);

    const observer = new MutationObserver(() => {
      if (fillForm()) {
        setTimeout(() => {
          submitForm();
        }, 250);
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      if (!hasFilledOnce) {
        console.debug(LOG_PREFIX + " No matching form fields detected.");
      }
    }, 10000);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runWhenReady, { once: true });
  } else {
    runWhenReady();
  }
})();
