const chat = document.getElementById("chat");
const form = document.getElementById("composer");
const input = document.getElementById("input");

// ===== Прикрепление фото к сообщению (скрепка в composer) =====
const MAX_IMAGE_DIMENSION = 1280;
let pendingImage = null; // dataURL текущего прикреплённого фото
let attachPreviewBarEl = null;
let attachBtnEl = null;
let imageToolsBtnEl = null;
let imageModeBarEl = null;
let imageToolsRemainingEl = null; // блок "Осталось на сегодня: N" в меню инструментов
let imageMode = null; // null | "generate" | "edit"

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

  attachBtnEl = attachBtn;
}

buildAttachUI();

// ===== Инструменты изображений: три точки → "сгенерировать" / "редактировать" =====
// Кнопка стоит правее скрепки в том же поле ввода. Выбор режима открывает
// плашку над полем ввода с названием режима и крестиком отмены — обычный
// текст без плашки уходит Яри как раньше, с плашкой — уходит в генерацию
// картинки (см. обработчик submit ниже). Внутри того же меню — некликабельный
// блок "Осталось на сегодня: N", уменьшающийся с каждой генерацией.

const IMAGE_GEN_LIMIT_KEY = "yari_image_gen_limit_v1";
const IMAGE_DAILY_LIMIT = 2;

function getRemainingGenerations() {
  const usage = getDailyUsage(IMAGE_GEN_LIMIT_KEY);
  return Math.max(0, IMAGE_DAILY_LIMIT - usage.count);
}

function updateRemainingGensDisplay() {
  if (!imageToolsRemainingEl) return;
  const remaining = getRemainingGenerations();
  imageToolsRemainingEl.innerHTML = `${tr("remainingToday")}: <strong>${remaining}</strong>`;
}

function buildImageToolsUI() {
  if (!form || !input || !attachBtnEl) return;
  const wrapper = attachBtnEl.parentNode;
  if (!wrapper) return;

  attachBtnEl.style.right = "34px";
  input.style.paddingRight = "64px";

  const menuBtn = document.createElement("button");
  menuBtn.type = "button";
  menuBtn.title = "изображения";
  menuBtn.style.cssText =
    "position:absolute;right:4px;bottom:6px;background:transparent;border:none;color:var(--text-dim);cursor:pointer;padding:5px;line-height:0;";
  menuBtn.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

  const menu = document.createElement("div");
  menu.style.cssText =
    "display:none;position:absolute;bottom:40px;right:0;background:var(--panther-soft);border:1px solid var(--panther-line);border-radius:10px;padding:4px;z-index:50;min-width:210px;box-shadow:0 8px 24px rgba(0,0,0,0.45);";

  function menuItem(label, iconSvg, mode) {
    const item = document.createElement("button");
    item.type = "button";
    item.style.cssText =
      "display:flex;align-items:center;gap:8px;width:100%;padding:9px 10px;background:transparent;border:none;color:var(--text);font-family:'Inter',sans-serif;font-size:13px;cursor:pointer;border-radius:7px;text-align:left;";
    item.innerHTML = `<span style="display:inline-flex;line-height:0;">${iconSvg}</span><span>${label}</span>`;
    item.addEventListener("click", () => {
      setImageMode(mode);
      menu.style.display = "none";
    });
    return item;
  }

  const genIcon =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>';
  const editIcon =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

  menu.appendChild(menuItem("Сгенерировать изображение", genIcon, "generate"));
  menu.appendChild(menuItem("Редактировать изображение", editIcon, "edit"));

  const remainingEl = document.createElement("div");
  remainingEl.className = "remaining-gens";
  menu.appendChild(remainingEl);
  imageToolsRemainingEl = remainingEl;

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = menu.style.display === "none";
    menu.style.display = opening ? "block" : "none";
    if (opening) updateRemainingGensDisplay();
  });
  document.addEventListener("click", () => {
    menu.style.display = "none";
  });

  wrapper.appendChild(menuBtn);
  wrapper.appendChild(menu);
  imageToolsBtnEl = menuBtn;

  const bar = document.createElement("div");
  bar.style.cssText = "display:none;align-items:center;gap:10px;padding:8px 20px 0;";
  const barText = document.createElement("div");
  barText.style.cssText =
    "flex:1;padding:6px 10px;border-left:2px solid var(--lavender);background:var(--panther-soft);border-radius:0 6px 6px 0;font-size:12px;color:var(--text-dim);";
  const barClose = document.createElement("button");
  barClose.type = "button";
  barClose.textContent = "✕";
  barClose.title = "отменить";
  barClose.style.cssText =
    "flex-shrink:0;width:22px;height:22px;border-radius:50%;border:none;background:transparent;color:var(--text-dim);cursor:pointer;font-size:13px;";
  barClose.addEventListener("click", () => setImageMode(null));
  bar.appendChild(barText);
  bar.appendChild(barClose);
  if (form.parentElement) form.parentElement.insertBefore(bar, form);
  imageModeBarEl = bar;
  imageModeBarEl._textEl = barText;
}

function setImageMode(mode) {
  imageMode = mode;
  if (!imageModeBarEl) return;
  if (!mode) {
    imageModeBarEl.style.display = "none";
    return;
  }
  imageModeBarEl.style.display = "flex";
  imageModeBarEl._textEl.textContent =
    mode === "generate" ? "режим: сгенерировать изображение" : "режим: редактировать изображение (приложи фото)";
}

// Гостям инструменты изображений недоступны, как и фото.
function updateImageToolsVisibility() {
  if (imageToolsBtnEl) imageToolsBtnEl.style.display = isLoggedIn() ? "" : "none";
  if (!isLoggedIn()) setImageMode(null);
}

buildImageToolsUI();

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

// --- Новые элементы: крестики закрытия панелей, галерея, реферальная ссылка ---
const chatsCloseBtn = document.getElementById("chatsCloseBtn");
const profileCloseBtn = document.getElementById("profileCloseBtn");
const galleryCloseBtn = document.getElementById("galleryCloseBtn");
const referralCloseBtn = document.getElementById("referralCloseBtn");
const yariContactTrigger = document.getElementById("yariContactTrigger");
const contactGalleryOverlay = document.getElementById("contactGalleryOverlay");
const contactGalleryGrid = document.getElementById("contactGalleryGrid");
const referralTrigger = document.getElementById("referralTrigger");
const referralPanel = document.getElementById("referralPanel");
const referralLinkText = document.getElementById("referralLinkText");
const referralCopyBtn = document.getElementById("referralCopyBtn");
const referralTermsText = document.getElementById("referralTermsText");
const referralStatText = document.getElementById("referralStatText");
const blurBackdrop = document.getElementById("blurBackdrop");

// ===== Тема (светлая/тёмная) =====
// Хранится в localStorage, применяется атрибутом data-theme на <html>,
// от которого зависят все цветовые CSS-переменные (см. :root /
// [data-theme="light"] в style.css). Переключение сопровождается
// анимацией расширяющегося круга от точки нажатия на кнопку.

const THEME_KEY = "yari_theme";
const THEME_BASE_COLOR = { dark: "#110d13", light: "#ffffff" };
const LOGO_SRC = { dark: "yari-logo-white.svg", light: "yari-logo-dark.svg" };
const LOGO_HEIGHT = { dark: "80px", light: "80px" };

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
  return (
    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5z"/></svg>`
  );
}

// Просто текстовая ссылка, как "выйти" — без фоновой плашки. Тёмная тема:
// тёплый (персиковый) текст + иконка солнца. Светлая тема: голубой текст +
// иконка луны-контура. Подпись всегда называет тему, в которую переключит нажатие.
function updateThemeToggleBtn(theme) {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;
  const icon = btn.querySelector(".theme-toggle-icon");
  const label = btn.querySelector(".theme-toggle-label");
  if (theme === "dark") {
    if (icon) icon.innerHTML = sunIconSvg("var(--peach)");
    if (label) {
      label.textContent = tr("themeLight");
      label.style.color = "var(--text)";
    }
  } else {
    if (icon) icon.innerHTML = moonIconSvg("var(--cyber-blue)");
    if (label) {
      label.textContent = tr("themeDark");
      label.style.color = "var(--text)";
    }
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  updateThemeToggleBtn(theme);

  // Лого меняется вместе с темой (белый вариант на тёмном фоне, тёмный —
  // на светлом), иначе на светлой теме лого сливается/теряется.
  const logoEl = document.querySelector(".brand-logo");
  if (logoEl) {
    logoEl.src = LOGO_SRC[theme];
    logoEl.style.height = LOGO_HEIGHT[theme];
  }

  // theme-color влияет на адресную строку/статус-бар при установке как PWA —
  // должен совпадать с фоном текущей темы, а не быть всегда тёмным.
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute("content", THEME_BASE_COLOR[theme]);
}

// Оверлей закрашивается цветом НОВОЙ темы и расширяется кругом от точки
// нажатия (clip-path). Тема переключается по таймеру (setTimeout), а не
// только по transitionend — на части мобильных браузеров transitionend для
// clip-path может не сработать, и тогда переключение молча не происходило бы.
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

  let switched = false;
  function doSwitch() {
    if (switched) return;
    switched = true;
    applyTheme(nextTheme);
    overlay.style.transition = "opacity 0.25s ease";
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 260);
  }

  requestAnimationFrame(() => {
    overlay.style.clipPath = `circle(${maxRadius}px at ${cx}px ${cy}px)`;
  });

  overlay.addEventListener("transitionend", doSwitch);
  setTimeout(doSwitch, 550); // подстраховка, если transitionend не пришёл
}

// Вставляется под блоком "угловатость баблов" (слайдер радиуса) в панели
// профиля — не в шапку.
function buildThemeToggle() {
  if (document.getElementById("themeToggleBtn") || !radiusSlider) return;
  const radiusSection = radiusSlider.closest(".radius-row")
    ? radiusSlider.closest(".radius-row").parentElement
    : null;
  if (!radiusSection || !radiusSection.parentNode) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "themeToggleBtn";
  btn.className = "profile-link-cta theme-toggle-link";

  const icon = document.createElement("span");
  icon.className = "theme-toggle-icon";
  icon.style.cssText = "display:inline-flex;line-height:0;";

  const label = document.createElement("span");
  label.className = "theme-toggle-label";

  btn.appendChild(icon);
  btn.appendChild(label);
  btn.addEventListener("click", runThemeTransition);

  radiusSection.parentNode.insertBefore(btn, radiusSection.nextSibling);
  updateThemeToggleBtn(getTheme());
}

// Применяем тему сразу при загрузке скрипта (до первой отрисовки),
// чтобы не было "вспышки" неправильной темы.
applyTheme(getTheme());

// ===== Локализация (ru / en) =====

const I18N = {
  ru: {
    chatsToggle: "Чаты ▾",
    panelTitleChats: "Чаты",
    newChatTitle: "Новый чат",
    newChatDefaultTitle: "Новый чат",
    profileTitle: "Профиль",
    login: "Войти",
    guestUser: "Пользователь",
    guestBannerText: "Гостевой режим: 1 чат, до 10 сообщений в день",
    guestBannerBtn: "Войти / зарегистрироваться",
    bubbleColorLabel: "Цвет твоих баблов",
    bubbleRadiusLabel: "Угловатость баблов",
    changeEmailLabel: "Изменить email",
    newEmailPlaceholder: "новый email",
    deleteAccount: "удалить аккаунт",
    logout: "Выйти",
    loginCta: "войти / создать аккаунт",
    composerPlaceholder: "напиши что-нибудь…",
    greeting: "привет. пиши, о чём хотела поговорить — я тут.",
    statusOnline: "На связи",
    statusTyping: "Печатает",
    tabLogin: "Вход",
    tabRegister: "Регистрация",
    fieldEmail: "email",
    fieldPassword: "пароль",
    loginSubmit: "войти",
    forgotLink: "забыли пароль?",
    registerPasswordPh: "пароль (от 6 символов)",
    registerSubmit: "зарегистрироваться",
    msgCopy: "копировать",
    msgReply: "ответить",
    quoteCancel: "отменить цитату",
    themeLight: "Светлая тема",
    themeDark: "Тёмная тема",
    remainingToday: "Осталось на сегодня",
    renameLabel: "Переименовать",
    deleteLabel: "Удалить",
    galleryTitle: "Медиа",
    galleryEmpty: "Пока нет фото",
    referralTitle: "Реферальная ссылка",
    referralCopy: "копировать",
    referralCopied: "скопировано",
  },
  en: {
    chatsToggle: "Chats ▾",
    panelTitleChats: "Chats",
    newChatTitle: "New chat",
    newChatDefaultTitle: "New chat",
    profileTitle: "Profile",
    login: "Log in",
    guestUser: "User",
    guestBannerText: "Guest mode: 1 chat, up to 10 messages a day",
    guestBannerBtn: "Log in / sign up",
    bubbleColorLabel: "Your bubble color",
    bubbleRadiusLabel: "Bubble roundness",
    changeEmailLabel: "Change email",
    newEmailPlaceholder: "new email",
    deleteAccount: "delete account",
    logout: "log out",
    loginCta: "log in / sign up",
    composerPlaceholder: "type something…",
    greeting: "hi. write what's on your mind — I'm here.",
    statusOnline: "Online",
    statusTyping: "Typing",
    tabLogin: "Log in",
    tabRegister: "Sign up",
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
    remainingToday: "Left today",
    renameLabel: "Rename",
    deleteLabel: "Delete",
    galleryTitle: "Media",
    galleryEmpty: "No photos yet",
    referralTitle: "Referral link",
    referralCopy: "copy",
    referralCopied: "copied",
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

  // Раньше эти два label находились по позиционному индексу среди ВСЕХ
  // .profile-section-label на странице — а перед ними в разметке уже стоял
  // label "изменить email" с тем же классом, из-за чего индекс съезжал и
  // сюда подставлялся не тот текст (баг: на выборе цвета баблов вылезала
  // "угловатость баблов"). Теперь оба label ищутся напрямую по id.
  const bubbleColorLabelEl = document.getElementById("bubbleColorLabel");
  if (bubbleColorLabelEl) bubbleColorLabelEl.textContent = tr("bubbleColorLabel");
  const bubbleRadiusLabelEl = document.getElementById("bubbleRadiusLabel");
  if (bubbleRadiusLabelEl) bubbleRadiusLabelEl.textContent = tr("bubbleRadiusLabel");

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

  const galleryTitleEl = document.querySelector(".contact-gallery-title");
  if (galleryTitleEl) galleryTitleEl.textContent = tr("galleryTitle");

  const referralTriggerLabel = referralTrigger ? referralTrigger.querySelector("span") : null;
  if (referralTriggerLabel) referralTriggerLabel.textContent = tr("referralTitle");
  const referralTitleEl = document.querySelector(".referral-title");
  if (referralTitleEl) referralTitleEl.textContent = tr("referralTitle");
  if (referralTermsText) {
    referralTermsText.innerHTML =
      currentLang() === "en"
        ? `This is your referral link. For every person who follows it and starts chatting with Yari, you get <strong>1 image generation</strong> and <strong>400 tokens</strong>.`
        : `Ваша реферальная ссылка. За каждого человека, который перешёл по ней и начал общение с Yari, вы получаете <strong>1 генерацию изображения</strong> и <strong>400 токенов</strong>.`;
  }
  if (referralCopyBtn) referralCopyBtn.textContent = tr("referralCopy");

  updateRemainingGensDisplay();
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

// Реферальный код из URL (?ref=код) — ловим при заходе и держим в
// localStorage до момента регистрации, тогда отправляем на бэкенд вместе
// с формой регистрации (см. registerForm submit). Начисление токенов и
// генерации — на бэкенде, после того как приглашённый напишет первое
// сообщение Яри (это отдельная часть работы, не во фронтенде).
const REFERRAL_CODE_KEY = "yari_referral_code";
(function captureReferralCode() {
  const params = new URLSearchParams(location.search);
  const ref = params.get("ref");
  if (ref) localStorage.setItem(REFERRAL_CODE_KEY, ref);
})();

const STORAGE_KEY = "yari_chats_v1";
const PROFILE_KEY = "yari_profile_v1";
const META_KEY = "yari_chat_meta_v1";
const GUEST_LIMIT_KEY = "yari_guest_limit_v1";
const USER_LIMIT_KEY = "yari_user_limit_v1";
const GUEST_ID_KEY = "yari_guest_id";
const GUEST_DAILY_LIMIT = 10;
const USER_DAILY_LIMIT = 15;
const MIN_GAP_DAYS = 2;
const MAX_GAP_DAYS = 4;
const DEFAULT_PROFILE = { color: "#4fc3f7", radius: 14 };

// Стабильный идентификатор гостя (переживает перезагрузку страницы, но не
// очистку хранилища) — по нему бэкенд считает дневной лимит ТОКЕНОВ для
// гостей отдельно от клиентского счётчика СООБЩЕНИЙ выше.
function getGuestId() {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

function randomGapMs() {
  const days = MIN_GAP_DAYS + Math.random() * (MAX_GAP_DAYS - MIN_GAP_DAYS);
  return days * 24 * 60 * 60 * 1000;
}

// ===== Дневной лимит сообщений (гость: GUEST_LIMIT_KEY / 10,
// зарегистрированный: USER_LIMIT_KEY / 15). Это client-side заглушка —
// хранится в localStorage, так что обходится очисткой хранилища. Настоящая
// защита требует счётчика на бэкенде (в super-responder), это отдельная
// задача при необходимости. То же самое верно и для IMAGE_GEN_LIMIT_KEY
// (счётчик "осталось генераций" в composer) — реальный лимит проверяет
// бэкенд (limitReached), это лишь отображение для пользователя. =====

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
    title: tr("newChatDefaultTitle"),
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
      body: JSON.stringify({ title: tr("newChatDefaultTitle"), messages_json: [] }),
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

// Отслеживаем, у какого чата сейчас открыто выпадающее меню (три точки),
// чтобы повторный тап по тем же точкам закрывал его, а не открывал заново.
let openChatMenuId = null;

function closeChatDropdown() {
  const existing = document.querySelector(".chat-item-dropdown");
  if (existing) existing.remove();
  openChatMenuId = null;
}

function renderChatsPanel() {
  // Рендерим список в #chatsList, а не в сам #chatsPanel — так статичный
  // заголовок "Чаты" (лежит в index.html рядом с #chatsList) не затирается
  // при каждой перерисовке. Если по какой-то причине #chatsList не найден
  // в разметке — откатываемся на chatsPanel, чтобы список не пропал.
  const target = chatsListEl || chatsPanel;
  target.innerHTML = "";
  closeChatDropdown();
  store.chats
    .slice()
    .sort((a, b) => b.lastVisit - a.lastVisit)
    .forEach((c) => {
      const item = document.createElement("div");
      item.className = "chat-item" + (c.id === store.activeChatId ? " active" : "");

      const label = document.createElement("span");
      label.textContent = c.title;
      label.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      label.addEventListener("click", () => {
        switchChat(c.id);
      });
      item.appendChild(label);

      // Меню из трёх точек — заменяет прежнюю текстовую кнопку "удалить".
      // Переименование происходит прямо в списке (подпись превращается в
      // поле ввода) — без popup/alert, как и просила.
      if (isLoggedIn()) {
        const menuBtn = document.createElement("button");
        menuBtn.type = "button";
        menuBtn.className = "chat-item-menu-btn";
        menuBtn.setAttribute("aria-label", "меню чата");
        menuBtn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
        menuBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (openChatMenuId === c.id) {
            closeChatDropdown();
            return;
          }
          closeChatDropdown();
          openChatMenuId = c.id;

          const dropdown = document.createElement("div");
          dropdown.className = "chat-item-dropdown";

          const renameBtn = document.createElement("button");
          renameBtn.type = "button";
          renameBtn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>' +
            `<span>${tr("renameLabel")}</span>`;
          renameBtn.addEventListener("click", () => {
            closeChatDropdown();
            startRenameChat(item, label, c);
          });

          const deleteBtn = document.createElement("button");
          deleteBtn.type = "button";
          deleteBtn.className = "danger";
          deleteBtn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>' +
            `<span>${tr("deleteLabel")}</span>`;
          deleteBtn.addEventListener("click", () => {
            closeChatDropdown();
            deleteChat(c.id);
          });

          dropdown.appendChild(renameBtn);
          dropdown.appendChild(deleteBtn);
          item.appendChild(dropdown);
        });
        item.appendChild(menuBtn);
      }

      target.appendChild(item);
    });
}

// Переименование без popup — подпись чата в списке заменяется на поле
// ввода, сохраняется по Enter или по потере фокуса, Esc отменяет.
function startRenameChat(item, label, c) {
  const inputEl = document.createElement("input");
  inputEl.type = "text";
  inputEl.value = c.title;
  inputEl.style.cssText =
    "flex:1;min-width:0;background:var(--panther);border:1px solid var(--lavender);border-radius:6px;color:var(--text);font-family:'Inter',sans-serif;font-size:13px;padding:4px 8px;";
  item.replaceChild(inputEl, label);
  inputEl.focus();
  inputEl.select();

  let committed = false;
  async function commit() {
    if (committed) return;
    committed = true;
    const newTitle = inputEl.value.trim() || c.title;
    c.title = newTitle;
    if (isLoggedIn()) await persistChatToServer(c, true);
    else saveStore(store);
    renderChatsPanel();
  }

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputEl.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      committed = true; // отменяем без сохранения
      renderChatsPanel();
    }
  });
  inputEl.addEventListener("blur", commit, { once: true });
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".chat-item-dropdown") && !e.target.closest(".chat-item-menu-btn")) {
    closeChatDropdown();
  }
});

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
  if (!isLoggedIn()) return; // гость не может удалить единственный чат

  await fetch(`${API_BASE}/chats/${id}`, { method: "DELETE", headers: authHeaders() });
  store.chats = store.chats.filter((c) => c.id !== id);

  if (store.chats.length === 0) {
    const createRes = await fetch(`${API_BASE}/chats`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ title: tr("newChatDefaultTitle"), messages_json: [] }),
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
  contactGalleryOverlay.classList.remove("open");
});

if (chatsCloseBtn) {
  chatsCloseBtn.addEventListener("click", () => chatsPanel.classList.remove("open"));
}

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
    body: JSON.stringify({ title: tr("newChatDefaultTitle"), messages_json: [] }),
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
    contactGalleryOverlay.classList.remove("open");
  });
}

if (profileCloseBtn) {
  profileCloseBtn.addEventListener("click", () => {
    profilePanel.classList.remove("open");
    referralPanel.classList.remove("open");
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

// ===== "Контактная" карточка Yari + галерея =====
// Тап по блоку с логотипом/именем в шапке открывает панель под шапкой (сама
// шапка остаётся на месте, компактной — не увеличивается) со всеми фото,
// которыми обменялись в текущем чате. Повторный тап туда же закрывает.

function collectChatImages() {
  const c = getActiveChat();
  if (!c) return [];
  const images = [];
  c.messages.forEach((m) => {
    if (m.image) images.push(m.image);
    if (m.generatedImage) images.push(m.generatedImage);
  });
  return images;
}

function renderContactGallery() {
  if (!contactGalleryGrid) return;
  const images = collectChatImages();
  contactGalleryGrid.innerHTML = "";
  if (images.length === 0) {
    const empty = document.createElement("div");
    empty.className = "contact-gallery-empty";
    empty.textContent = tr("galleryEmpty");
    contactGalleryGrid.appendChild(empty);
    return;
  }
  images
    .slice()
    .reverse()
    .forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.loading = "lazy";
      img.addEventListener("click", () => openImageLightbox(url));
      contactGalleryGrid.appendChild(img);
    });
}

if (yariContactTrigger) {
  yariContactTrigger.addEventListener("click", () => {
    const willOpen = !contactGalleryOverlay.classList.contains("open");
    if (willOpen) renderContactGallery();
    contactGalleryOverlay.classList.toggle("open");
    chatsPanel.classList.remove("open");
    profilePanel.classList.remove("open");
    authPanel.classList.remove("open");
  });
}

if (galleryCloseBtn) {
  galleryCloseBtn.addEventListener("click", () => contactGalleryOverlay.classList.remove("open"));
}

// ===== Реферальная ссылка =====
// ВНИМАНИЕ: требует пары небольших доработок на бэкенде (в super-responder):
// эндпоинт GET /my-referral, возвращающий { code, referredCount, tokensEarned },
// и приём referralCode в POST /register для привязки приглашения (начисление —
// только после первого сообщения приглашённого в чате с Yari).

function buildReferralLink(code) {
  return `${location.origin}${location.pathname}?ref=${code}`;
}

async function loadReferralInfo() {
  if (!referralLinkText) return;
  if (!isLoggedIn()) {
    referralLinkText.textContent = "—";
    if (referralStatText) referralStatText.textContent = "";
    return;
  }
  referralLinkText.textContent = "…";
  if (referralStatText) referralStatText.textContent = "";
  try {
    const res = await fetch(`${API_BASE}/my-referral`, { headers: authHeaders() });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error || !data.code) {
      referralLinkText.textContent = "—";
      return;
    }
    referralLinkText.textContent = buildReferralLink(data.code);
    if (referralStatText) {
      referralStatText.textContent =
        currentLang() === "en"
          ? `${data.referredCount || 0} joined · ${data.tokensEarned || 0} tokens earned`
          : `Перешло: ${data.referredCount || 0} · получено токенов: ${data.tokensEarned || 0}`;
    }
  } catch (err) {
    referralLinkText.textContent = "—";
  }
}

if (referralTrigger) {
  referralTrigger.addEventListener("click", () => {
    referralPanel.classList.add("open");
    loadReferralInfo();
  });
}

if (referralCloseBtn) {
  referralCloseBtn.addEventListener("click", () => referralPanel.classList.remove("open"));
}

if (referralCopyBtn) {
  referralCopyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(referralLinkText.textContent);
      referralCopyBtn.textContent = tr("referralCopied");
      setTimeout(() => {
        referralCopyBtn.textContent = tr("referralCopy");
      }, 1500);
    } catch (err) {
      // буфер обмена недоступен — тихо промолчим
    }
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
    authToggle.textContent = tr("login");
    authToggle.onclick = () => {
      authPanel.classList.toggle("open");
      chatsPanel.classList.remove("open");
      profilePanel.classList.remove("open");
      contactGalleryOverlay.classList.remove("open");
    };
    if (guestBanner) guestBanner.style.display = "flex";
  }
  updateAttachVisibility();
  updateImageToolsVisibility();
}

// Фото доступны только залогиненным (зарегистрированным и деву) — гостям
// скрепка не показывается вообще, независимо от того, сколько у гостя
// осталось лимита сообщений/токенов.
function updateAttachVisibility() {
  if (attachBtnEl) attachBtnEl.style.display = isLoggedIn() ? "" : "none";
  if (!isLoggedIn()) {
    pendingImage = null;
    if (attachPreviewBarEl) attachPreviewBarEl.style.display = "none";
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
    const referralCode = localStorage.getItem(REFERRAL_CODE_KEY) || undefined;
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email, password, referralCode }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showAuthError(data.error || "Не удалось зарегистрироваться");
        return;
      }
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_EMAIL_KEY, data.email);
      if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      localStorage.removeItem(REFERRAL_CODE_KEY);
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
// если она у кого-то всё же откроется, тоже сработает.

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
    bar.textContent = `потрачено: ${data.tokensUsedToday} сегодня / ${data.tokensUsedTotal} всего`;
    container.appendChild(bar);
    return;
  }

  const budget = data.dailyBudget;
  const used = data.tokensUsedToday;
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
        const usedLabel = c.redeemed_by_user_id ? " · использован" : "";
        const info = document.createElement("div");
        info.textContent =
          `${c.code} — ${kindLabel}` +
          (c.token_budget ? ` (${c.token_budget})` : "") +
          (c.label ? ` · ${c.label}` : "") +
          (c.active ? "" : " · выкл") +
          usedLabel;
        info.style.marginBottom = "4px";

        const btnRow = document.createElement("div");
        btnRow.style.cssText = "display:flex;gap:6px;";

        const toggleBtn = document.createElement("button");
        toggleBtn.textContent = c.active ? "выключить" : "включить";
        toggleBtn.style.cssText =
          "flex:1;font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid var(--panther-line);background:transparent;color:var(--text);cursor:pointer;";
        toggleBtn.addEventListener("click", async () => {
          await fetch(`${API_BASE}/dev/toggle-code`, {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json", "x-yari-token": token }),
            body: JSON.stringify({ code: c.code, active: !c.active }),
          });
          loadCodes();
        });

        const deleteBtn2 = document.createElement("button");
        deleteBtn2.textContent = "удалить";
        deleteBtn2.style.cssText =
          "flex:1;font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid var(--panther-line);background:transparent;color:#e88a9a;cursor:pointer;";
        deleteBtn2.addEventListener("click", async () => {
          if (!confirm(`Удалить код "${c.code}"? Это необратимо.`)) return;
          await fetch(`${API_BASE}/dev/delete-code`, {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json", "x-yari-token": token }),
            body: JSON.stringify({ code: c.code }),
          });
          loadCodes();
        });

        btnRow.appendChild(toggleBtn);
        btnRow.appendChild(deleteBtn2);

        row.appendChild(info);
        row.appendChild(btnRow);
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
  appendDevExitBlock(right);
}

// Кнопка выхода из режима разраба — зовёт /dev/exit с текущим токеном,
// а после успешного ответа чистит локально сохранённые роль/токен и
// убирает боковые панели.
function appendDevExitBlock(container) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin-top:16px;padding-top:12px;border-top:1px solid var(--panther-line);";

  const exitBtn = document.createElement("button");
  exitBtn.textContent = "выйти из режима разраба";
  exitBtn.style.cssText =
    "width:100%;padding:8px;border-radius:8px;border:1px solid var(--panther-line);background:transparent;color:var(--text);cursor:pointer;font-size:12px;";
  exitBtn.addEventListener("click", async () => {
    const token = localStorage.getItem("yari_token");
    try {
      await fetch(`${API_BASE}/dev/exit`, {
        method: "POST",
        headers: authHeaders({ "x-yari-token": token }),
      });
    } catch (err) {
      // даже если запрос не прошёл — всё равно чистим локально ниже
    }
    localStorage.removeItem("yari_role");
    localStorage.removeItem("yari_token");
    const left = document.getElementById("devPanelLeft");
    const right = document.getElementById("devPanelRight");
    if (left) left.remove();
    if (right) right.remove();
  });

  wrap.appendChild(exitBtn);
  container.appendChild(wrap);
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

// Иногда Яри может закончить ответ строкой [ВАРИАНТЫ: вариант 1 | вариант 2]
// (см. системный промпт) — вместо/вместе с обычным текстом показываем
// компактные кнопки-варианты, тап по любой сразу отправляет её как
// обычное сообщение. Поле ввода при этом никуда не девается.
function parseQuickOptions(text) {
  if (typeof text !== "string") return { displayText: text, options: [] };
  const match = text.match(/\n?\[(?:ВАРИАНТЫ|OPTIONS)\s*:\s*([^\]]+)\]\s*$/i);
  if (!match) return { displayText: text, options: [] };
  const options = match[1]
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  return { displayText: text.slice(0, match.index).trimEnd(), options };
}

function sendQuickOption(text) {
  if (!text) return;
  sendMessage(text);
}

function addMessageToDOM(role, text, opts = {}) {
  const wrap = document.createElement("div");
  wrap.className = `msg msg-${role === "assistant" ? "bot" : "user"}${opts.proactive ? " msg-proactive" : ""}`;

  const label = document.createElement("div");
  label.className = "msg-label";
  label.textContent = role === "assistant" ? "Yari" : "ты";

  const { displayText, options: quickOptions } = role === "assistant" ? parseQuickOptions(text) : { displayText: text, options: [] };

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  if (opts.image) {
    const img = document.createElement("img");
    img.src = opts.image;
    img.style.cssText = "max-width:100%;border-radius:10px;display:block;" + (displayText ? "margin-bottom:6px;" : "");
    bubble.appendChild(img);
  }
  if (opts.generatedImage) {
    const imgWrap = document.createElement("div");
    imgWrap.style.cssText = "position:relative;cursor:pointer;";
    const genImg = document.createElement("img");
    genImg.src = opts.generatedImage;
    genImg.style.cssText = "max-width:100%;border-radius:10px;display:block;";
    imgWrap.appendChild(genImg);
    imgWrap.addEventListener("click", () => openImageLightbox(opts.generatedImage));
    bubble.appendChild(imgWrap);
  }
  if (displayText) {
    const textEl = document.createElement("div");
    textEl.textContent = displayText;
    bubble.appendChild(textEl);
  }

  wrap.appendChild(label);
  wrap.appendChild(bubble);

  if (quickOptions.length) {
    const pillsRow = document.createElement("div");
    pillsRow.className = "option-pills";
    quickOptions.forEach((optText) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "option-pill";
      pill.textContent = optText;
      pill.addEventListener("click", () => {
        pillsRow.querySelectorAll(".option-pill").forEach((b) => (b.disabled = true));
        pillsRow.style.opacity = "0.5";
        sendQuickOption(optText);
      });
      pillsRow.appendChild(pill);
    });
    wrap.appendChild(pillsRow);
  }

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
  c.messages.forEach((m) =>
    addMessageToDOM(m.role, m.content, { proactive: m.proactive, image: m.image, generatedImage: m.generatedImage })
  );
}

// Полноэкранный просмотр сгенерированной картинки. Скачать/закрыть — теперь
// квадратные кнопки-иконки (lightbox-btn) вместо текстовых. Скачать сохраняет
// цвет прежней текстовой кнопки (розово-лавандовый градиент), закрыть —
// неприметная, с рамкой. download на кросс-доменной ссылке браузер не всегда
// форсит (может просто открыть картинку) — на мобильном Chrome тогда
// работает долгий тап по картинке → "скачать изображение", это тоже
// нормальный путь.
function openImageLightbox(url) {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;padding:20px;gap:16px;";

  const img = document.createElement("img");
  img.src = url;
  img.style.cssText = "max-width:100%;max-height:75vh;border-radius:10px;object-fit:contain;";

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:12px;";

  const downloadBtn = document.createElement("a");
  downloadBtn.href = url;
  downloadBtn.download = "yari-image.jpg";
  downloadBtn.target = "_blank";
  downloadBtn.rel = "noopener";
  downloadBtn.className = "lightbox-btn lightbox-btn-download";
  downloadBtn.setAttribute("aria-label", "скачать");
  downloadBtn.title = "скачать";
  downloadBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"></path><path d="M7 10l5 5 5-5"></path><path d="M5 21h14"></path></svg>';

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "lightbox-btn lightbox-btn-close";
  closeBtn.setAttribute("aria-label", "закрыть");
  closeBtn.title = "закрыть";
  closeBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  closeBtn.addEventListener("click", () => overlay.remove());

  btnRow.appendChild(downloadBtn);
  btnRow.appendChild(closeBtn);
  overlay.appendChild(img);
  overlay.appendChild(btnRow);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

// Запуск генерации/редактирования: сразу показываем сообщение юзера и
// "печатает", затем опрашиваем /image-status, пока Kie (через колбэк на
// бэкенде) не положит туда готовый результат.
const IMAGE_POLL_INTERVAL_MS = 3000;
const IMAGE_POLL_TIMEOUT_MS = 120000;

async function handleGenerateImageFlow(promptText, mode, sourceImage) {
  const c = getActiveChat();

  c.messages.push({ role: "user", content: promptText, image: mode === "edit" ? sourceImage : undefined });
  let titleChanged = false;
  if (c.messages.length === 1) {
    c.title = promptText.slice(0, 30);
    titleChanged = true;
  }
  if (isLoggedIn()) await persistChatToServer(c, titleChanged);
  addMessageToDOM("user", promptText, { image: mode === "edit" ? sourceImage : undefined });
  renderChatsPanel();

  const typingEl = document.createElement("div");
  typingEl.className = "msg msg-bot";
  const typingLabel = document.createElement("div");
  typingLabel.className = "msg-label";
  typingLabel.textContent = "Yari";
  const typingBubble = document.createElement("div");
  typingBubble.className = "msg-bubble typing-indicator";
  typingBubble.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
  typingEl.appendChild(typingLabel);
  typingEl.appendChild(typingBubble);
  chat.appendChild(typingEl);
  chat.scrollTop = chat.scrollHeight;
  setStatus(true);

  try {
    const res = await fetch(`${API_BASE}/generate-image`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prompt: promptText, mode, image: mode === "edit" ? sourceImage : undefined }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      typingEl.remove();
      addMessageToDOM(
        "assistant",
        data.limitReached ? "на сегодня лимит картинок исчерпан (2 в день)." : data.error || "не получилось запустить генерацию."
      );
      return;
    }

    // Сервер принял задачу — считаем генерацию потраченной и обновляем
    // счётчик "Осталось на сегодня" в меню инструментов изображений.
    incrementDailyUsage(IMAGE_GEN_LIMIT_KEY);
    updateRemainingGensDisplay();

    const taskId = data.taskId;
    const startedAt = Date.now();

    while (Date.now() - startedAt < IMAGE_POLL_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, IMAGE_POLL_INTERVAL_MS));
      const statusRes = await fetch(`${API_BASE}/image-status?taskId=${encodeURIComponent(taskId)}`, {
        headers: authHeaders(),
      });
      const statusData = await statusRes.json().catch(() => null);
      if (!statusData) continue;

      if (statusData.state === "success" && statusData.resultUrl) {
        typingEl.remove();
        c.messages.push({ role: "assistant", content: "", generatedImage: statusData.resultUrl });
        if (isLoggedIn()) await persistChatToServer(c, false);
        addMessageToDOM("assistant", "", { generatedImage: statusData.resultUrl });
        return;
      }
      if (statusData.state === "fail") {
        typingEl.remove();
        addMessageToDOM("assistant", "не получилось сгенерировать картинку: " + (statusData.failMsg || "неизвестная ошибка"));
        return;
      }
    }

    typingEl.remove();
    addMessageToDOM("assistant", "генерация занимает необычно долго, попробуй ещё раз чуть позже.");
  } catch (err) {
    typingEl.remove();
    addMessageToDOM("assistant", "у меня тут что-то с соединением, попробуй ещё раз.");
  } finally {
    setStatus(false);
  }
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

  const imageToSend = isLoggedIn() ? pendingImage : null;
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
      headers: authHeaders({
        "Content-Type": "application/json",
        ...(isLoggedIn() ? {} : { "x-yari-guest": getGuestId() }),
      }),
      body: JSON.stringify({
        chatId: c.id,
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
        updateChatMeta(
