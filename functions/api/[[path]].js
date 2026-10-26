
const COOKIE_NAME = "mblog_session";
const SESSION_SECONDS = 60 * 60 * 8;
const MAX_BODY_BYTES = 150_000;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function fail(message, status = 400) {
  return json({ error: message }, status);
}

function cookieValue(request, name) {
  const header = request.headers.get("Cookie") || "";

  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;

    if (part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }

  return "";
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))
  );
}

async function createSession(secret) {
  const payload = base64url(
    new TextEncoder().encode(JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
    }))
  );

  const signature = base64url(await hmac(secret, payload));
  return `${payload}.${signature}`;
}

async function validSession(request, secret) {
  const token = cookieValue(request, COOKIE_NAME);
  if (!token || !secret) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  try {
    const expected = await hmac(secret, parts[0]);
    const actual = fromBase64url(parts[1]);

    if (expected.length !== actual.length) return false;

    let difference = 0;
    for (let i = 0; i < expected.length; i++) {
      difference |= expected[i] ^ actual[i];
    }
    if (difference !== 0) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64url(parts[0]))
    );

    return Number.isFinite(payload.exp) &&
      payload.exp > Math.floor(Date.now() / 1000);
  } catch (_) {
    return false;
  }
}

function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";

  return `${COOKIE_NAME}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

function expiredCookie(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";

  return `${COOKIE_NAME}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

async function readJson(request) {
  const length = Number(request.headers.get("Content-Length") || 0);

  if (length > MAX_BODY_BYTES) {
    throw new Error("提交内容过大。");
  }

  const text = await request.text();

  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new Error("提交内容过大。");
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error("请求内容不是有效的 JSON。");
  }
}

function cleanText(value, maxLength, field, required = false) {
  if (typeof value !== "string") {
    if (required) throw new Error(`${field}不能为空。`);
    return "";
  }

  const result = value.trim();

  if (required && !result) {
    throw new Error(`${field}不能为空。`);
  }

  if (result.length > maxLength) {
    throw new Error(`${field}不能超过 ${maxLength} 个字符。`);
  }

  return result;
}

function cleanSlug(value) {
  const slug = cleanText(value, 180, "Slug", true);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Slug 格式不正确，只允许小写字母、数字和连字符。");
  }

  return slug;
}

function cleanStatus(value) {
  if (value !== "draft" && value !== "published") {
    throw new Error("发布状态无效。");
  }

  return value;
}

function cleanProjectUrl(value) {
  const raw = cleanText(value, 2048, "项目网址");

  if (!raw) return "";

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    throw new Error("项目网址格式不正确。");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("项目网址只允许 HTTP 或 HTTPS。");
  }

  return parsed.href;
}

function checkSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch (_) {
    return false;
  }
}

function requireDatabase(env) {
  if (!env.DB) throw new Error("未配置 D1 数据库绑定 DB。");
  return env.DB;
}

function rowPost(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary || "",
    content: row.content || "",
    status: row.status,
    publishedAt: row.published_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowProject(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary || "",
    content: row.content || "",
    category: row.category || "",
    url: row.url || "",
    status: row.status,
    publishedAt: row.published_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function listPosts(db, admin = false) {
  const result = admin
    ? await db.prepare(
        "SELECT * FROM posts ORDER BY updated_at DESC"
      ).all()
    : await db.prepare(
        "SELECT id, title, slug, summary, published_at, created_at, updated_at " +
        "FROM posts WHERE status = 'published' " +
        "ORDER BY published_at DESC, created_at DESC"
      ).all();

  return (result.results || []).map(rowPost);
}

async function listProjects(db, admin = false) {
  const result = admin
    ? await db.prepare(
        "SELECT * FROM projects ORDER BY updated_at DESC"
      ).all()
    : await db.prepare(
        "SELECT id, title, slug, summary, category, url, published_at, created_at, updated_at " +
        "FROM projects WHERE status = 'published' " +
        "ORDER BY published_at DESC, created_at DESC"
      ).all();

  return (result.results || []).map(rowProject);
}

async function getBySlug(db, table, slug, admin) {
  const allowed = table === "posts" ? "posts" : "projects";
  const row = admin
    ? await db.prepare(`SELECT * FROM ${allowed} WHERE slug = ? LIMIT 1`)
        .bind(slug).first()
    : await db.prepare(
        `SELECT * FROM ${allowed} WHERE slug = ? AND status = 'published' LIMIT 1`
      ).bind(slug).first();

  if (!row) return null;
  return allowed === "posts" ? rowPost(row) : rowProject(row);
}

async function requireAdmin(request, env) {
  if (!env.SESSION_SECRET) {
    throw new Error("缺少 SESSION_SECRET 环境变量。");
  }

  if (!(await validSession(request, env.SESSION_SECRET))) {
    return false;
  }

  return true;
}

async function saveContent(db, table, input, id = null) {
  const isPost = table === "posts";

  const title = cleanText(input.title, 180, isPost ? "文章标题" : "作品名称", true);
  const slug = cleanSlug(input.slug);
  const summary = cleanText(input.summary || "", 500, "摘要");
  const content = cleanText(
    input.content,
    100000,
    isPost ? "文章正文" : "作品详情",
    true
  );
  const status = cleanStatus(input.status);

  const category = isPost ? "" : cleanText(input.category || "", 80, "分类");
  const url = isPost ? "" : cleanProjectUrl(input.url || "");

  const existing = await db.prepare(
    `SELECT id, status, published_at FROM ${table} WHERE slug = ? LIMIT 1`
  ).bind(slug).first();

  if (existing && String(existing.id) !== String(id || "")) {
    throw new Error("这个 Slug 已经存在，请修改后再保存。");
  }

  const old = id
    ? await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first()
    : null;

  if (id && !old) return null;

  const now = new Date().toISOString();
  const publishedAt = status === "published"
    ? (old?.published_at || now)
    : null;

  if (old) {
    if (isPost) {
      await db.prepare(
        "UPDATE posts SET title = ?, slug = ?, summary = ?, content = ?, " +
        "status = ?, published_at = ?, updated_at = ? WHERE id = ?"
      ).bind(
        title, slug, summary, content, status, publishedAt, now, id
      ).run();
    } else {
      await db.prepare(
        "UPDATE projects SET title = ?, slug = ?, summary = ?, content = ?, " +
        "category = ?, url = ?, status = ?, published_at = ?, updated_at = ? WHERE id = ?"
      ).bind(
        title, slug, summary, content, category, url, status,
        publishedAt, now, id
      ).run();
    }
  } else {
    if (isPost) {
      await db.prepare(
        "INSERT INTO posts (title, slug, summary, content, status, published_at, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        title, slug, summary, content, status, publishedAt, now, now
      ).run();
    } else {
      await db.prepare(
        "INSERT INTO projects (title, slug, summary, content, category, url, status, published_at, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        title, slug, summary, content, category, url, status,
        publishedAt, now, now
      ).run();
    }
  }

  return await getBySlug(db, table, slug, true);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
  const method = request.method.toUpperCase();

  if (!path) return fail("API 路径不存在。", 404);

  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !checkSameOrigin(request)) {
    return fail("请求来源校验失败。", 403);
  }

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Allow": "GET, POST, PUT, DELETE, OPTIONS" }
    });
  }

  try {
    if (path === "auth/login" && method === "POST") {
      if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
        return fail("管理员环境变量尚未配置。", 500);
      }

      const body = await readJson(request);
      if (typeof body.password !== "string" || body.password.length > 256) {
        return fail("密码格式无效。", 400);
      }

      if (body.password !== env.ADMIN_PASSWORD) {
        return fail("密码不正确。", 401);
      }

      const token = await createSession(env.SESSION_SECRET);
      return json({ ok: true }, 200, {
        "Set-Cookie": sessionCookie(token, request)
      });
    }

    if (path === "auth/logout" && method === "POST") {
      return json({ ok: true }, 200, {
        "Set-Cookie": expiredCookie(request)
      });
    }

    if (path === "auth/session" && method === "GET") {
      const authenticated = await requireAdmin(request, env);
      return authenticated
        ? json({ authenticated: true })
        : fail("登录已过期，请重新登录。", 401);
    }

    const publicPostMatch = path.match(/^posts\/([a-z0-9-]+)$/);
    const publicProjectMatch = path.match(/^projects\/([a-z0-9-]+)$/);

    if (path === "posts" && method === "GET") {
      const db = requireDatabase(env);
      const posts = await listPosts(db, false);
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 50));
      return json({ posts: posts.slice(0, limit) });
    }

    if (publicPostMatch && method === "GET") {
      const post = await getBySlug(
        requireDatabase(env), "posts", publicPostMatch[1], false
      );
      return post ? json({ post }) : fail("文章不存在。", 404);
    }

    if (path === "projects" && method === "GET") {
      return json({ projects: await listProjects(requireDatabase(env), false) });
    }

    if (publicProjectMatch && method === "GET") {
      const project = await getBySlug(
        requireDatabase(env), "projects", publicProjectMatch[1], false
      );
      return project ? json({ project }) : fail("作品不存在。", 404);
    }

    const adminMatch = path.match(/^admin\/(posts|projects)(?:\/(\d+))?$/);

    if (adminMatch) {
      if (!(await requireAdmin(request, env))) {
        return fail("登录已过期，请重新登录。", 401);
      }

      const table = adminMatch[1];
      const id = adminMatch[2] || null;
      const db = requireDatabase(env);

      if (!id && method === "GET") {
        const items = table === "posts"
          ? await listPosts(db, true)
          : await listProjects(db, true);

        return json(table === "posts" ? { posts: items } : { projects: items });
      }

      if (!id && method === "POST") {
        const body = await readJson(request);
        const saved = await saveContent(db, table, body);
        return json({ ok: true, [table === "posts" ? "post" : "project"]: saved }, 201);
      }

      if (id && method === "PUT") {
        const body = await readJson(request);
        const saved = await saveContent(db, table, body, id);

        if (!saved) return fail("找不到需要编辑的内容。", 404);

        return json({ ok: true, [table === "posts" ? "post" : "project"]: saved });
      }

      if (id && method === "DELETE") {
        const result = await db.prepare(
          `DELETE FROM ${table} WHERE id = ?`
        ).bind(id).run();

        if (!result.meta?.changes) return fail("内容不存在。", 404);
        return json({ ok: true });
      }
    }

    return fail("找不到该 API 路径。", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器内部错误。";
    const status = /Slug 已经存在/.test(message) ? 409 : 400;
    return fail(message, status);
  }
}
