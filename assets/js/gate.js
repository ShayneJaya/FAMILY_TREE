const STORAGE_KEY = "ft_auth_v1";
const VERSION = "1";

const USER_B64 = "VXNlcjAxMDE1";
const PASS_B64 = "V0ZhbWlseXRyZWVQYXNzMjAyNiE=";

function getExpectedCreds() {
  try {
    const u = atob(USER_B64);
    const p = atob(PASS_B64);
    return { u, p };
  } catch {
    return { u: "", p: "" };
  }
}

function tokenFor(u, p) {
  return `v${VERSION}:${btoa(`${u}:${p}`)}`;
}

function isAuthed() {
  const t = localStorage.getItem(STORAGE_KEY);
  const { u, p } = getExpectedCreds();
  return t === tokenFor(u, p);
}

function loadApp() {
  import("./app.js").catch((err) => {
    console.error("[gate] failed loading app.js", err);
  });
}

function renderLogin() {
  const overlay = document.createElement("div");
  overlay.className = "auth-overlay";
  overlay.innerHTML = `
    <div class="auth-card">
      <h2>Family Directory</h2>
      <p class="muted">Please sign in to continue</p>
      <form class="auth-form">
        <label>
          <span>Username</span>
          <input type="text" name="username" autocomplete="username" required />
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="password" autocomplete="current-password" required />
        </label>
        <button type="submit">Sign in</button>
        <div class="auth-error" aria-live="polite" role="status"></div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const form = overlay.querySelector(".auth-form");
  const errorEl = overlay.querySelector(".auth-error");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "");

    const { u, p } = getExpectedCreds();
    const ok = username === u && password === p;

    if (!ok) {
      errorEl.textContent = "Invalid username or password.";
      return;
    }
    localStorage.setItem(STORAGE_KEY, tokenFor(u, p));
    overlay.remove();
    loadApp();
  });
}

if (isAuthed()) {
  loadApp();
} else {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderLogin, { once: true });
  } else {
    renderLogin();
  }
}
