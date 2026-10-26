
(() => {
  "use strict";

  const list = document.getElementById("blog-posts");
  const status = document.getElementById("blog-status");
  const search = document.getElementById("post-search");

  if (!list || !status) return;

  let allPosts = [];

  function formatDate(value) {
    if (!value) return "未注明日期";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "未注明日期";

    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function renderPosts(posts) {
    list.replaceChildren();

    if (!posts.length) {
      status.textContent = "没有找到匹配的文章。";
      return;
    }

    status.textContent = `共 ${posts.length} 篇文章`;

    for (const post of posts) {
      const card = document.createElement("article");
      card.className = "post-card";

      const meta = document.createElement("div");
      meta.className = "post-meta";
      meta.textContent = formatDate(post.publishedAt || post.published_at);

      const title = document.createElement("h3");
      const link = document.createElement("a");
      link.href = "post.html?slug=" + encodeURIComponent(post.slug || "");
      link.textContent = post.title || "未命名文章";
      title.appendChild(link);

      const summary = document.createElement("p");
      summary.textContent = post.summary || "打开文章，阅读完整内容。";

      card.append(meta, title, summary);
      list.appendChild(card);
    }
  }

  function filterPosts() {
    const keyword = (search?.value || "").trim().toLocaleLowerCase();

    const filtered = allPosts.filter((post) => {
      const title = String(post.title || "").toLocaleLowerCase();
      const summary = String(post.summary || "").toLocaleLowerCase();

      return title.includes(keyword) || summary.includes(keyword);
    });

    renderPosts(filtered);
  }

  async function loadPosts() {
    status.textContent = "正在加载文章……";

    try {
      const response = await fetch("api/posts", {
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error(`请求失败：${response.status}`);
      }

      const data = await response.json();
      allPosts = Array.isArray(data)
        ? data
        : Array.isArray(data.posts)
          ? data.posts
          : [];

      filterPosts();
    } catch (_) {
      status.textContent = "文章加载失败，请稍后重试。";
      list.replaceChildren();
    }
  }

  search?.addEventListener("input", filterPosts);
  loadPosts();
})();
