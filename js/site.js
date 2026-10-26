
(() => {
  "use strict";

  const root = document.documentElement;
  const themeButton = document.getElementById("theme-toggle");
  const themeLabel = document.getElementById("theme-label");

  function getPreferredTheme() {
    try {
      const saved = localStorage.getItem("mblog-theme");
      if (saved === "light" || saved === "dark") {
        return saved;
      }
    } catch (_) {
      // 浏览器禁止本地存储时，继续使用系统主题。
    }

    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;

    if (themeLabel) {
      themeLabel.textContent =
        theme === "dark" ? "切换浅色" : "切换深色";
    }

    if (themeButton) {
      themeButton.setAttribute(
        "aria-label",
        theme === "dark" ? "切换到浅色主题" : "切换到深色主题"
      );
    }

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute(
        "content",
        theme === "dark" ? "#11141b" : "#f7f8fa"
      );
    }
  }

  let currentTheme = getPreferredTheme();
  applyTheme(currentTheme);

  if (themeButton) {
    themeButton.addEventListener("click", () => {
      currentTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(currentTheme);

      try {
        localStorage.setItem("mblog-theme", currentTheme);
      } catch (_) {
        // 主题切换仍然有效，只是不跨页面保存偏好。
      }
    });
  }

  document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  document.querySelectorAll("[data-current-page]").forEach((element) => {
    const current = element.getAttribute("data-current-page");
    if (current && element.getAttribute("href") === current) {
      element.setAttribute("aria-current", "page");
    }
  });
})();
