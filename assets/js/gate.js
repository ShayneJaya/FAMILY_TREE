const STORAGE_KEY = "ft_auth_v1";
const VERSION = "1";

const K = 0x17;
const _x = (arr, k) => String.fromCharCode(...arr.map((n) => n ^ k));
const dec = (s) => globalThis[["at", "ob"].join("")](s);

const _d1 = ["ZW", "1"].join("");
const _d2 = [101, 42, 43].map((n) => n ^ K);

//XOR-encoded with K
const _U = [65, 79, 89, 123, 116, 125, 86, 111, 90, 83, 82, 38];
const _P = [
  65, 39, 77, 127, 117, 64, 123, 100, 114, 79, 69, 110, 77, 64, 65, 70, 78, 79,
  89, 109, 90, 125, 86, 110, 89, 126, 82, 42,
];

const U_S = _x(_U, K);
const P_S = _x(_P, K);

function getExpectedCreds() {
  try {
    const u = dec(U_S);
    const p = dec(P_S);
    return { u, p };
  } catch {
    return { u: "", p: "" };
  }
}

function tokenFor(u, p) {
  return `v${VERSION}:${btoa(`${u}:${p}`)}`;
}

function isAuthed() {
  const t = sessionStorage.getItem(STORAGE_KEY);
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
    const password = String(data.get("password") || "").trim();

    const { u, p } = getExpectedCreds();
    const ok = username === u && password === p;

    if (!ok) {
      errorEl.textContent = "Invalid username or password.";
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, tokenFor(u, p));
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
