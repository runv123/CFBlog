
(() => {
  "use strict";

  const grid = document.getElementById("portfolio-grid");
  const status = document.getElementById("portfolio-status");

  if (!grid || !status) return;

  function createProjectCard(project) {
    const card = document.createElement("article");
    card.className = "post-card";

    const tag = document.createElement("span");
    tag.className = "post-tag";
    tag.textContent = project.category || "项目作品";

    const heading = document.createElement("h3");
    const link = document.createElement("a");
    link.href = "project.html?slug=" + encodeURIComponent(project.slug || "");
    link.textContent = project.title || "未命名项目";
    heading.appendChild(link);

    const summary = document.createElement("p");
    summary.textContent = project.summary || "查看项目详情。";

    card.append(tag, heading, summary);
    return card;
  }

  async function loadProjects() {
    try {
      const response = await fetch("api/projects", {
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error("项目接口暂不可用");
      }

      const data = await response.json();
      const projects = Array.isArray(data)
        ? data
        : Array.isArray(data.projects)
          ? data.projects
          : [];

      grid.replaceChildren();

      if (!projects.length) {
        status.textContent = "暂时还没有公开的作品。";
        return;
      }

      status.textContent = `共 ${projects.length} 个作品`;
      grid.append(...projects.map(createProjectCard));
    } catch (_) {
      status.textContent = "作品加载失败，请稍后重试。";
      grid.replaceChildren();
    }
  }

  loadProjects();
})();
