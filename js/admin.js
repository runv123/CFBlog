
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const message = $("admin-message");
  const loginPanel = $("login-panel");
  const dashboard = $("dashboard");

  let posts = [];
  let projects = [];
  let busy = false;
  let dirty = false;

  function showMessage(text, isError = false) {
    message.hidden = false;
    message.textContent = text;
    message.setAttribute("role", isError ? "alert" : "status");
    message.dataset.kind = isError ? "error" : "success";
  }

  function clearMessage() {
    message.hidden = true;
    message.textContent = "";
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      loginPanel.hidden = false;
      dashboard.hidden = true;
      $("logout-button").hidden = true;
      throw new Error("登录已过期，请重新登录。");
    }

    if (!response.ok) {
      throw new Error(data.error || `请求失败（HTTP ${response.status}）`);
    }

    return data;
  }

  function slugify(value) {
    return value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 180);
  }

  function bindSlug(titleId, slugId) {
    const title = $(titleId);
    const slug = $(slugId);

    title.addEventListener("input", () => {
      if (slug.dataset.manuallyEdited !== "true") {
        slug.value = slugify(title.value);
      }
      dirty = true;
    });

    slug.addEventListener("input", () => {
      slug.dataset.manuallyEdited = "true";
      dirty = true;
    });
  }

  bindSlug("post-title", "post-slug");
  bindSlug("project-title", "project-slug");

  function resetSlug(slugId) {
    const slug = $(slugId);
    slug.value = "";
    slug.dataset.manuallyEdited = "false";
  }

  function markDirty() {
    dirty = true;
  }

  document.querySelectorAll(
    "#post-form input, #post-form textarea, #post-form select, " +
    "#project-form input, #project-form textarea, #project-form select"
  ).forEach((element) => {
    element.addEventListener("input", markDirty);
    element.addEventListener("change", markDirty);
  });

  window.addEventListener("beforeunload", (event) => {
    if (dirty && !busy) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  function switchTab(name) {
    const postsActive = name === "posts";

    $("posts-panel").hidden = !postsActive;
    $("projects-panel").hidden = postsActive;

    document.querySelectorAll(".admin-tab").forEach((button) => {
      const active = button.dataset.tab === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });

    clearMessage();
  }

  document.querySelectorAll(".admin-tab").forEach((button) => {
    button.addEventListener("click", () => {
      if (dirty && !confirm("当前内容可能尚未保存，确定切换页面吗？")) {
        return;
      }

      dirty = false;
      switchTab(button.dataset.tab);
    });
  });

  function validateSlug(value) {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  }

  function checkSlugUniqueness(items, slug, id) {
    return !items.some(
      (item) => item.slug === slug && String(item.id) !== String(id || "")
    );
  }

  function formatDate(value) {
    if (!value) return "尚无发布日期";

    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "尚无发布日期"
      : date.toLocaleString("zh-CN");
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function createActionButton(label, action, id) {
    const button = createElement("button", "", label);
    button.type = "button";
    button.addEventListener("click", () => action(id));
    return button;
  }

  function renderItems(type) {
    const isPost = type === "posts";
    const items = isPost ? posts : projects;
    const list = $(isPost ? "posts-list" : "projects-list");

    list.replaceChildren();

    if (!items.length) {
      list.appendChild(
        createElement("p", "empty-state", "目前没有内容，点击上方按钮创建。")
      );
      return;
    }

    for (const item of items) {
      const row = createElement("article", "admin-item");
      const info = createElement("div", "");
      const heading = createElement("h3", "", item.title || "未命名");

      const status = createElement(
        "span",
        "admin-status " + (item.status === "published" ? "published" : ""),
        item.status === "published" ? "已发布" : "草稿"
      );

      const slug = createElement("p", "", "Slug：" + item.slug);
      const date = createElement(
        "p",
        "",
        item.status === "published"
          ? "发布时间：" + formatDate(item.publishedAt || item.published_at)
          : "尚未发布"
      );

      info.append(heading, status, slug, date);

      const actions = createElement("div", "admin-item-actions");
      actions.appendChild(
        createActionButton("编辑", isPost ? editPost : editProject, item.id)
      );
      actions.appendChild(
        createActionButton("删除", isPost ? deletePost : deleteProject, item.id)
      );

      row.append(info, actions);
      list.appendChild(row);
    }
  }

  async function loadItems() {
    const [postData, projectData] = await Promise.all([
      api("api/admin/posts"),
      api("api/admin/projects")
    ]);

    posts = Array.isArray(postData.posts) ? postData.posts : [];
    projects = Array.isArray(projectData.projects) ? projectData.projects : [];

    renderItems("posts");
    renderItems("projects");
  }

  function newPost() {
    if (dirty && !confirm("当前编辑内容尚未保存，确定放弃吗？")) return;

    $("post-form").reset();
    $("post-id").value = "";
    resetSlug("post-slug");
    $("post-status").value = "draft";
    $("post-form").hidden = false;
    dirty = false;
    clearMessage();
    $("post-title").focus();
  }

  function newProject() {
    if (dirty && !confirm("当前编辑内容尚未保存，确定放弃吗？")) return;

    $("project-form").reset();
    $("project-id").value = "";
    resetSlug("project-slug");
    $("project-status").value = "draft";
    $("project-form").hidden = false;
    dirty = false;
    clearMessage();
    $("project-title").focus();
  }

  function editPost(id) {
    if (dirty && !confirm("当前编辑内容尚未保存，确定放弃吗？")) return;

    const post = posts.find((item) => String(item.id) === String(id));
    if (!post) return showMessage("找不到这篇文章，请刷新后重试。", true);

    $("post-id").value = post.id;
    $("post-title").value = post.title || "";
    $("post-slug").value = post.slug || "";
    $("post-slug").dataset.manuallyEdited = "true";
    $("post-summary").value = post.summary || "";
    $("post-content").value = post.content || "";
    $("post-status").value = post.status || "draft";
    $("post-form").hidden = false;
    dirty = false;
    clearMessage();
    $("post-title").focus();
  }

  function editProject(id) {
    if (dirty && !confirm("当前编辑内容尚未保存，确定放弃吗？")) return;

    const project = projects.find((item) => String(item.id) === String(id));
    if (!project) return showMessage("找不到这个作品，请刷新后重试。", true);

    $("project-id").value = project.id;
    $("project-title").value = project.title || "";
    $("project-slug").value = project.slug || "";
    $("project-slug").dataset.manuallyEdited = "true";
    $("project-category").value = project.category || "";
    $("project-summary").value = project.summary || "";
    $("project-content").value = project.content || "";
    $("project-url").value = project.url || "";
    $("project-status").value = project.status || "draft";
    $("project-form").hidden = false;
    dirty = false;
    clearMessage();
    $("project-title").focus();
  }

  function validatePost(items) {
    const title = $("post-title").value.trim();
    const slug = $("post-slug").value.trim();
    const content = $("post-content").value.trim();
    const id = $("post-id").value;

    if (!title) throw new Error("请填写文章标题。");
    if (!slug) throw new Error("请填写文章 Slug。");
    if (!validateSlug(slug)) {
      throw new Error("Slug 格式错误，只能使用小写字母、数字和连字符。");
    }
    if (!content) throw new Error("请填写文章正文。");
    if (!checkSlugUniqueness(items, slug, id)) {
      throw new Error("这个 Slug 已经被使用，请修改后再保存。");
    }

    return {
      title,
      slug,
      summary: $("post-summary").value.trim(),
      content,
      status: $("post-status").value
    };
  }

  function validateProject(items) {
    const title = $("project-title").value.trim();
    const slug = $("project-slug").value.trim();
    const content = $("project-content").value.trim();
    const id = $("project-id").value;
    const rawUrl = $("project-url").value.trim();

    if (!title) throw new Error("请填写作品名称。");
    if (!slug) throw new Error("请填写作品 Slug。");
    if (!validateSlug(slug)) {
      throw new Error("作品 Slug 格式错误，只能使用小写字母、数字和连字符。");
    }
    if (!content) throw new Error("请填写作品详情。");
    if (!checkSlugUniqueness(items, slug, id)) {
      throw new Error("这个作品 Slug 已被使用，请修改。");
    }

    let url = "";
    if (rawUrl) {
      let parsed;
      try {
        parsed = new URL(rawUrl);
      } catch (_) {
        throw new Error("项目网址格式不正确。");
      }

      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("项目网址只允许 HTTP 或 HTTPS。");
      }

      url = parsed.href;
    }

    return {
      title,
      slug,
      category: $("project-category").value.trim(),
      summary: $("project-summary").value.trim(),
      content,
      url,
      status: $("project-status").value
    };
  }

  async function saveEntity(type, event) {
    event.preventDefault();
    if (busy) return;

    clearMessage();

    const isPost = type === "posts";
    const form = $(isPost ? "post-form" : "project-form");
    const button = $(isPost ? "save-post-button" : "save-project-button");
    const items = isPost ? posts : projects;
    const id = $(isPost ? "post-id" : "project-id").value;

    try {
      const payload = isPost ? validatePost(items) : validateProject(items);
      const oldItem = items.find((item) => String(item.id) === String(id));

      if (oldItem && oldItem.slug !== payload.slug &&
          oldItem.status === "published" &&
          !confirm("你正在修改已发布内容的 Slug，原链接可能失效。确定继续吗？")) {
        return;
      }

      busy = true;
      button.disabled = true;
      button.textContent = "正在保存……";

      const path = id
        ? `api/admin/${type}/${encodeURIComponent(id)}`
        : `api/admin/${type}`;

      await api(path, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });

      dirty = false;
      form.hidden = true;
      await loadItems();
      showMessage(isPost ? "文章保存成功。" : "作品保存成功。");
    } catch (error) {
      showMessage(error.message || "保存失败，请稍后重试。", true);
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = isPost ? "保存文章" : "保存作品";
    }
  }

  async function deleteEntity(type, id) {
    if (busy) return;

    const isPost = type === "posts";
    const items = isPost ? posts : projects;
    const item = items.find((entry) => String(entry.id) === String(id));
    if (!item) return;

    const kind = isPost ? "文章" : "作品";
    if (!confirm(`确定删除${kind}“${item.title}”吗？此操作无法撤销。`)) {
      return;
    }

    try {
      busy = true;

      await api(`api/admin/${type}/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });

      dirty = false;
      await loadItems();
      showMessage(`${kind}已删除。`);
    } catch (error) {
      showMessage(error.message || `删除${kind}失败。`, true);
    } finally {
      busy = false;
    }
  }

  const deletePost = (id) => deleteEntity("posts", id);
  const deleteProject = (id) => deleteEntity("projects", id);

  $("new-post-button").addEventListener("click", newPost);
  $("new-project-button").addEventListener("click", newProject);

  $("cancel-post-button").addEventListener("click", () => {
    if (dirty && !confirm("放弃尚未保存的修改吗？")) return;
    $("post-form").hidden = true;
    dirty = false;
    clearMessage();
  });

  $("cancel-project-button").addEventListener("click", () => {
    if (dirty && !confirm("放弃尚未保存的修改吗？")) return;
    $("project-form").hidden = true;
    dirty = false;
    clearMessage();
  });

  $("post-form").addEventListener("submit", (event) => saveEntity("posts", event));
  $("project-form").addEventListener("submit", (event) => saveEntity("projects", event));

  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    const button = $("login-button");
    const password = $("admin-password").value;

    try {
      busy = true;
      button.disabled = true;
      button.textContent = "正在登录……";

      await api("api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password })
      });

      $("admin-password").value = "";
      loginPanel.hidden = true;
      dashboard.hidden = false;
      $("logout-button").hidden = false;
      await loadItems();
      showMessage("登录成功。");
    } catch (error) {
      showMessage(error.message || "登录失败，请检查密码。", true);
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = "登录";
    }
  });

  $("logout-button").addEventListener("click", async () => {
    if (busy) return;

    try {
      await api("api/auth/logout", { method: "POST" });
    } catch (_) {
      // 即使会话已经失效，也返回登录界面。
    }

    dashboard.hidden = true;
    loginPanel.hidden = false;
    $("logout-button").hidden = true;
    $("login-password")?.focus();
    showMessage("已退出管理后台。");
  });

  async function initialize() {
    try {
      await api("api/auth/session");
      loginPanel.hidden = true;
      dashboard.hidden = false;
      $("logout-button").hidden = false;
      await loadItems();
    } catch (_) {
      loginPanel.hidden = false;
      dashboard.hidden = true;
      $("logout-button").hidden = true;
    }
  }

  initialize();
})();
