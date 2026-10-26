
(() => {
  "use strict";

  const container = document.getElementById("project-content");
  if (!container) return;

  function addText(parent, tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    parent.appendChild(element);
    return element;
  }

  async function loadProject() {
    const slug = new URLSearchParams(location.search).get("slug");

    if (!slug) {
      container.replaceChildren();
      addText(container, "h1", "", "未指定项目");
      addText(container, "p", "muted", "请从作品列表选择一个项目。");
      return;
    }

    try {
      const response = await fetch(
        "api/projects/" + encodeURIComponent(slug),
        { headers: { Accept: "application/json" } }
      );

      if (response.status === 404) {
        throw new Error("找不到这个项目，或项目尚未公开。");
      }

      if (!response.ok) {
        throw new Error("项目暂时无法加载，请稍后重试。");
      }

      const data = await response.json();
      const project = data.project || data;

      container.replaceChildren();

      addText(container, "p", "eyebrow", "MBLOG / PROJECT");
      addText(container, "h1", "article-title", project.title || "未命名项目");

      if (project.category) {
        addText(container, "p", "post-meta", project.category);
      }

      if (project.summary) {
        addText(container, "p", "article-summary", project.summary);
      }

      const body = document.createElement("div");
      body.className = "article-body";
      body.textContent =
        project.content || project.description || "这个项目暂时还没有详细介绍。";
      container.appendChild(body);

      if (project.url) {
        try {
          const externalUrl = new URL(project.url);

          if (externalUrl.protocol === "https:" || externalUrl.protocol === "http:") {
            const link = document.createElement("a");
            link.href = externalUrl.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "访问项目网站 ↗";
            link.className = "button";
            container.appendChild(link);
          }
        } catch (_) {
          // 无效链接不显示，避免生成错误或不安全的链接。
        }
      }

      document.title = `${project.title || "项目详情"} · MBLog`;
    } catch (error) {
      container.replaceChildren();
      addText(container, "h1", "", "项目无法打开");
      addText(
        container,
        "p",
        "muted",
        error.message || "发生未知错误，请稍后重试。"
      );

      const link = document.createElement("a");
      link.href = "portfolio.html";
      link.textContent = "返回作品列表";
      container.appendChild(link);
    }
  }

  loadProject();
})();
