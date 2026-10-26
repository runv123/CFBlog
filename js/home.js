
(() => {
  "use strict";

  const container = document.getElementById("latest-posts");
  if (!container) return;

  function showMessage(message) {
    const paragraph = document.createElement("p");
    paragraph.className = "empty-state";
    paragraph.textContent = message;
    container.replaceChildren(paragraph);
  }

  function createPostCard(post) {
    const article = document.createElement("article");
    article.className = "post-card";

    const meta = document.createElement("div");
    meta.className = "post-meta";
    meta.textContent = post.publishedAt
      ? new Date(post.publishedAt).toLocaleDateString("zh-CN")
      : "MBLog 文章";

    const heading = document.createElement("h3");
    const link = document.createElement("a");
    link.href = "post.html?slug=" + encodeURIComponent(post.slug);
    link.textContent = post.title || "未命名文章";
    heading.appendChild(link);

    const summary = document.createElement("p");
    summary.textContent = post.summary || "打开文章，阅读完整内容。";

    article.append(meta, heading, summary);
    return article;
  }

  async function loadLatestPosts() {
    try {
      const response = await fetch("api/posts?limit=3", {
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error("文章接口暂不可用");
      }

      const data = await response.json();
      const posts = Array.isArray(data)
        ? data
        : Array.isArray(data.posts)
          ? data.posts
          : [];

      if (posts.length === 0) {
        showMessage("暂时还没有已发布的文章，欢迎稍后再来。");
        return;
      }

      container.replaceChildren(
        ...posts.slice(0, 3).map(createPostCard)
      );
    } catch (_) {
      showMessage("文章列表暂时无法加载，请稍后重试。");
    }
  }

  loadLatestPosts();
})();
