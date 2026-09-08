// ===== ВРЕМЕННЫЙ перехватчик ошибок — показывает JS-ошибки прямо на экране,
// потому что на планшете без devtools их иначе не увидеть. Убрать после
// того, как найдём и починим баг с зависающей отправкой сообщений. =====
(function () {
  function showJsError(msg) {
    let el = document.getElementById("jsErrorBanner");
    if (!el) {
      el = document.createElement("div");
      el.id = "jsErrorBanner";
      el.style.cssText =
        "position:fixed;bottom:70px;left:8px;right:8px;background:#5a1a1a;color:#fff;" +
        "padding:10px;border-radius:8px;font-size:12px;z-index:99999;white-space:pre-wrap;" +
        "max-height:160px;overflow-y:auto;font-family:monospace;box-shadow:0 0 0 2px #ff6b6b;";
      document.body.appendChild(el);
    }
    el.textContent += (el.textContent ? "\n---\n" : "") + msg;
  }
  window.addEventListener("error", (e) => {
    showJsError(`JS error: ${e.message}\n(${e.filename}:${e.lineno}:${e.colno})`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason && e.reason.message ? e.reason.message : String(e.reason);
    showJsError(`Promise error: ${reason}`);
  });
})();

const chat = document.getElementById("chat");
const form = document.getElementById("composer");
const input = document.getElementById("input");

// ===== Прикрепление фото к сообщению (скрепка в composer) =====
const MAX_IMAGE_DIMENSION = 1280;
let pendingImage = null; // dataURL текущего прикреплённого фото
let attachPreviewBarEl = null;

function resizeImageToDataUrl(file, maxDimension) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function buildAttachUI() {
  if (!form || !input) return;

  // Оборачиваем textarea, чтобы разместить скрепку абсолютным позиционированием
  // внутри самого поля, у правого края — а не отдельной кнопкой снаружи.
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:relative;flex:1;display:flex;min-width:0;";
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);
  input.style.flex = "1";
  input.style.boxSizing = "border-box";
  input.style.paddingRight = "38px";

  const attachBtn = document.createElement("button");
  attachBtn.type = "button";
  attachBtn.title = "прикрепить фото";
  attachBtn.style.cssText =
    "position:absolute;right:4px;bottom:6px;background:transparent;border:none;color:var(--text-dim);cursor:pointer;padding:5px;line-height:0;";
  attachBtn.innerHTML =
    '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M17 7l-7.5 7.5a2.5 2.5 0 0 0 3.5 3.5L20 11a5 5 0 0 0-7-7L6 11a3.5 3.5 0 0 0 5 5l6-6" /></svg>';

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";

  const previewBar = document.createElement("div");
  previewBar.id = "attachPreview";
  previewBar.style.cssText =
    "display:none;align-items:center;gap:8px;padding:6px 8px;margin-bottom:6px;background:var(--panther-soft);border:1px solid var(--panther-line);border-radius:10px;";

  const previewImg = document.createElement("img");
  previewImg.style.cssText = "width:36px;height:36px;object-fit:cover;border-radius:6px;";

  const previewRemove = document.createElement("button");
  previewRemove.type = "button";
  previewRemove.textContent = "убрать фото";
  previewRemove.style.cssText = "background:transparent;border:none;color:var(--text-dim);cursor:pointer;font-size:12px;";

  previewBar.appendChild(previewImg);
  previewBar.appendChild(previewRemove);
  attachPreviewBarEl = previewBar;

  attachBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    resizeImageToDataUrl(file, MAX_IMAGE_DIMENSION)
      .then((dataUrl) => {
        pendingImage = dataUrl;
        previewImg.src = dataUrl;
        previewBar.style.display = "flex";
      })
      .catch(() => alert("не удалось прочитать фото"));
    fileInput.value = "";
  });

  previewRemove.addEventListener("click", () => {
    pendingImage = null;
    previewBar.style.display = "none";
  });

  wrapper.appendChild(attachBtn);
  wrapper.appendChild(fileInput);
  if (form.parentElement) form.parentElement.insertBefore(previewBar, form);
}

buildAttachUI();

const chatsToggle = document.getElementById("chatsToggle");
const chatsPanel = document.getElementById("chatsPanel");
const chatsListEl = document.getElementById("chatsList");
const newChatBtn = document.getElementById("newChatBtn");
const profileToggle = document.getElementById("profileToggle");
const profilePanel = document.getElementById("profilePanel");
const swatchesEl = document.getElementById("swatches");
const radiusSlider = document.getElementById("radiusSlider");
const authToggle = document.getElementById("authToggle");
const authPanel = document.getElementById("authPanel");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authError = document.getElementById("authError");
const guestBanner = document.getElementById("guestBanner");
const guestBannerBtn = document.getElementById("guestBannerBtn");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const forgotForm = document.getElementById("forgotForm");
const resetForm = document.getElementById("resetForm");
const codeForm = document.getElementById("codeForm");
const codeInput = document.getElementById("codeInput");
const codeNewPassword = document.getElementById("codeNewPassword");
const statusTextEl = document.getElementById("statusText");
const statusDotsEl = document.getElementById("statusDots");
const msgActionMenu = document.getElementById("msgActionMenu");
const msgActionCopy = document.getElementById("msgActionCopy");
const msgActionReply = document.getElementById("msgActionReply");
const quotePreview = document.getElementById("quotePreview");
const quotePreviewText = document.getElementById("quotePreviewText");
const quotePreviewClose = document.getElementById("quotePreviewClose");

// ===== Тема (светлая/тёмная) =====
// Хранится в localStorage, применяется атрибутом data-theme на <html>,
// от которого зависят все цветовые CSS-переменные (см. :root /
// [data-theme="light"] в style.css). Переключение сопровождается
// анимацией расширяющегося круга от точки нажатия на кнопку.

const THEME_KEY = "yari_theme";
const THEME_BASE_COLOR = { dark: "#110d13", light: "#ffffff" };

function getTheme() {
  return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

function sunIconSvg(color) {
  return (
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>`
  );
}

function moonIconSvg(color) {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="${color}" stroke="none"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5z"/></svg>`;
}

// Тёмная тема → иконка солнышка на градиентной кнопке (как "создать код").
// Светлая тема → иконка голубой луны на обычной прозрачной кнопке.
function updateThemeToggleBtn(theme) {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;
  const icon = btn.querySelector(".theme-toggle-icon");
  const label = btn.querySelector(".theme-toggle-label");
  if (theme === "dark") {
    btn.style.background = "linear-gradient(135deg, var(--peach), var(--lavender))";
    btn.style.borderColor = "transparent";
    if (icon) icon.innerHTML = sunIconSvg("var(--on-accent)");
    if (label) {
      label.textContent = tr("themeLight");
      label.style.color = "var(--on-accent)";
    }
  } else {
    btn.style.background = "transparent";
    btn.style.borderColor = "var(--panther-line)";
    if (icon) icon.innerHTML = moonIconSvg("var(--cyber-blue)");
    if (label) {
      label.textContent = tr("themeDark");
      label.style.color = "var(--text-dim)";
    }
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  updateThemeToggleBtn(theme);
}

// Оверлей закрашивается цветом НОВОЙ темы и расширяется кругом от точки
// нажатия (clip-path). Как только круг закрывает весь экран — тема
// переключается мгновенно у него "под низом", а сам оверлей тут же
// растворяется, открывая уже переключённый интерфейс.
function runThemeTransition(e) {
  const nextTheme = getTheme() === "dark" ? "light" : "dark";
  const rect = e.currentTarget.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const maxRadius = Math.hypot(
    Math.max(cx, window.innerWidth - cx),
    Math.max(cy, window.innerHeight - cy)
  );

  const overlay = document.createElement("div");
  overlay.style.cssText =
    `position:fixed;inset:0;z-index:9998;pointer-events:none;` +
    `background:${THEME_BASE_COLOR[nextTheme]};` +
    `clip-path:circle(0px at ${cx}px ${cy}px);` +
    `transition:clip-path 0.5s ease;`;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.clipPath = `circle(${maxRadius}px at ${cx}px ${cy}px)`;
  });

  overlay.addEventListener("transitionend", function onEnd() {
    overlay.removeEventListener("transitionend", onEnd);
    applyTheme(nextTheme);
    overlay.style.transition = "opacity 0.25s ease";
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 260);
  });
}

function buildThemeToggle() {
  if (document.getElementById("themeToggleBtn") || !profileToggle || !profileToggle.parentNode) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "themeToggleBtn";
  btn.className = "theme-toggle-btn";

  const icon = document.createElement("span");
  icon.className = "theme-toggle-icon";
  icon.style.cssText = "display:inline-flex;line-height:0;";

  const label = document.createElement("span");
  label.className = "theme-toggle-label";

  btn.appendChild(icon);
  btn.appendChild(label);
  btn.addEventListener("click", runThemeTransition);

  profileToggle.parentNode.insertBefore(btn, profileToggle);
  updateThemeToggleBtn(getTheme());
}

// Применяем тему сразу при загрузке скрипта (до первой отрисовки),
// чтобы не было "вспышки" неправильной темы.
applyTheme(getTheme());

// ===== Локализация (ru / en) =====

const I18N = {
  ru: {
    chatsToggle: "чаты ▾",
    panelTitleChats: "Чаты",
    newChatTitle: "новый чат",
    profileTitle: "профиль",
    login: "войти",
    guestUser: "Пользователь",
    guestBannerText: "гостевой режим: 1 чат, до 10 сообщений в день",
    guestBannerBtn: "войти / зарегистрироваться",
    bubbleColorLabel: "цвет твоих баблов",
    bubbleRadiusLabel: "угловатость баблов",
    changeEmailLabel: "изменить email",
    newEmailPlaceholder: "новый email",
    deleteAccount: "удалить аккаунт",
    logout: "выйти",
    loginCta: "войти / создать аккаунт",
    composerPlaceholder: "напиши что-нибудь…",
    greeting: "привет. пиши, о чём хотела поговорить — я тут.",
    statusOnline: "на связи",
    statusTyping: "печатает",
    tabLogin: "вход",
    tabRegister: "регистрация",
    fieldEmail: "email",
    fieldPassword: "пароль",
    loginSubmit: "войти",
    forgotLink: "забыли пароль?",
    registerPasswordPh: "пароль (от 6 символов)",
    registerSubmit: "зарегистрироваться",
    msgCopy: "копировать",
    msgReply: "ответить",
    quoteCancel: "отменить цитату",
    themeLight: "светлая тема",
    themeDark: "тёмная тема",
  },
  en: {
    chatsToggle: "chats ▾",
    panelTitleChats: "Chats",
    newChatTitle: "new chat",
    profileTitle: "profile",
    login: "log in",
    guestUser: "User",
    guestBannerText: "guest mode: 1 chat, up to 10 messages a day",
    guestBannerBtn: "log in / sign up",
    bubbleColorLabel: "your bubble color",
    bubbleRadiusLabel: "bubble roundness",
    changeEmailLabel: "change email",
    newEmailPlaceholder: "new email",
    deleteAccount: "delete account",
    logout: "log out",
    loginCta: "log in / sign up",
    composerPlaceholder: "type something…",
    greeting: "hi. write what's on your mind — I'm here.",
    statusOnline: "online",
    statusTyping: "typing",
    tabLogin: "log in",
    tabRegister: "sign up",
    fieldEmail: "email",
    fieldPassword: "password",
    loginSubmit: "log in",
    forgotLink: "forgot password?",
    registerPasswordPh: "password (min 6 characters)",
    registerSubmit: "sign up",
    msgCopy: "copy",
    msgReply: "reply",
    quoteCancel: "cancel quote",
    themeLight: "light theme",
    themeDark: "dark theme",
  },
};

function currentLang() {
  return localStorage.getItem("yari_lang") === "en" ? "en" : "ru";
}

function tr(key) {
  const lang = currentLang();
  return (I18N[lang] && I18N[lang][key]) || I18N.ru[key] || key;
}

// ===== Статус в шапке: "на связи" / "печатает" (с анимированными точками) =====

function setStatus(isTyping) {
  if (statusTextEl) statusTextEl.textContent = isTyping ? tr("statusTyping") : tr("statusOnline");
  if (statusDotsEl) statusDotsEl.style.display = isTyping ? "inline-flex" : "none";
}

function applyLanguage() {
  if (chatsToggle) chatsToggle.textContent = tr("chatsToggle");
  const panelTitleEl = document.querySelector(".panel-title");
  if (panelTitleEl) panelTitleEl.textContent = tr("panelTitleChats");
  if (newChatBtn) newChatBtn.title = tr("newChatTitle");
  if (profileToggle) profileToggle.title = tr("profileTitle");
  if (!isLoggedIn() && authToggle) authToggle.textContent = tr("login");

  const guestBannerTextEl = guestBanner ? guestBanner.querySelector("span") : null;
  if (guestBannerTextEl) guestBannerTextEl.textContent = tr("guestBannerText");
  if (guestBannerBtn) guestBannerBtn.textContent = tr("guestBannerBtn");

  const profileLabels = document.querySelectorAll(".profile-section-label");
  if (profileLabels[0]) profileLabels[0].textContent = tr("bubbleColorLabel");
  if (profileLabels[1]) profileLabels[1].textContent = tr("bubbleRadiusLabel");

  const changeEmailLabelEl = document.querySelector('label[for="newEmailInput"]');
  if (changeEmailLabelEl) changeEmailLabelEl.textContent = tr("changeEmailLabel");
  if (newEmailInput) newEmailInput.placeholder = tr("newEmailPlaceholder");

  const deleteLabelEl = deleteAccountBtn ? deleteAccountBtn.querySelector(".label-text") : null;
  if (deleteLabelEl) deleteLabelEl.textContent = tr("deleteAccount");
  const logoutLabelEl = profileLogoutBtn ? profileLogoutBtn.querySelector(".label-text") : null;
  if (logoutLabelEl) logoutLabelEl.textContent = tr("logout");
  const loginCtaLabelEl = profileLoginCta ? profileLoginCta.querySelector(".label-text") : null;
  if (loginCtaLabelEl) loginCtaLabelEl.textContent = tr("loginCta");

  if (input) input.placeholder = tr("composerPlaceholder");

  if (tabLogin) tabLogin.textContent = tr("tabLogin");
  if (tabRegister) tabRegister.textContent = tr("tabRegister");
  const loginEmailEl = document.getElementById("loginEmail");
  if (loginEmailEl) loginEmailEl.placeholder = tr("fieldEmail");
  const loginPasswordEl = document.getElementById("loginPassword");
  if (loginPasswordEl) loginPasswordEl.placeholder = tr("fieldPassword");
  const loginSubmitEl = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
  if (loginSubmitEl) loginSubmitEl.textContent = tr("loginSubmit");
  if (forgotPasswordLink) forgotPasswordLink.textContent = tr("forgotLink");
  const registerEmailEl = document.getElementById("registerEmail");
  if (registerEmailEl) registerEmailEl.placeholder = tr("fieldEmail");
  const registerPasswordEl = document.getElementById("registerPassword");
  if (registerPasswordEl) registerPasswordEl.placeholder = tr("registerPasswordPh");
  const registerSubmitEl = registerForm ? registerForm.querySelector('button[type="submit"]') : null;
  if (registerSubmitEl) registerSubmitEl.textContent = tr("registerSubmit");

  if (msgActionCopy) msgActionCopy.textContent = tr("msgCopy");
  if (msgActionReply) msgActionReply.textContent = tr("msgReply");
  if (quotePreviewClose) quotePreviewClose.setAttribute("aria-label", tr("quoteCancel"));
  if (!isLoggedIn() && profileEmailEl) profileEmailEl.textContent = tr("guestUser");

  updateThemeToggleBtn(getTheme());
  setStatus(false);
}

// ===== Supabase / Edge Function =====
const SUPABASE_URL = "https://prvwpqesbbmtzezxqcsl.supabase.co";
const API_BASE = `${SUPABASE_URL}/functions/v1/super-responder`;
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBydndwcWVzYmJtdHplenhxY3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxOTAwMjEsImV4cCI6MjEwMjc2NjAyMX0.cxcvjVPWrmpQolGvkrS8KaQYVKxfgjx9BA_brFXkhbs";

const AUTH_TOKEN_KEY = "yari_auth_token";
const AUTH_EMAIL_KEY = "yari_auth_email";
const REFRESH_TOKEN_KEY = "yari_auth_refresh_token";

function isLoggedIn() {
  return !!localStorage.getItem(AUTH_TOKEN_KEY);
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = { apikey: ANON_KEY, ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

const STORAGE_KEY = "yari_chats_v1";
const PROFILE_KEY = "yari_profile_v1";
const META_KEY = "yari_chat_meta_v1";
const GUEST_LIMIT_KEY = "yari_guest_limit_v1";
const USER_LIMIT_KEY = "yari_user_limit_v1";
const GUEST_DAILY_LIMIT = 10;
const USER_DAILY_LIMIT = 15;
const MIN_GAP_DAYS = 2;
const MAX_GAP_DAYS = 4;
const DEFAULT_PROFILE = { color: "#4fc3f7", radius: 14 };

function randomGapMs() {
  const days = MIN_GAP_DAYS + Math.random() * (MAX_GAP_DAYS - MIN_GAP_DAYS);
  return days * 24 * 60 * 60 * 1000;
}

// ===== Дневной лимит сообщений (гость: GUEST_LIMIT_KEY / 10,
// зарегистрированный: USER_LIMIT_KEY / 15). Это client-side заглушка —
// хранится в localStorage, так что обходится очисткой хранилища. Настоящая
// защита требует счётчика на бэкенде (в super-responder), это отдельная
// задача при необходимости. =====

function getDailyUsage(key) {
  const today = new Date().toISOString().slice(0, 10);
  let data;
  try {
    data = JSON.parse(localStorage.getItem(key)) || { date: today, count: 0 };
  } catch (e) {
    data = { date: today, count: 0 };
  }
  if (data.date !== today) data = { date: today, count: 0 };
  return data;
}

function incrementDailyUsage(key) {
  const data = getDailyUsage(key);
  data.count++;
  localStorage.setItem(key, JSON.stringify(data));
  return data.count;
}

// ===== Локальное хранилище чатов (гостевой режим) =====

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { chats: [], activeChatId: null };
    return JSON.parse(raw);
  } catch (e) {
    return { chats: [], activeChatId: null };
  }
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function newChat() {
  return {
    id: "chat_" + Date.now(),
    title: "новый чат",
    messages: [],
    lastVisit: Date.now(),
    nextProactiveAt: Date.now() + randomGapMs(),
    proactiveOff: false,
  };
}

function loadGuestChat() {
  store = loadStore();
  if (store.chats.length === 0) {
    const c = newChat();
    store.chats.push(c);
    store.activeChatId = c.id;
    saveStore(store);
  }
  if (!store.activeChatId || !store.chats.find((c) => c.id === store.activeChatId)) {
    store.activeChatId = store.chats[0].id;
  }
}

// ===== Метаданные чатов для авторизованных юзеров (lastVisit/proactive — только локально) =====

function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveMeta(meta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function getChatMeta(id) {
  const meta = loadMeta();
  if (!meta[id]) {
    meta[id] = { lastVisit: Date.now(), nextProactiveAt: Date.now() + randomGapMs(), proactiveOff: false };
    saveMeta(meta);
  }
  return meta[id];
}

function updateChatMeta(id, updates) {
  const meta = loadMeta();
  meta[id] = { ...(meta[id] || {}), ...updates };
  saveMeta(meta);
}

function normalizeServerChat(row) {
  const meta = getChatMeta(row.id);
  return {
    id: row.id,
    title: row.title,
    messages: row.messages_json || [],
    lastVisit: meta.lastVisit,
    nextProactiveAt: meta.nextProactiveAt,
    proactiveOff: meta.proactiveOff,
  };
}

async function persistChatToServer(c, titleChanged) {
  const body = { messages_json: c.messages };
  if (titleChanged) body.title = c.title;
  await fetch(`${API_BASE}/chats/${c.id}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
}

async function loadServerChats() {
  const res = await fetch(`${API_BASE}/chats`, { headers: authHeaders() });
  if (res.status === 401) throw new Error("unauthorized");
  const data = await res.json();
  let chats = (data.chats || []).map(normalizeServerChat);

  if (chats.length === 0) {
    const createRes = await fetch(`${API_BASE}/chats`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ title: "новый чат", messages_json: [] }),
    });
    const createData = await createRes.json();
    chats = [normalizeServerChat(createData.chat)];
  }

  store = { chats, activeChatId: chats[0].id };
}

let store = { chats: [], activeChatId: null };

function getActiveChat() {
  return store.chats.find((c) => c.id === store.activeChatId);
}

function renderChatsPanel() {
  // Рендерим список в #chatsList, а не в сам #chatsPanel — так статичный
  // заголовок "чаты" (лежит в index.html рядом с #chatsList) не затирается
  // при каждой перерисовке. Если по какой-то причине #chatsList не найден
  // в разметке — откатываемся на chatsPanel, чтобы список не пропал.
  const target = chatsListEl || chatsPanel;
  target.innerHTML = "";
  store.chats
    .slice()
    .sort((a, b) => b.lastVisit - a.lastVisit)
    .forEach((c) => {
      const item = document.createElement("div");
      item.className = "chat-item" + (c.id === store.activeChatId ? " active" : "");

      const label = document.createElement("span");
      label.textContent = c.title;
      label.addEventListener("click", () => {
        switchChat(c.id);
      });

      item.appendChild(label);

      if (isLoggedIn()) {
        const del = document.createElement("span");
        del.className = "chat-item-delete";
        del.textContent = "удалить";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteChat(c.id);
        });
        item.appendChild(del);
      }

      target.appendChild(item);
    });
}

function switchChat(id) {
  store.activeChatId = id;
  const c = getActiveChat();
  c.lastVisit = Date.now();
  if (isLoggedIn()) {
    updateChatMeta(id, { lastVisit: c.lastVisit });
  } else {
    saveStore(store);
  }
  renderChatsPanel();
  renderMessages();
  checkProactive();
}

async function deleteChat(id) {
  if (!isLoggedIn()) return; // гость не может удальнить динамичнеск чат

  await fetch(`${API_BASE}/chats/${id}`, { method: "DELETE", headers: authHeaders() });
  store.chats = store.chats.filter((c) => c.id !== id);

  if (store.chats.length === 0) {
    const createRes = await fetch(`${API_BASE}/chats`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ title: "новый чат", messages_json: [] }),
    });
    const createData = await createRes.json();
    store.chats.push(normalizeServerChat(createData.chat));
  }

  if (store.activeChatId === id) {
    store.activeChatId = store.chats[0].id;
  }
  renderChatsPanel();
  renderMessages();
}

chatsToggle.addEventListener("click", () => {
  chatsPanel.classList.toggle("open");
  profilePanel.classList.remove("open");
  authPanel.classList.remove("open");
});

newChatBtn.addEventListener("click", async () => {
  if (!isLoggedIn()) {
    alert("В гостевом режиме доступен только один чат. Зарегистрируйся, чтобы создавать новые.");
    authPanel.classList.add("open");
    chatsPanel.classList.remove("open");
    return;
  }
  const res = await fetch(`${API_BASE}/chats`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ title: "новый чат", messages_json: [] }),
  });
  const data = await res.json();
  if (data.chat) {
    const c = normalizeServerChat(data.chat);
    store.chats.push(c);
    switchChat(c.id);
  }
});

// ===== Профиль: цвет и угловатость облачка пользователя =====

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_PROFILE };
  }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function applyProfile(profile) {
  document.documentElement.style.setProperty("--user-bubble-color", profile.color);
  document.documentElement.style.setProperty("--bubble-radius", profile.radius + "px");

  if (swatchesEl) {
    swatchesEl.querySelectorAll(".swatch").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.color.toLowerCase() === profile.color.toLowerCase());
    });
  }
  if (radiusSlider) radiusSlider.value = profile.radius;
}

let profile = loadProfile();
applyProfile(profile);

const profileIdentityEl = document.getElementById("profileIdentity");
const profileEmailEl = document.getElementById("profileEmail");
const profileEditBtn = document.getElementById("profileEditBtn");
const profileEditMenu = document.getElementById("profileEditMenu");
const newEmailInput = document.getElementById("newEmailInput");
const saveEmailBtn = document.getElementById("saveEmailBtn");
const emailEditMsg = document.getElementById("emailEditMsg");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const profileLogoutBtn = document.getElementById("profileLogoutBtn");
const profileLoginCta = document.getElementById("profileLoginCta");

function renderProfileIdentity() {
  if (!profileIdentityEl) return;

  // Identity-блок (аватар + подпись) теперь виден и гостю: залогиненному
  // показываем email, гостю — метку "пользователь". Карандашик (смена
  // email / удаление аккаунта) имеет смысл только для аккаунта, поэтому
  // доступен исключительно залогиненным.
  profileIdentityEl.style.display = "flex";
  if (isLoggedIn()) {
    if (profileEmailEl) profileEmailEl.textContent = localStorage.getItem(AUTH_EMAIL_KEY) || "";
    if (profileEditBtn) profileEditBtn.style.display = "flex";
    refreshMyUsage();
  } else {
    if (profileEmailEl) profileEmailEl.textContent = tr("guestUser");
    if (profileEditBtn) profileEditBtn.style.display = "none";
    if (profileEditMenu) profileEditMenu.classList.remove("open");
    removeUsageBlock();
  }

  if (profileLogoutBtn) profileLogoutBtn.style.display = isLoggedIn() ? "inline-flex" : "none";
  if (profileLoginCta) profileLoginCta.style.display = isLoggedIn() ? "none" : "inline-flex";
}

if (profileToggle) {
  profileToggle.addEventListener("click", () => {
    profilePanel.classList.toggle("open");
    chatsPanel.classList.remove("open");
    authPanel.classList.remove("open");
  });
}

if (swatchesEl) {
  swatchesEl.querySelectorAll(".swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      profile.color = btn.dataset.color;
      saveProfile(profile);
      applyProfile(profile);
    });
  });
}

if (radiusSlider) {
  radiusSlider.addEventListener("input", () => {
    profile.radius = Number(radiusSlider.value);
    saveProfile(profile);
    applyProfile(profile);
  });
}

// ===== Карандашик в профиле: смена email / удаление аккаунта =====

if (profileEditBtn) {
  profileEditBtn.addEventListener("click", () => {
    if (!profileEditMenu) return;
    profileEditMenu.classList.toggle("open");
    if (emailEditMsg) emailEditMsg.textContent = "";
  });
}

if (saveEmailBtn) {
  saveEmailBtn.addEventListener("click", async () => {
    const newEmail = (newEmailInput.value || "").trim();
    if (!newEmail) return;
    if (emailEditMsg) emailEditMsg.textContent = "сохраняю…";
    try {
      const res = await fetch(`${API_BASE}/account/update-email`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email: newEmail }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        if (emailEditMsg) emailEditMsg.textContent = data.error || "не удалось изменить email";
        return;
      }
      localStorage.setItem(AUTH_EMAIL_KEY, newEmail);
      if (profileEmailEl) profileEmailEl.textContent = newEmail;
      newEmailInput.value = "";
      if (emailEditMsg) emailEditMsg.textContent = "email обновлён";
    } catch (err) {
      if (emailEditMsg) emailEditMsg.textContent = "проблема с соединением";
    }
  });
}

if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener("click", async () => {
    if (!confirm("Точно удалить аккаунт? Это необратимо, все чаты будут потеряны.")) return;
    try {
      const res = await fetch(`${API_BASE}/account/delete`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        alert(data.error || "не удалось удалить аккаунт");
        return;
      }
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_EMAIL_KEY);
      location.reload();
    } catch (err) {
      alert("проблема с соединением");
    }
  });
}

if (profileLogoutBtn) {
  profileLogoutBtn.addEventListener("click", handleLogout);
}

if (profileLoginCta) {
  profileLoginCta.addEventListener("click", () => {
    authPanel.classList.add("open");
    chatsPanel.classList.remove("open");
    profilePanel.classList.remove("open");
  });
}

// ===== Авторизация =====

function renderAuthUI() {
  if (isLoggedIn()) {
    // Кнопка "выйти" убрана из шапки — теперь выход только через самый
    // низ панели профиля (profileLogoutBtn), см. renderProfileIdentity().
    authToggle.style.display = "none";
    if (guestBanner) guestBanner.style.display = "none";
  } else {
    authToggle.style.display = "";
    authToggle.textContent = "войти";
    authToggle.onclick = () => {
      authPanel.classList.toggle("open");
      chatsPanel.classList.remove("open");
      profilePanel.classList.remove("open");
    };
    if (guestBanner) guestBanner.style.display = "flex";
  }
}

function handleLogout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_EMAIL_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  location.reload();
}

// Access-токен Supabase живёт около часа. Вместо разлогина при его
// истечении — пробуем обновить сессию через refresh-токен напрямую
// через Supabase Auth REST API (публичная операция, анонимного ключа
// достаточно). Если и это не сработало — тогда уже разлогиниваем.
async function refreshAuthToken() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) return false;
    localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
    if (data.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    return true;
  } catch (err) {
    return false;
  }
}

async function importGuestChatsIfAny() {
  try {
    const guestRaw = localStorage.getItem(STORAGE_KEY);
    if (!guestRaw) return;
    const guestStore = JSON.parse(guestRaw);
    const chatsWithMessages = (guestStore.chats || []).filter((c) => c.messages && c.messages.length > 0);
    if (chatsWithMessages.length > 0) {
      await fetch(`${API_BASE}/chats/import`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          chats: chatsWithMessages.map((c) => ({ title: c.title, messages: c.messages })),
        }),
      });
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // перенос не удался — не блокируем вход, старые данные останутся в localStorage
  }
}

function showAuthError(msg) {
  if (authError) authError.textContent = msg || "";
}

// Скрывает все под-формы блока входа/регистрации/восстановления —
// используется при переключении между вкладками и шагами, чтобы не
// показывались сразу два несвязанных шага.
function hideAllAuthSubforms() {
  if (loginForm) loginForm.style.display = "none";
  if (registerForm) registerForm.style.display = "none";
  if (forgotForm) forgotForm.style.display = "none";
  if (resetForm) resetForm.style.display = "none";
  if (codeForm) codeForm.style.display = "none";
}

if (tabLogin && tabRegister) {
  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    hideAllAuthSubforms();
    loginForm.style.display = "flex";
    showAuthError("");
  });
  tabRegister.addEventListener("click", () => {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    hideAllAuthSubforms();
    registerForm.style.display = "flex";
    showAuthError("");
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAuthError("");
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showAuthError(data.error || "Не удалось войти");
        return;
      }
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_EMAIL_KEY, data.email);
      if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      await importGuestChatsIfAny();
      location.reload();
    } catch (err) {
      showAuthError("Проблема с соединением, попробуй ещё раз");
    }
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAuthError("");
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showAuthError(data.error || "Не удалось зарегистрироваться");
        return;
      }
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_EMAIL_KEY, data.email);
      if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      await importGuestChatsIfAny();
      location.reload();
    } catch (err) {
      showAuthError("Проблема с соединением, попробуй ещё раз");
    }
  });
}

if (guestBannerBtn) {
  guestBannerBtn.addEventListener("click", () => {
    authPanel.classList.add("open");
    chatsPanel.classList.remove("open");
    profilePanel.classList.remove("open");
  });
}

// ===== Забыл пароль / сброс пароля =====
// Юзер вводит email → бэкенд просит Supabase отправить письмо, в котором
// теперь есть 6-значный код ({{ .Token }} в шаблоне письма, см. Dashboard →
// Authentication → Emails → Reset password). Юзер вводит код + новый пароль
// прямо в приложении (codeForm) — это не требует перехода по ссылке на
// supabase.co, который может быть недоступен из РФ. Код проверяется прямым
// запросом к Supabase Auth REST API (/auth/v1/verify) через анонимный ключ —
// это публичная, безопасная операция, служебный ключ для неё не нужен.
// Ссылка (resetForm, checkRecoveryHash) оставлена как запасной вариант —
// если она у кого-то откроется, тоже сработает.

let forgotEmail = "";

if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", (e) => {
    e.preventDefault();
    hideAllAuthSubforms();
    if (forgotForm) forgotForm.style.display = "flex";
    showAuthError("");
  });
}

if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAuthError("");
    const email = document.getElementById("forgotEmail").value.trim();
    forgotEmail = email;
    try {
      await fetch(`${API_BASE}/forgot-password`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email }),
      });
      hideAllAuthSubforms();
      if (codeForm) {
        codeForm.style.display = "flex";
        if (codeInput) codeInput.focus();
      }
      showAuthError("Если такой email зарегистрирован — письмо с кодом отправлено. Введи код ниже (проверь и папку спам).");
    } catch (err) {
      showAuthError("Проблема с соединением, попробуй ещё раз");
    }
  });
}

if (codeForm) {
  codeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAuthError("");
    const code = (codeInput.value || "").trim();
    const password = codeNewPassword.value;

    if (!forgotEmail) {
      showAuthError("Email потерян — вернись на шаг назад и введи почту заново.");
      return;
    }
    if (!code || !password) return;

    try {
      const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: "POST",
        headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "recovery", email: forgotEmail, token: code }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.access_token) {
        showAuthError(verifyData.error_description || verifyData.msg || "Неверный или устаревший код, проверь и попробуй снова");
        return;
      }

      const res = await fetch(`${API_BASE}/reset-password`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ access_token: verifyData.access_token, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showAuthError(data.error || "Не удалось обновить пароль");
        return;
      }

      alert("Пароль обновлён. Теперь войди с новым паролем.");
      codeForm.reset();
      forgotEmail = "";
      hideAllAuthSubforms();
      loginForm.style.display = "flex";
      if (tabLogin && tabRegister) {
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
      }
    } catch (err) {
      showAuthError("Проблема с соединением, попробуй ещё раз");
    }
  });
}

// После перехода по ссылке из письма Supabase добавляет в адрес
// #access_token=...&type=recovery&... — ловим это при загрузке страницы.
// Запасной путь на случай, если ссылка у кого-то всё же откроется.
function checkRecoveryHash() {
  if (location.hash.includes("type=recovery")) {
    const params = new URLSearchParams(location.hash.slice(1));
    const token = params.get("access_token");
    if (token) {
      window.__recoveryToken = token;
      authPanel.classList.add("open");
      chatsPanel.classList.remove("open");
      profilePanel.classList.remove("open");
      hideAllAuthSubforms();
      if (resetForm) resetForm.style.display = "flex";
    }
  }
}

if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAuthError("");
    const password = document.getElementById("resetPassword").value;
    const token = window.__recoveryToken;
    if (!token) {
      showAuthError("Ссылка недействительна, запроси сброс заново.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ access_token: token, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showAuthError(data.error || "Не удалось обновить пароль");
        return;
      }
      history.replaceState(null, "", location.pathname);
      alert("Пароль обновлён. Теперь войди с новым паролем.");
      resetForm.style.display = "none";
      loginForm.style.display = "flex";
      if (tabLogin && tabRegister) {
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
      }
    } catch (err) {
      showAuthError("Проблема с соединением, попробуй ещё раз");
    }
  });
}

// ===== Разблокировка роли разработчика =====

// Общий fetch с таймаутом — если сеть подвиснет без ответа, не ждём вечно,
// а через FETCH_TIMEOUT_MS считаем, что это не код, и идём дальше.
const FETCH_TIMEOUT_MS = 4000;

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function tryUnlock(text) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/unlock`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ code: text.trim() }),
    });
    const data = await res.json();
    if (data.ok) {
      localStorage.setItem("yari_role", data.role);
      localStorage.setItem("yari_token", data.token);
      renderRolePanel();
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

// Активация кода доступа (даёт повышенный/безлимитный лимит токенов).
// Требует аккаунт — лимит привязан к user_id.
async function tryRedeemCode(text) {
  if (!isLoggedIn()) return false;
  try {
    const res = await fetchWithTimeout(`${API_BASE}/redeem-code`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ code: text.trim() }),
    });
    const data = await res.json();
    if (data.ok) {
      alert("код активирован");
      refreshMyUsage();
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

// ===== Панель разработчика: два постоянных блока по бокам экрана =====
// Видны сразу после активации dev-кода, без кнопок и попапов.
// Слева — коды доступа, справа — статистика/модель/очередь правок.

function renderRolePanel() {
  const role = localStorage.getItem("yari_role");
  if (role !== "dev") return;
  renderDevSidePanels();
}

function ensureDevPanelContainers() {
  let left = document.getElementById("devPanelLeft");
  let right = document.getElementById("devPanelRight");
  const baseStyle =
    "position:fixed;top:64px;max-height:70vh;width:190px;overflow-y:auto;" +
    "background:var(--devpanel-bg);border:1px solid var(--panther-line);border-radius:14px;" +
    "padding:12px;font-size:12px;line-height:1.5;color:var(--text);z-index:1;box-sizing:border-box;";

  if (!left) {
    left = document.createElement("div");
    left.id = "devPanelLeft";
    left.style.cssText = baseStyle + "left:12px;";
    document.body.appendChild(left);
  }
  if (!right) {
    right = document.createElement("div");
    right.id = "devPanelRight";
    right.style.cssText = baseStyle + "right:12px;";
    document.body.appendChild(right);
  }
  return { left, right };
}

// Строка "потрачено N / M токенов" под email в профиле — постоянный блок,
// всегда занимает своё место (loading → данные, либо явная ошибка вместо
// того, чтобы молча остаться пустым местом).
const ASSUMED_TOKENS_PER_MESSAGE = 100;

function ensureUsageBlock() {
  let usageEl = document.getElementById("usageInfo");
  if (!usageEl && profileEmailEl && profileEmailEl.parentElement) {
    usageEl = document.createElement("div");
    usageEl.id = "usageInfo";
    usageEl.style.cssText = "margin-top:8px;width:100%;";
    profileEmailEl.insertAdjacentElement("afterend", usageEl);
  }
  return usageEl;
}

function removeUsageBlock() {
  const usageEl = document.getElementById("usageInfo");
  if (usageEl) usageEl.remove();
}

function renderUsagePlaceholder(container, text) {
  container.innerHTML = "";
  const bar = document.createElement("div");
  bar.style.cssText =
    "height:22px;border-radius:11px;display:flex;align-items:center;justify-content:center;" +
    "font-size:11px;color:var(--text-dim);border:1px solid var(--panther-line);background:var(--panther-soft);";
  bar.textContent = text;
  container.appendChild(bar);
}

async function refreshMyUsage() {
  if (!isLoggedIn()) return;
  const usageEl = ensureUsageBlock();
  if (!usageEl) return;

  renderUsagePlaceholder(usageEl, "загружаю лимит…");

  try {
    const res = await fetch(`${API_BASE}/my-usage`, { headers: authHeaders() });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) {
      renderUsagePlaceholder(usageEl, "лимит: не удалось загрузить");
      return;
    }
    renderUsageGauge(usageEl, data);
  } catch (err) {
    renderUsagePlaceholder(usageEl, "лимит: нет соединения");
  }
}

function renderUsageGauge(container, data) {
  container.innerHTML = "";

  if (data.tier === "unlimited") {
    const bar = document.createElement("div");
    bar.style.cssText =
      "height:22px;border-radius:11px;display:flex;align-items:center;justify-content:center;" +
      "font-size:11px;color:rgba(244,238,242,0.85);" +
      "background:linear-gradient(90deg, rgba(185,232,166,0.5), rgba(185,232,166,0.2), rgba(185,232,166,0.5));";
    bar.textContent = "безлимит";
    container.appendChild(bar);
    return;
  }

  const budget = data.tier === "total" ? data.totalBudget : data.dailyBudget;
  const used = data.tier === "total" ? data.tokensUsedTotal : data.tokensUsedToday;
  const remaining = Math.max(0, budget - used);
  const remainingPct = budget > 0 ? (remaining / budget) * 100 : 0;
  const usedPct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 100;
  const estLeft = Math.max(0, Math.round(remaining / ASSUMED_TOKENS_PER_MESSAGE));

  let colorRgb = "185,232,166"; // зелёный — всё в порядке
  if (remainingPct < 7) {
    colorRgb = "232,138,154"; // красный — меньше 7% лимита осталось
  } else if (remainingPct < 15) {
    colorRgb = "232,214,138"; // жёлтый — меньше 15% лимита осталось
  }

  const track = document.createElement("div");
  track.style.cssText =
    "position:relative;height:22px;border-radius:11px;overflow:hidden;background:rgba(0,0,0,0.25);";

  const fill = document.createElement("div");
  fill.style.cssText =
    `width:${usedPct}%;height:100%;` +
    `background:linear-gradient(90deg, rgba(${colorRgb},0.55), rgba(${colorRgb},0.22), rgba(${colorRgb},0.55));`;

  const label = document.createElement("div");
  label.style.cssText =
    "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
    "font-size:11px;color:rgba(244,238,242,0.8);white-space:nowrap;pointer-events:none;";
  label.textContent = `${used} / ${budget} токенов (≈${estLeft} сообщ.)`;

  track.appendChild(fill);
  track.appendChild(label);
  container.appendChild(track);
}

function devInputStyle() {
  return "width:100%;padding:6px;margin-bottom:6px;border-radius:6px;border:1px solid var(--panther-line);background:var(--panther);color:var(--text);box-sizing:border-box;font-size:12px;";
}

function devLabel(text) {
  const el = document.createElement("div");
  el.style.cssText = "font-weight:600;font-size:13px;margin-bottom:8px;color:var(--text);";
  el.textContent = text;
  return el;
}

// ----- Левый блок: коды доступа -----

function renderCodesBlock(container) {
  container.innerHTML = "";
  const token = localStorage.getItem("yari_token");

  container.appendChild(devLabel("коды доступа"));

  const codeInput2 = document.createElement("input");
  codeInput2.placeholder = "текст кода";
  codeInput2.style.cssText = devInputStyle();

  const kindSelect = document.createElement("select");
  kindSelect.style.cssText = devInputStyle();
  [
    ["daily", "лимит в день"],
    ["total", "разово (весь бюджет)"],
    ["unlimited", "безлимит"],
  ].forEach(([v, l]) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = l;
    kindSelect.appendChild(opt);
  });

  const budgetInput = document.createElement("input");
  budgetInput.type = "number";
  budgetInput.placeholder = "лимит токенов";
  budgetInput.style.cssText = devInputStyle();

  kindSelect.addEventListener("change", () => {
    budgetInput.style.display = kindSelect.value === "unlimited" ? "none" : "block";
  });

  const labelInput = document.createElement("input");
  labelInput.placeholder = "заметка (для кого)";
  labelInput.style.cssText = devInputStyle();

  const createBtn = document.createElement("button");
  createBtn.textContent = "создать код";
  createBtn.style.cssText =
    "width:100%;padding:8px;border-radius:8px;border:none;background:linear-gradient(135deg,var(--peach),var(--lavender));color:var(--on-accent);font-weight:600;cursor:pointer;margin-bottom:12px;font-size:12px;";

  const listBox = document.createElement("div");

  async function loadCodes() {
    listBox.textContent = "загружаю…";
    try {
      const res = await fetch(`${API_BASE}/dev/codes`, {
        headers: authHeaders({ "x-yari-token": token }),
      });
      const data = await res.json();
      if (data.error || !data.codes) {
        listBox.textContent = "нет доступа";
        return;
      }
      if (!data.codes.length) {
        listBox.textContent = "кодов пока нет";
        return;
      }
      listBox.innerHTML = "";
      data.codes.forEach((c) => {
        const row = document.createElement("div");
        row.style.cssText = "padding:6px 0;border-bottom:1px solid var(--panther-line);";

        const kindLabel = c.kind === "daily" ? "в день" : c.kind === "total" ? "разово" : "безлимит";
        const info = document.createElement("div");
        info.textContent =
          `${c.code} — ${kindLabel}` +
          (c.token_budget ? ` (${c.token_budget})` : "") +
          (c.label ? ` · ${c.label}` : "") +
          (c.active ? "" : " · выкл");
        info.style.marginBottom = "4px";

        const toggleBtn = document.createElement("button");
        toggleBtn.textContent = c.active ? "выключить" : "включить";
        toggleBtn.style.cssText =
          "font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid var(--panther-line);background:transparent;color:var(--text);cursor:pointer;";
        toggleBtn.addEventListener("click", async () => {
          await fetch(`${API_BASE}/dev/toggle-code`, {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json", "x-yari-token": token }),
            body: JSON.stringify({ code: c.code, active: !c.active }),
          });
          loadCodes();
        });

        row.appendChild(info);
        row.appendChild(toggleBtn);
        listBox.appendChild(row);
      });
    } catch (err) {
      listBox.textContent = "не удалось загрузить";
    }
  }

  createBtn.addEventListener("click", async () => {
    const code = codeInput2.value.trim();
    if (!code) return;
    const kind = kindSelect.value;
    const tokenBudget = kind === "unlimited" ? null : Number(budgetInput.value) || null;
    if (kind !== "unlimited" && !tokenBudget) {
      alert("укажи лимит токенов");
      return;
    }
    const res = await fetch(`${API_BASE}/dev/create-code`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json", "x-yari-token": token }),
      body: JSON.stringify({ code, kind, tokenBudget, label: labelInput.value.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      alert(data.error || "не удалось создать код");
      return;
    }
    codeInput2.value = "";
    labelInput.value = "";
    loadCodes();
  });

  container.appendChild(codeInput2);
  container.appendChild(kindSelect);
  container.appendChild(budgetInput);
  container.appendChild(labelInput);
  container.appendChild(createBtn);
  container.appendChild(listBox);

  loadCodes();
}

// ----- Правый блок: статистика по токенам + модель + очередь правок -----

function renderStatsBlock(container) {
  container.innerHTML = "";
  const token = localStorage.getItem("yari_token");

  container.appendChild(devLabel("статистика"));

  const rangeRow = document.createElement("div");
  rangeRow.style.cssText = "display:flex;gap:6px;margin-bottom:10px;";

  const today = new Date().toISOString().slice(0, 10);
  const fromInput = document.createElement("input");
  fromInput.type = "date";
  fromInput.value = today;
  fromInput.style.cssText = devInputStyle() + "flex:1;min-width:0;padding:4px;";

  const toInput = document.createElement("input");
  toInput.type = "date";
  toInput.value = today;
  toInput.style.cssText = devInputStyle() + "flex:1;min-width:0;padding:4px;";

  rangeRow.appendChild(fromInput);
  rangeRow.appendChild(toInput);

  const gaugeWrap = document.createElement("div");
  gaugeWrap.style.cssText = "margin-bottom:4px;";
  const gaugeBar = document.createElement("div");
  gaugeBar.style.cssText =
    "height:8px;border-radius:4px;background:var(--panther-line);overflow:hidden;margin-bottom:4px;";
  const gaugeFill = document.createElement("div");
  gaugeFill.style.cssText =
    "height:100%;background:linear-gradient(90deg,var(--peach),var(--lavender));width:0%;transition:width 0.3s;";
  gaugeBar.appendChild(gaugeFill);
  gaugeWrap.appendChild(gaugeBar);

  const statsText = document.createElement("div");
  statsText.style.cssText = "white-space:pre-wrap;";
  statsText.textContent = "загружаю…";

  async function loadStats() {
    statsText.textContent = "загружаю…";
    try {
      const res = await fetch(`${API_BASE}/dev/stats?from=${fromInput.value}&to=${toInput.value}`, {
        headers: authHeaders({ "x-yari-token": token }),
      });
      const data = await res.json();
      if (data.error) {
        statsText.textContent = "нет доступа";
        return;
      }
      const totalMessages = data.guestMessages + data.userMessages;
      const avgTokens = totalMessages > 0 ? data.tokensUsed / totalMessages : 0;
      const remaining = Math.max(0, data.dailyBudget - data.tokensUsed);
      const estLeft = avgTokens > 0 ? Math.round(remaining / avgTokens) : "—";
      const pct = Math.min(100, Math.round((data.tokensUsed / data.dailyBudget) * 100));
      gaugeFill.style.width = pct + "%";

      statsText.textContent =
        `${data.from} — ${data.to}\n\n` +
        `гостей: ${data.guestMessages}\n` +
        `юзеров: ${data.userMessages}\n` +
        `регистраций: ${data.registrations}\n\n` +
        `токены: ${data.tokensUsed} / ${data.dailyBudget}\n` +
        `≈ хватит сообщений: ${estLeft}`;
    } catch (err) {
      statsText.textContent = "не удалось загрузить";
    }
  }

  fromInput.addEventListener("change", loadStats);
  toInput.addEventListener("change", loadStats);

  container.appendChild(rangeRow);
  container.appendChild(gaugeWrap);
  container.appendChild(statsText);

  loadStats();
}

function renderDevSidePanels() {
  const { left, right } = ensureDevPanelContainers();
  renderCodesBlock(left);
  renderStatsBlock(right);
  appendProblemsBlock(right);
}

// Технические жалобы (дизлайк с причиной "техническая") — отдельный блок,
// а не мелкая кнопка, чтобы дев видел их сразу.
function appendProblemsBlock(container) {
  const token = localStorage.getItem("yari_token");

  const wrap = document.createElement("div");
  wrap.style.cssText = "margin-top:16px;padding-top:12px;border-top:1px solid var(--panther-line);";
  wrap.appendChild(devLabel("проблемы"));

  const listBox = document.createElement("div");
  listBox.textContent = "загружаю…";
  wrap.appendChild(listBox);
  container.appendChild(wrap);

  async function loadProblems() {
    listBox.textContent = "загружаю…";
    try {
      const res = await fetch(`${API_BASE}/dev/problems`, {
        headers: authHeaders({ "x-yari-token": token }),
      });
      const data = await res.json();
      if (data.error) {
        listBox.textContent = "нет доступа";
        return;
      }
      if (!data.problems.length) {
        listBox.textContent = "пусто";
        return;
      }
      listBox.innerHTML = "";
      data.problems.forEach((p) => {
        const row = document.createElement("div");
        row.style.cssText = "padding:6px 0;border-bottom:1px solid var(--panther-line);";

        const text = document.createElement("div");
        text.style.marginBottom = "4px";
        text.textContent = p.correction || "(без описания)";
        row.appendChild(text);

        const dismissBtn = document.createElement("button");
        dismissBtn.textContent = "решено";
        dismissBtn.style.cssText =
          "font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid var(--panther-line);background:transparent;color:var(--text);cursor:pointer;";
        dismissBtn.addEventListener("click", async () => {
          await fetch(`${API_BASE}/dev/dismiss-problem`, {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json", "x-yari-token": token }),
            body: JSON.stringify({ id: p.id }),
          });
          loadProblems();
        });
        row.appendChild(dismissBtn);
        listBox.appendChild(row);
      });
    } catch (err) {
      listBox.textContent = "не удалось загрузить";
    }
  }

  loadProblems();
}

// Фидбек по ответу Яри — открыт всем пользователям, не только dev.
async function sendFeedback(originalReply, reaction, category, correction) {
  try {
    await fetch(`${API_BASE}/feedback`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ originalReply, reaction, category, correction }),
    });
  } catch (err) {
    // тихо промолчим
  }
}

// Компактное окошко выбора причины дизлайка — техническая или по стилю/сути ответа.
function openDislikeReasonPopup(onSubmit) {
  const existing = document.getElementById("dislikeReasonOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "dislikeReasonOverlay";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;";

  const card = document.createElement("div");
  card.style.cssText =
    "background:var(--panther-soft);border:1px solid var(--panther-line);border-radius:14px;padding:18px;max-width:280px;width:100%;color:var(--text);font-family:inherit;box-sizing:border-box;";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:600;font-size:14px;margin-bottom:10px;";
  title.textContent = "что не так?";

  let selectedCategory = null;

  const catRow = document.createElement("div");
  catRow.style.cssText = "display:flex;gap:6px;margin-bottom:10px;";

  const techBtn = document.createElement("button");
  techBtn.textContent = "техническая";
  const aiBtn = document.createElement("button");
  aiBtn.textContent = "реакция ии";

  [techBtn, aiBtn].forEach((btn) => {
    btn.style.cssText =
      "flex:1;padding:8px;border-radius:8px;border:1px solid var(--panther-line);background:transparent;color:var(--text);cursor:pointer;font-size:12px;";
  });

  function selectCategory(cat, btn) {
    selectedCategory = cat;
    [techBtn, aiBtn].forEach((b) => {
      b.style.background = "transparent";
      b.style.color = "var(--text)";
    });
    btn.style.background = "linear-gradient(135deg,var(--peach),var(--lavender))";
    btn.style.color = "var(--on-accent)";
  }
  techBtn.addEventListener("click", () => selectCategory("technical", techBtn));
  aiBtn.addEventListener("click", () => selectCategory("ai", aiBtn));

  catRow.appendChild(techBtn);
  catRow.appendChild(aiBtn);

  const detailInput = document.createElement("textarea");
  detailInput.placeholder = "коротко опиши (необязательно)";
  detailInput.rows = 3;
  detailInput.style.cssText =
    "width:100%;padding:8px;margin-bottom:12px;border-radius:8px;border:1px solid var(--panther-line);background:var(--panther);color:var(--text);box-sizing:border-box;font-family:inherit;resize:none;";

  const submitBtn = document.createElement("button");
  submitBtn.textContent = "отправить";
  submitBtn.style.cssText =
    "width:100%;padding:10px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--peach),var(--lavender));color:var(--on-accent);font-weight:600;cursor:pointer;margin-bottom:8px;";
  submitBtn.addEventListener("click", () => {
    onSubmit(selectedCategory, detailInput.value.trim());
    overlay.remove();
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "отмена";
  cancelBtn.style.cssText =
    "width:100%;padding:8px;border-radius:10px;border:1px solid var(--panther-line);background:transparent;color:var(--text);cursor:pointer;";
  cancelBtn.addEventListener("click", () => overlay.remove());

  card.appendChild(title);
  card.appendChild(catRow);
  card.appendChild(detailInput);
  card.appendChild(submitBtn);
  card.appendChild(cancelBtn);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function addMessageToDOM(role, text, opts = {}) {
  const wrap = document.createElement("div");
  wrap.className = `msg msg-${role === "assistant" ? "bot" : "user"}${opts.proactive ? " msg-proactive" : ""}`;

  const label = document.createElement("div");
  label.className = "msg-label";
  label.textContent = role === "assistant" ? "Yari" : "ты";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  if (opts.image) {
    const img = document.createElement("img");
    img.src = opts.image;
    img.style.cssText = "max-width:100%;border-radius:10px;display:block;" + (text ? "margin-bottom:6px;" : "");
    bubble.appendChild(img);
  }
  if (text) {
    const textEl = document.createElement("div");
    textEl.textContent = text;
    bubble.appendChild(textEl);
  }

  wrap.appendChild(label);
  wrap.appendChild(bubble);

  if (role === "assistant") {
    const feedbackBar = document.createElement("div");
    feedbackBar.style.display = "flex";
    feedbackBar.style.gap = "2px";
    feedbackBar.style.marginTop = "4px";

    const iconBtnStyle =
      "background:transparent;border:none;color:var(--text-dim);cursor:pointer;padding:4px 6px;border-radius:6px;line-height:0;";

    function thumbIconSvg(flipped) {
      const transform = flipped ? "transform:rotate(180deg);" : "";
      return (
        `<svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" ` +
        `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:block;${transform}">` +
        `<path d="M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h2m0 8V10m0 8h8.5a1.5 1.5 0 0 0 1.47-1.21l1.2-6A1.5 1.5 0 0 0 15.7 9H11l.6-3.2a1.4 1.4 0 0 0-2.5-1.1L6 10" />` +
        `</svg>`
      );
    }

    const up = document.createElement("button");
    up.innerHTML = thumbIconSvg(false);
    up.title = "нравится";
    up.style.cssText = iconBtnStyle;
    up.addEventListener("click", () => {
      sendFeedback(text, "up");
      pendingReactionNote = "пользователь поставил лайк этому твоему ответу.";
      up.style.color = "#b9e8a6";
      down.style.color = "var(--text-dim)";
    });

    const down = document.createElement("button");
    down.innerHTML = thumbIconSvg(true);
    down.title = "не нравится";
    down.style.cssText = iconBtnStyle;
    down.addEventListener("click", () => {
      openDislikeReasonPopup((category, detail) => {
        sendFeedback(text, "down", category, detail);
        const categoryLabel =
          category === "technical"
            ? "техническая проблема"
            : category === "ai"
            ? "реакция на твой стиль/содержание ответа"
            : "без уточнения";
        pendingReactionNote = `пользователь поставил дизлайк этому твоему ответу. причина: ${categoryLabel}${
          detail ? " — " + detail : ""
        }.`;
        down.style.color = "#e88a9a";
        up.style.color = "var(--text-dim)";
      });
    });

    feedbackBar.appendChild(up);
    feedbackBar.appendChild(down);
    wrap.appendChild(feedbackBar);
  }

  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function renderMessages() {
  chat.innerHTML = "";
  const c = getActiveChat();
  if (!c || c.messages.length === 0) {
    addMessageToDOM("assistant", tr("greeting"));
    return;
  }
  c.messages.forEach((m) => addMessageToDOM(m.role, m.content, { proactive: m.proactive, image: m.image }));
}

function looksLikeFlairOff(text) {
  const t = text.toLowerCase();
  return (
    t.includes("убери каомодзи") ||
    t.includes("без каомодзи") ||
    t.includes("выключи каомодзи") ||
    t.includes("не надо смайлик") ||
    t.includes("убери смайлик")
  );
}

function looksLikeProactiveOff(text) {
  const t = text.toLowerCase();
  return (
    t.includes("не пиши мне сама") ||
    t.includes("не пиши первой") ||
    t.includes("не пиши сама первой") ||
    t.includes("не пиши мне первой") ||
    (t.includes("не пиши") && t.includes("сам"))
  );
}

async function sendMessage(text) {
  const c = getActiveChat();

  const limitKey = isLoggedIn() ? USER_LIMIT_KEY : GUEST_LIMIT_KEY;
  const dailyLimit = isLoggedIn() ? USER_DAILY_LIMIT : GUEST_DAILY_LIMIT;
  const usage = getDailyUsage(limitKey);
  if (usage.count >= dailyLimit) {
    addMessageToDOM(
      "assistant",
      isLoggedIn()
        ? `на сегодня лимит сообщений исчерпан (${USER_DAILY_LIMIT} в день) — общий бюджет ии на день небольшой, возвращайся завтра.`
        : `на сегодня гостевой лимит сообщений исчерпан (${GUEST_DAILY_LIMIT} в день). зарегистрируйся — с аккаунтом лимит выше (${USER_DAILY_LIMIT} в день).`
    );
    return;
  }

  if (looksLikeProactiveOff(text)) {
    c.proactiveOff = true;
    if (isLoggedIn()) updateChatMeta(c.id, { proactiveOff: true });
  }

  const imageToSend = pendingImage;
  pendingImage = null;
  if (attachPreviewBarEl) attachPreviewBarEl.style.display = "none";

  c.messages.push({ role: "user", content: text, image: imageToSend || undefined });
  let titleChanged = false;
  if (c.messages.length === 1) {
    c.title = text.slice(0, 30) || "фото";
    titleChanged = true;
  }

  if (isLoggedIn()) {
    await persistChatToServer(c, titleChanged);
  } else {
    saveStore(store);
  }
  incrementDailyUsage(limitKey);

  addMessageToDOM("user", text, { image: imageToSend });
  renderChatsPanel();

  const typingEl = document.createElement("div");
  typingEl.className = "msg msg-bot";

  const typingLabel = document.createElement("div");
  typingLabel.className = "msg-label";
  typingLabel.textContent = "Yari";

  const typingBubble = document.createElement("div");
  typingBubble.className = "msg-bubble typing-indicator";
  typingBubble.innerHTML =
    '<span class="typing-dots"><span></span><span></span><span></span></span>';

  typingEl.appendChild(typingLabel);
  typingEl.appendChild(typingBubble);
  chat.appendChild(typingEl);
  chat.scrollTop = chat.scrollHeight;

  setStatus(true);

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        messages: c.messages.map((m, idx, arr) => {
          const isLast = idx === arr.length - 1;
          if (m.image && isLast) {
            return {
              role: m.role,
              content: [
                { type: "text", text: m.content || "" },
                { type: "image_url", image_url: { url: m.image } },
              ],
            };
          }
          if (m.image && !isLast) {
            return { role: m.role, content: (m.content ? m.content + " " : "") + "[фото]" };
          }
          return { role: m.role, content: m.content };
        }),
      }),
    });
    pendingReactionNote = null;

    if (!res.ok) {
      typingEl.remove();
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        addMessageToDOM(
          "assistant",
          errData.limitReached
            ? "на сегодня твой лимит токенов исчерпан, возвращайся завтра."
            : `у меня тут что-то с соединением (код ${res.status}). попробуй ещё раз.`
        );
      } else {
        addMessageToDOM("assistant", `у меня тут что-то с соединением (код ${res.status}). попробуй ещё раз.`);
      }
      return;
    }

    const data = await res.json();
    typingEl.remove();
    refreshMyUsage();

    if (data.reply) {
      c.messages.push({ role: "assistant", content: data.reply });
      c.nextProactiveAt = Date.now() + randomGapMs();

      if (isLoggedIn()) {
        updateChatMeta(c.id, { nextProactiveAt: c.nextProactiveAt });
        await persistChatToServer(c, false);
      } else {
        saveStore(store);
      }
      addMessageToDOM("assistant", data.reply);
    } else {
      addMessageToDOM("assistant", "…что-то пошло не так, я задумалась.");
    }
  } catch (err) {
    typingEl.remove();
    addMessageToDOM("assistant", `у меня тут что-то с соединением: ${err && err.message ? err.message : err}. попробуй ещё раз.`);
  } finally {
    setStatus(false);
  }
}

async function checkProactive() {
  const c = getActiveChat();
  if (!c || c.proactiveOff) return;
  if (c.messages.length === 0) return;
  if (Date.now() < c.nextProactiveAt) return;

  setStatus(true);

  try {
    const res = await fetch(`${API_BASE}/proactive`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        messages: c.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await res.json();
    if (!data.reply) {
      c.nextProactiveAt = Date.now() + randomGapMs();
      if (isLoggedIn()) updateChatMeta(c.id, { nextProactiveAt: c.nextProactiveAt });
      else saveStore(store);
      return;
    }

    const parts = data.reply.split("|||").map((p) => p.trim()).filter(Boolean);

    for (let i = 0; i < parts.length; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 0 : 1200 + Math.random() * 800));
      c.messages.push({ role: "assistant", content: parts[i], proactive: true });
      if (isLoggedIn()) await persistChatToServer(c, false);
      else saveStore(store);
      addMessageToDOM("assistant", parts[i], { proactive: true });
    }

    c.nextProactiveAt = Date.now() + randomGapMs();
    if (isLoggedIn()) updateChatMeta(c.id, { nextProactiveAt: c.nextProactiveAt });
    else saveStore(store);
  } catch (err) {
    // тихо промолчим, попробуем в другой раз
  } finally {
    setStatus(false);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text && !pendingImage) return;
  input.value = "";
  input.style.height = "auto";

  if (text) {
    const unlocked = await tryUnlock(text);
    if (unlocked) return;

    const redeemed = await tryRedeemCode(text);
    if (redeemed) return;
  }

  let finalText = text;
  if (pendingQuote) {
    const quoted = pendingQuote
      .split("\n")
      .map((line) => "» " + line)
      .join("\n");
    finalText = `${quoted}\n\n${text}`;
  }
  clearQuote();

  sendMessage(finalText);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
});

// ===== Действия над сообщением: копировать / ответить (с цитатой) =====
// Долгий тап по баблу целиком — меню для всего текста сообщения.
// Выделение куска текста внутри бабла — то же меню, но только для
// выделенного фрагмента (чтобы не копировать/цитировать лишнее).

let pendingQuote = null;
// Пометка о последней реакции (лайк/дизлайк) — подмешивается в следующее
// сообщение на бэкенде, чтобы Яри "увидела" реакцию без отдельного запроса.
let pendingReactionNote = null;

function setQuote(text) {
  pendingQuote = text;
  if (quotePreviewText) {
    quotePreviewText.textContent = text.length > 140 ? text.slice(0, 140) + "…" : text;
  }
  if (quotePreview) quotePreview.style.display = "flex";
  if (input) input.focus();
}

function clearQuote() {
  pendingQuote = null;
  if (quotePreview) quotePreview.style.display = "none";
}

if (quotePreviewClose) {
  quotePreviewClose.addEventListener("click", clearQuote);
}

let msgActionText = "";

function showMsgActionMenu(x, y, text) {
  if (!msgActionMenu || !text) return;
  msgActionText = text;
  msgActionMenu.style.display = "flex";
  const menuWidth = msgActionMenu.offsetWidth || 160;
  const clampedX = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8));
  const clampedY = Math.max(8, y);
  msgActionMenu.style.left = clampedX + "px";
  msgActionMenu.style.top = clampedY + "px";
}

function hideMsgActionMenu() {
  if (!msgActionMenu) return;
  msgActionMenu.style.display = "none";
  msgActionText = "";
}

if (msgActionCopy) {
  msgActionCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(msgActionText);
    } catch (err) {
      // буфер обмена недоступен — тихо промолчим
    }
    hideMsgActionMenu();
  });
}

if (msgActionReply) {
  msgActionReply.addEventListener("click", () => {
    setQuote(msgActionText);
    hideMsgActionMenu();
  });
}

document.addEventListener("click", (e) => {
  if (msgActionMenu && msgActionMenu.style.display !== "none" && !msgActionMenu.contains(e.target)) {
    hideMsgActionMenu();
  }
});

// Долгий тап (или долгое нажатие мышью) по баблу целиком
let pressTimer = null;
let pressStart = null;

chat.addEventListener("pointerdown", (e) => {
  const bubble = e.target.closest(".msg-bubble");
  if (!bubble) return;
  pressStart = { x: e.clientX, y: e.clientY };
  pressTimer = setTimeout(() => {
    pressTimer = null;
    showMsgActionMenu(e.clientX, Math.max(e.clientY - 56, 8), bubble.textContent);
  }, 450);
});

chat.addEventListener("pointermove", (e) => {
  if (!pressTimer || !pressStart) return;
  const dx = Math.abs(e.clientX - pressStart.x);
  const dy = Math.abs(e.clientY - pressStart.y);
  if (dx > 8 || dy > 8) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
});

chat.addEventListener("pointerup", () => {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
});

chat.addEventListener("pointercancel", () => {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
});

// Выделение фрагмента текста внутри бабла — показываем то же меню,
// но только для выделенного куска
document.addEventListener("selectionchange", () => {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  const anchorNode = range.commonAncestorContainer;
  const anchorEl = anchorNode.nodeType === 1 ? anchorNode : anchorNode.parentElement;
  const bubble = anchorEl ? anchorEl.closest(".msg-bubble") : null;
  if (!bubble) return;

  const text = sel.toString().trim();
  if (!text) return;

  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return;
  showMsgActionMenu(rect.left, Math.max(rect.top - 52, 8), text);
});

// ===== Приветствие / выбор языка для новых гостей =====

const LANG_CHOSEN_KEY = "yari_lang_chosen";

function showLanguageWelcomeIfNeeded() {
  if (isLoggedIn()) return;
  if (localStorage.getItem(LANG_CHOSEN_KEY)) return;
  const c = getActiveChat();
  if (c && c.messages.length > 0) return; // уже не новый юзер

  const overlay = document.createElement("div");
  overlay.id = "langWelcomeOverlay";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;";

  const card = document.createElement("div");
  card.style.cssText =
    "background:var(--panther-soft);border:1px solid var(--panther-line);border-radius:16px;padding:32px 24px;max-width:360px;width:100%;text-align:center;color:var(--text);font-family:inherit;";

  const title = document.createElement("div");
  title.style.cssText =
    "font-family:'Fraunces',serif;font-style:italic;font-weight:600;font-size:24px;margin-bottom:8px;color:var(--text);";
  title.textContent = "Yari";

  const text = document.createElement("div");
  text.style.cssText = "font-size:15px;line-height:1.5;margin-bottom:24px;color:var(--text-dim);";
  text.innerHTML = "Welcome! Choose your language.<br>Добро пожаловать! Выберите язык.";

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:12px;justify-content:center;";

  function chooseLang(lang) {
    localStorage.setItem(LANG_CHOSEN_KEY, "1");
    localStorage.setItem("yari_lang", lang);
    overlay.remove();
    applyLanguage();
    renderMessages();
  }

  const ruBtn = document.createElement("button");
  ruBtn.textContent = "Русский";
  ruBtn.style.cssText =
    "flex:1;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--peach),var(--lavender));color:var(--on-accent);font-weight:600;cursor:pointer;";
  ruBtn.addEventListener("click", () => chooseLang("ru"));

  const enBtn = document.createElement("button");
  enBtn.textContent = "English";
  enBtn.style.cssText =
    "flex:1;padding:12px;border-radius:10px;border:1px solid var(--lavender);background:transparent;color:var(--text);font-weight:600;cursor:pointer;";
  enBtn.addEventListener("click", () => chooseLang("en"));

  btnRow.appendChild(ruBtn);
  btnRow.appendChild(enBtn);
  card.appendChild(title);
  card.appendChild(text);
  card.appendChild(btnRow);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// ===== Инициализация =====

(async function init() {
  checkRecoveryHash();

  if (isLoggedIn()) {
    try {
      await loadServerChats();
    } catch (e) {
      const refreshed = await refreshAuthToken();
      if (!refreshed) {
        handleLogout();
        return;
      }
      try {
        await loadServerChats();
      } catch (e2) {
        handleLogout();
        return;
      }
    }
  } else {
    loadGuestChat();
  }

  renderAuthUI();
  renderProfileIdentity();
  buildThemeToggle();

  // ВАЖНО: раньше здесь стояло "if (c) {...}", но переменная c нигде не
  // была объявлена в этой области видимости — это кидало ReferenceError
  // и обрывало весь init() на этой строке. Из-за этого renderChatsPanel()
  // и renderMessages() ниже вообще не вызывались после reload/логаута —
  // именно поэтому казалось, что диалоги "слетают" при обновлении
  // страницы (на самом деле данные были целы, просто не отрисовывались).
  const activeChat = getActiveChat();
  if (activeChat) {
    activeChat.lastVisit = Date.now();
    if (isLoggedIn()) updateChatMeta(activeChat.id, { lastVisit: activeChat.lastVisit });
    else saveStore(store);
  }

  renderChatsPanel();
  renderMessages();
  checkProactive();
  renderRolePanel();
  applyLanguage();
  showLanguageWelcomeIfNeeded();
})();
