
(() => {
  "use strict";

  const article = document.getElementById("article-content");
  if (!article) return;

  function addTextElement(parent, tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function formatDate(value) {
    if (!value) return "未注明发布日期";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "未注明发布日期";

    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  async function loadPost() {
    const slug = new URLSearchParams(location.search).get("slug");

    if (!slug) {
      article.replaceChildren();
      addTextElement(article, "h1", "", "未指定文章");
      addTextElement(article, "p", "muted", "请从文章列表选择一篇文章。");
      return;
    }

    try {
      const response = await fetch(
        "api/posts/" + encodeURIComponent(slug),
        { headers: { Accept: "application/json" } }
      );

      if (response.status === 404) {
        throw new Error("找不到这篇文章，或文章尚未发布。");
      }

      if (!response.ok) {
        throw new Error("文章暂时无法加载，请稍后重试。");
      }

      const data = await response.json();
      const post = data.post || data;

      article.replaceChildren();

      addTextElement(
        article,
        "p",
        "eyebrow",
        "MBLOG / ARTICLE"
      );

      addTextElement(
        article,
        "h1",
        "article-title",
        post.title || "未命名文章"
      );

      addTextElement(
        article,
        "p",
        "post-meta",
        formatDate(post.publishedAt || post.published_at)
      );

      if (post.summary) {
        addTextElement(article, "p", "article-summary", post.summary);
      }

      const body = document.createElement("div");
      body.className = "article-body";
      body.textContent = post.content || post.body || "本文暂无正文。";
      article.appendChild(body);

      document.title = `${post.title || "文章详情"} · MBLog`;
    } catch (error) {
      article.replaceChildren();
      addTextElement(article, "h1", "", "文章无法打开");
      addTextElement(
        article,
        "p",
        "muted",
        error.message || "发生未知错误，请稍后重试。"
      );
      addTextElement(article, "p", "", "你可以返回文章列表重新选择。");

      const link = document.createElement("a");
      link.href = "blog.html";
      link.textContent = "返回文章列表";
      article.appendChild(link);
    }
  }

  loadPost();
})();
