const chat = document.getElementById("chat");
const form = document.getElementById("composer");
const input = document.getElementById("input");

// ===== Прикрепление фото к сообщению (скрепка в composer) =====
const MAX_IMAGE_DIMENSION = 1024;
const IMAGE_TARGET_BASE64_LENGTH = 480000; // ориентир на итоговый размер base64 — экономия токенов
const IMAGE_MIN_QUALITY = 0.5;
const MAX_PHOTOS = 4; // максимум фото в одном сообщении
let pendingImages = []; // dataURL прикреплённых фото (до MAX_PHOTOS)
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

        // Подбираем качество JPEG так, чтобы держать итоговый размер в
        // разумных пределах (экономия токенов при распознавании), но не
        // роняем ниже порога, за которым фото перестаёт читаться ИИ.
        let quality = 0.72;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > IMAGE_TARGET_BASE64_LENGTH && quality > IMAGE_MIN_QUALITY) {
          quality = Math.max(IMAGE_MIN_QUALITY, quality - 0.08);
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Миниатюры прикреплённых фото над полем ввода. noteText — короткая подсказка
// (например "максимум 4 фото"); без неё показывается счётчик "2/4".
function renderAttachPreviews(noteText) {
  const bar = attachPreviewBarEl;
  if (!bar) return;
  bar.innerHTML = "";
  if (!pendingImages.length && !noteText) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "flex";
  bar.style.flexWrap = "wrap";
  pendingImages.forEach((src, i) => {
    const item = document.createElement("div");
    item.style.cssText = "position:relative;width:44px;height:44px;flex-shrink:0;";
    const img = document.createElement("img");
    img.src = src;
    img.style.cssText = "width:44px;height:44px;object-fit:cover;border-radius:8px;display:block;";
    const rm = document.createElement("button");
    rm.type = "button";
    rm.textContent = "✕";
    rm.title = "убрать фото";
    rm.style.cssText =
      "position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;border:none;background:var(--panther);color:var(--text);font-size:10px;line-height:18px;padding:0;cursor:pointer;";
    rm.addEventListener("click", () => {
      pendingImages.splice(i, 1);
      renderAttachPreviews();
    });
    item.appendChild(img);
    item.appendChild(rm);
    bar.appendChild(item);
  });
  const note = document.createElement("span");
  note.style.cssText = "font-size:11px;color:var(--text-dim);margin-left:auto;";
  note.textContent = noteText || pendingImages.length + "/" + MAX_PHOTOS;
  bar.appendChild(note);
}

function showAttachNote(text) {
  renderAttachPreviews(text);
  setTimeout(() => renderAttachPreviews(), 2500);
}

function clearPendingImages() {
  pendingImages = [];
  renderAttachPreviews();
}

// Загружает фото (dataURL) в хранилище по одному и возвращает список публичных ссылок.
async function uploadPhotos(dataUrls) {
  const urls = [];
  for (const image of dataUrls) {
    const res = await fetch(`${API_BASE}/upload-photo`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ image }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || "не удалось загрузить фото");
    urls.push(data.url);
  }
  return urls;
}

// Миниатюры прикреплённых фото над полем ввода. noteText — короткая подсказка
// (например "максимум 4 фото"); без неё показывается счётчик "2/4".
function renderAttachPreviews(noteText) {
  const bar = attachPreviewBarEl;
  if (!bar) return;
  bar.innerHTML = "";
  if (!pendingImages.length && !noteText) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "flex";
  bar.style.flexWrap = "wrap";
  pendingImages.forEach((src, i) => {
    const item = document.createElement("div");
    item.style.cssText = "position:relative;width:44px;height:44px;flex-shrink:0;";
    const img = document.createElement("img");
    img.src = src;
    img.style.cssText = "width:44px;height:44px;object-fit:cover;border-radius:8px;display:block;";
    const rm = document.createElement("button");
    rm.type = "button";
    rm.textContent = "✕";
    rm.title = "убрать фото";
    rm.style.cssText =
      "position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;border:none;background:var(--panther);color:var(--text);font-size:10px;line-height:18px;padding:0;cursor:pointer;";
    rm.addEventListener("click", () => {
      pendingImages.splice(i, 1);
      renderAttachPreviews();
    });
    item.appendChild(img);
    item.appendChild(rm);
    bar.appendChild(item);
  });
  const note = document.createElement("span");
  note.style.cssText = "font-size:11px;color:var(--text-dim);margin-left:auto;";
  note.textContent = noteText || pendingImages.length + "/" + MAX_PHOTOS;
  bar.appendChild(note);
}

function showAttachNote(text) {
  renderAttachPreviews(text);
  setTimeout(() => renderAttachPreviews(), 2500);
}

function clearPendingImages() {
  pendingImages = [];
  renderAttachPreviews();
}

// Загружает фото (dataURL) в хранилище по одному и возвращает список публичных ссылок.
async function uploadPhotos(dataUrls) {
  const urls = [];
  for (const image of dataUrls) {
    const res = await fetch(`${API_BASE}/upload-photo`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ image }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || "не удалось загрузить фото");
    urls.push(data.url);
  }
  return urls;
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
  fileInput.multiple = true;
  fileInput.style.display = "none";

  const previewBar = document.createElement("div");
  previewBar.id = "attachPreview";
  previewBar.style.cssText =
    "display:none;align-items:center;gap:8px;padding:8px;margin-bottom:6px;background:var(--panther-soft);border:1px solid var(--panther-line);border-radius:10px;";
  attachPreviewBarEl = previewBar;

  attachBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = "";
    if (!files.length) return;
    const room = Math.max(0, MAX_PHOTOS - pendingImages.length);
    const chosen = files.slice(0, room);
    let note = files.length > chosen.length ? "максимум " + MAX_PHOTOS + " фото" : "";
    for (const file of chosen) {
      try {
        pendingImages.push(await resizeImageToDataUrl(file, MAX_IMAGE_DIMENSION));
      } catch (e) {
        note = "не удалось прочитать фото";
      }
    }
    if (note) showAttachNote(note);
    else renderAttachPreviews();
  });

  wrapper.appendChild(attachBtn);
  wrapper.appendChild(fileInput);
  if (form.parentElement) form.parentElement.insertBefore(previewBar, form);

  attachBtnEl = attachBtn;
}

buildAttachUI();

// ===== Иконки (копирование, файл, скачать) =====

function copyIconSvg() {
  return (
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>'
  );
}

function checkIconSvg() {
  return (
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="20 6 9 17 4 12"/></svg>'
  );
}

function downloadIconSvg() {
  return (
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>'
  );
}

function fileIconSvg() {
  return (
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
  );
}

function linkIconSvg() {
  return (
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'
  );
}

function splitMessageIntoSegments(text) {
  const segments = [];
  const fenceRe = /```(\w+)?\n([\s\S]*?)(?:```|$)/g;
  let lastIndex = 0;
  let match;
  while ((match = fenceRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index).trim();
      if (before) segments.push({ type: "text", content: before });
    }
    segments.push({ type: "code", content: match[2].replace(/\n$/, ""), lang: (match[1] || "").toLowerCase() });
    lastIndex = fenceRe.lastIndex;
  }
  const rest = text.slice(lastIndex).trim();
  if (rest) segments.push({ type: "text", content: rest });
  if (segments.length === 0) segments.push({ type: "text", content: text });
  return segments;
}

const PUBLISHED_SITES_KEY = "yari_published_sites_v1";

// Короткий "отпечаток" текста сайта — по нему помним, какой именно сайт уже опубликован.
function siteFingerprint(html) {
  let h = 5381;
  for (let i = 0; i < html.length; i++) h = ((h << 5) + h + html.charCodeAt(i)) | 0;
  return html.length + ":" + h;
}

function getPublishedUrl(html) {
  try {
    const map = JSON.parse(localStorage.getItem(PUBLISHED_SITES_KEY)) || {};
    return map[siteFingerprint(html)] || null;
  } catch (e) {
    return null;
  }
}

function savePublishedUrl(html, url) {
  let map = {};
  try {
    map = JSON.parse(localStorage.getItem(PUBLISHED_SITES_KEY)) || {};
  } catch (e) {
    map = {};
  }
  map[siteFingerprint(html)] = url;
  localStorage.setItem(PUBLISHED_SITES_KEY, JSON.stringify(map));
}

function setPublishedBtnLabel(btn) {
  btn.innerHTML = `${linkIconSvg()}<span>сайт опубликован</span>`;
}

async function copyPublishedLink(url, btn) {
  try { await navigator.clipboard.writeText(url); } catch (e) {}
  btn.innerHTML = `${checkIconSvg()}<span>ссылка скопирована</span>`;
  if (btn._resetTimer) clearTimeout(btn._resetTimer);
  btn._resetTimer = setTimeout(() => setPublishedBtnLabel(btn), 30000);
}

async function publishSite(html, btn) {
  // Сайт уже публиковали — новую ссылку не создаём, просто копируем прежнюю.
  const existing = getPublishedUrl(html);
  if (existing) {
    await copyPublishedLink(existing, btn);
    return;
  }

  const original = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "публикую…";
  try {
    const res = await fetch(`${API_BASE}/publish-site`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ html }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      btn.textContent = "не получилось";
      setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 2500);
      return;
    }
    savePublishedUrl(html, data.url);
    btn.disabled = false;
    await copyPublishedLink(data.url, btn);
  } catch (err) {
    btn.textContent = "ошибка сети";
    setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 2500);
  }
}

// ===== Длинный вставленный/сгенерированный текст → файловая карточка =====

const LONG_TEXT_CHAR_THRESHOLD = 600;
const LONG_TEXT_LINE_THRESHOLD = 14;

function shouldConvertToFile(text) {
  if (!text) return false;
  const lines = text.split("\n").length;
  return text.length > LONG_TEXT_CHAR_THRESHOLD || lines > LONG_TEXT_LINE_THRESHOLD;
}

function deriveFileTitle(text) {
  const htmlTitle = isHtmlDocument(text) ? (text.match(/<title[^>]*>([^<]{1,80})<\/title>/i) || [])[1] : null;
  if (htmlTitle && htmlTitle.trim()) return htmlTitle.trim();
  const firstLine = (text.split("\n").find((l) => l.trim().length > 0) || "").trim();
  if (!firstLine) return "Текст";
  return firstLine.length > 42 ? firstLine.slice(0, 42) + "…" : firstLine;
}

function isHtmlDocument(text) {
  return /^\s*<!doctype html|^\s*<html/i.test(text);
}

function guessFileExtension(content) {
  if (isHtmlDocument(content)) return "html";
  const fenceMatch = content.match(/```([a-zA-Z0-9]+)/);
  if (fenceMatch) {
    const lang = fenceMatch[1].toLowerCase();
    const map = { js: "js", javascript: "js", ts: "ts", python: "py", py: "py", html: "html", css: "css", json: "json", java: "java", cpp: "cpp", c: "c", bash: "sh", sh: "sh" };
    if (map[lang]) return map[lang];
  }
  return "txt";
}

function slugifyFilename(title) {
  const cleaned = title.replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim().replace(/\s+/g, "-").slice(0, 40);
  return cleaned || "file";
}

function formatFileMeta(content) {
  const lines = content.split("\n").length;
  const bytes = new Blob([content]).size;
  const sizeStr = bytes < 1024 ? `${bytes} Б` : `${(bytes / 1024).toFixed(1)} КБ`;
  return `${lines} строк · ${sizeStr}`;
}

function openFileViewer(content, title) {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;";

  const card = document.createElement("div");
  card.style.cssText =
    "background:var(--panther-soft);border:1px solid var(--panther-line);border-radius:14px;width:100%;max-width:520px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;";
  if (isHtmlDocument(content)) {
    // сайту нужно много места: без явной высоты рамка превью схлопывается
    card.style.maxWidth = "min(1000px, 100%)";
    card.style.height = "100%";
    card.style.maxHeight = "100%";
  }

  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--panther-line);";

  const titleEl = document.createElement("div");
  titleEl.style.cssText =
    "font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  titleEl.textContent = title;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.style.cssText = "flex-shrink:0;background:transparent;border:none;color:var(--text-dim);cursor:pointer;padding:4px;line-height:0;";
  closeBtn.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  closeBtn.addEventListener("click", () => overlay.remove());

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

 let body;
  if (isHtmlDocument(content)) {
    body = document.createElement("div");
    body.style.cssText = "flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;";

    const tabs = document.createElement("div");
    tabs.style.cssText = "display:flex;gap:4px;padding:0 14px;border-bottom:1px solid var(--panther-line);flex-shrink:0;";

    const previewTab = document.createElement("button");
    previewTab.type = "button";
    previewTab.textContent = "Превью";
    const codeTab = document.createElement("button");
    codeTab.type = "button";
    codeTab.textContent = "Код";
    [previewTab, codeTab].forEach((btn) => {
      btn.style.cssText = "background:transparent;border:none;color:var(--text-dim);font-size:12px;padding:9px 10px;cursor:pointer;border-bottom:2px solid transparent;";
    });
    previewTab.style.color = "var(--text)";
    previewTab.style.borderBottomColor = "var(--peach)";

    const iframe = document.createElement("iframe");
    iframe.sandbox = "allow-scripts";
    iframe.srcdoc = content;
    iframe.style.cssText = "flex:1;border:none;background:#fff;";

    const pre = document.createElement("pre");
    pre.style.cssText =
      "margin:0;padding:14px;overflow:auto;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.5;color:var(--text);white-space:pre-wrap;word-break:break-word;flex:1;display:none;";
    pre.textContent = content;

    previewTab.addEventListener("click", () => {
      previewTab.style.color = "var(--text)";
      previewTab.style.borderBottomColor = "var(--peach)";
      codeTab.style.color = "var(--text-dim)";
      codeTab.style.borderBottomColor = "transparent";
      iframe.style.display = "block";
      pre.style.display = "none";
    });
    codeTab.addEventListener("click", () => {
      codeTab.style.color = "var(--text)";
      codeTab.style.borderBottomColor = "var(--peach)";
      previewTab.style.color = "var(--text-dim)";
      previewTab.style.borderBottomColor = "transparent";
      pre.style.display = "block";
      iframe.style.display = "none";
    });

    tabs.appendChild(previewTab);
    tabs.appendChild(codeTab);
    body.appendChild(tabs);
    body.appendChild(iframe);
    body.appendChild(pre);
  } else {
    body = document.createElement("pre");
    body.style.cssText =
      "margin:0;padding:14px;overflow:auto;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.5;color:var(--text);white-space:pre-wrap;word-break:break-word;flex:1;";
    body.textContent = content;
  }

  const footer = document.createElement("div");
  footer.style.cssText = "display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--panther-line);";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.style.cssText =
    "flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border-radius:8px;border:1px solid var(--panther-line);background:transparent;color:var(--text);cursor:pointer;font-size:12px;";
  function setCopyBtnDefault() {
    copyBtn.innerHTML = `${copyIconSvg()}<span>${tr("referralCopy")}</span>`;
  }
  setCopyBtnDefault();
  let viewerCopyResetTimer = null;
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      // буфер обмена недоступен — тихо промолчим
    }
    copyBtn.innerHTML = `${checkIconSvg()}<span>${tr("referralCopied")}</span>`;
    if (viewerCopyResetTimer) clearTimeout(viewerCopyResetTimer);
    viewerCopyResetTimer = setTimeout(setCopyBtnDefault, 30000);
  });

  const downloadBtn = document.createElement("a");
  downloadBtn.style.cssText =
    "flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border-radius:8px;border:1px solid var(--panther-line);background:transparent;color:var(--text);cursor:pointer;font-size:12px;text-decoration:none;";
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  downloadBtn.href = URL.createObjectURL(blob);
  downloadBtn.download = `${slugifyFilename(title)}.${guessFileExtension(content)}`;
  downloadBtn.innerHTML = `${downloadIconSvg()}<span>скачать</span>`;

footer.appendChild(copyBtn);
  footer.appendChild(downloadBtn);

  if (isHtmlDocument(content)) {
    const publishBtn = document.createElement("button");
    publishBtn.type = "button";
    publishBtn.style.cssText = copyBtn.style.cssText;
    publishBtn.innerHTML = getPublishedUrl(content)
      ? `${linkIconSvg()}<span>сайт опубликован</span>`
      : `${linkIconSvg()}<span>опубликовать</span>`;
    publishBtn.addEventListener("click", () => publishSite(content, publishBtn));
    footer.appendChild(publishBtn);
  }

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  overlay.appendChild(card);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function createFileCard(content, title) {
  const card = document.createElement("div");
  card.style.cssText =
    "display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--panther-line);border-radius:12px;background:var(--panther-soft);cursor:pointer;max-width:280px;";

  const icon = document.createElement("span");
  icon.style.cssText = "display:inline-flex;color:var(--text-dim);flex-shrink:0;";
  icon.innerHTML = fileIconSvg();

  const info = document.createElement("div");
  info.style.cssText = "min-width:0;flex:1;";

  const titleEl = document.createElement("div");
  titleEl.style.cssText =
    "font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  titleEl.textContent = title;

  const metaEl = document.createElement("div");
  metaEl.style.cssText = "font-size:11px;color:var(--text-dim);margin-top:2px;";
  metaEl.textContent = formatFileMeta(content);

  info.appendChild(titleEl);
  info.appendChild(metaEl);
  card.appendChild(icon);
  card.appendChild(info);
  card.addEventListener("click", () => openFileViewer(content, title));
  return card;
}

// ===== Вставка длинного текста в composer → превращаем в прикреплённый файл =====

let pendingFile = null; // { content, title }
let filePreviewBarEl = null;

function buildFilePreviewUI() {
  if (!form) return;

  const bar = document.createElement("div");
  bar.id = "filePreview";
  bar.style.cssText =
    "display:none;align-items:center;gap:8px;padding:6px 8px;margin-bottom:6px;background:var(--panther-soft);border:1px solid var(--panther-line);border-radius:10px;";

  const icon = document.createElement("span");
  icon.style.cssText = "display:inline-flex;color:var(--text-dim);flex-shrink:0;";
  icon.innerHTML = fileIconSvg();

  const titleEl = document.createElement("span");
  titleEl.style.cssText =
    "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text);";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "убрать";
  removeBtn.style.cssText = "flex-shrink:0;background:transparent;border:none;color:var(--text-dim);cursor:pointer;font-size:12px;";
  removeBtn.addEventListener("click", () => {
    pendingFile = null;
    bar.style.display = "none";
  });

  bar.appendChild(icon);
  bar.appendChild(titleEl);
  bar.appendChild(removeBtn);
  if (form.parentElement) form.parentElement.insertBefore(bar, form);

  filePreviewBarEl = bar;
  filePreviewBarEl._titleEl = titleEl;
}

function showFilePreview() {
  if (!filePreviewBarEl || !pendingFile) return;
  filePreviewBarEl._titleEl.textContent = pendingFile.title;
  filePreviewBarEl.style.display = "flex";
}

buildFilePreviewUI();

if (input) {
  input.addEventListener("paste", (e) => {
   if (imageMode) return;
    const cd = e.clipboardData || window.clipboardData;
    if (!cd) return;
    const pasted = cd.getData("text");
    if (pasted && shouldConvertToFile(pasted)) {
      e.preventDefault();
      pendingFile = { content: pasted, title: deriveFileTitle(pasted) };
      showFilePreview();
    }
  });
}

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
  if (mode && pendingFile) {
    input.value = pendingFile.content;
    pendingFile = null;
    if (filePreviewBarEl) filePreviewBarEl.style.display = "none";
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  }
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

// ===== Тема (светлая/тёмная) =====
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

  const logoEl = document.querySelector(".brand-logo");
  if (logoEl) {
    logoEl.src = LOGO_SRC[theme];
    logoEl.style.height = LOGO_HEIGHT[theme];
  }

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute("content", THEME_BASE_COLOR[theme]);
}

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
  setTimeout(doSwitch, 550);
}

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

applyTheme(getTheme());

// ===== Локализация (ru / en) =====

const I18N = {
  ru: {
    chatsToggle: "Чаты",
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
    chatsToggle: "Chats",
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

function setStatus(isTyping) {
  if (statusTextEl) statusTextEl.textContent = isTyping ? tr("statusTyping") : tr("statusOnline");
  if (statusDotsEl) statusDotsEl.style.display = isTyping ? "inline-flex" : "none";
}

function applyLanguage() {
  // Кнопка "Чаты" теперь иконка (речевой бабл) без текста — подпись
  // остаётся только в title/aria-label для доступности.
  if (chatsToggle) {
    chatsToggle.title = tr("chatsToggle");
    chatsToggle.setAttribute("aria-label", tr("chatsToggle"));
  }
  const panelTitleEl = document.querySelector(".panel-title");
  if (panelTitleEl) panelTitleEl.textContent = tr("panelTitleChats");
  if (newChatBtn) newChatBtn.title = tr("newChatTitle");
  if (profileToggle) profileToggle.title = tr("profileTitle");

  const guestBannerTextEl = guestBanner ? guestBanner.querySelector("span") : null;
  if (guestBannerTextEl) guestBannerTextEl.textContent = tr("guestBannerText");
  if (guestBannerBtn) guestBannerBtn.textContent = tr("guestBannerBtn");

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
  if (referralCopyBtn) referralCopyBtn.title = tr("referralCopy");

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

let openChatMenuId = null;

function closeChatDropdown() {
  const existing = document.querySelector(".chat-item-dropdown");
  if (existing) existing.remove();
  openChatMenuId = null;
}

function renderChatsPanel() {
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
      committed = true;
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
  if (!isLoggedIn()) return;

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

function collectChatImages() {
  const c = getActiveChat();
  if (!c) return [];
  const images = [];
  c.messages.forEach((m) => {
    if (m.image) images.push(m.image);
    if (Array.isArray(m.images)) images.push(...m.images);
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
  referralCopyBtn.innerHTML = copyIconSvg();
  referralCopyBtn.title = tr("referralCopy");
  let referralCopyResetTimer = null;
  referralCopyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(referralLinkText.textContent);
    } catch (err) {
      // буфер обмена недоступен — тихо промолчим
    }
    referralCopyBtn.innerHTML = checkIconSvg();
    if (referralCopyResetTimer) clearTimeout(referralCopyResetTimer);
    referralCopyResetTimer = setTimeout(() => {
      referralCopyBtn.innerHTML = copyIconSvg();
    }, 30000);
  });
}

// ===== Авторизация =====

function renderAuthUI() {
  // Кнопка "войти" в шапке убрана целиком — вход/регистрация доступны
  // только через гостевой баннер (guestBannerBtn) и через CTA
  // "войти / создать аккаунт" внизу панели профиля (profileLoginCta).
  if (guestBanner) guestBanner.style.display = isLoggedIn() ? "none" : "flex";
  updateAttachVisibility();
  updateImageToolsVisibility();
}

function updateAttachVisibility() {
  if (attachBtnEl) attachBtnEl.style.display = isLoggedIn() ? "" : "none";
  if (!isLoggedIn()) clearPendingImages();
 }

function handleLogout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_EMAIL_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  location.reload();
}

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

let confirmForm = null;
let confirmEmail = "";

function hideAllAuthSubforms() {
  if (loginForm) loginForm.style.display = "none";
  if (registerForm) registerForm.style.display = "none";
  if (forgotForm) forgotForm.style.display = "none";
  if (resetForm) resetForm.style.display = "none";
  if (codeForm) codeForm.style.display = "none";
  if (confirmForm) confirmForm.style.display = "none";
}

// ===== Подтверждение почты кодом (после регистрации / входа без подтверждения) =====

function buildConfirmForm() {
  if (confirmForm) return;

  confirmForm = document.createElement("form");
  confirmForm.className = "auth-form";
  confirmForm.id = "confirmForm";
  confirmForm.style.display = "none";

  const codeField = document.createElement("input");
  codeField.type = "text";
  codeField.inputMode = "numeric";
  codeField.autocomplete = "one-time-code";
  codeField.maxLength = 10;
  codeField.placeholder = "код из письма";
  codeField.required = true;

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.textContent = "подтвердить";

  const linkStyle = "background:transparent;border:none;color:var(--text-dim);cursor:pointer;font-size:12px;padding:4px;";

  const resendBtn = document.createElement("button");
  resendBtn.type = "button";
  resendBtn.textContent = "отправить код ещё раз";
  resendBtn.style.cssText = linkStyle;

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.textContent = "назад";
  backBtn.style.cssText = linkStyle;

  confirmForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAuthError("");
    const code = codeField.value.trim();
    if (!code || !confirmEmail) return;
    try {
      const res = await fetch(`${API_BASE}/verify-email`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email: confirmEmail, code }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showAuthError(data.error || "Не удалось подтвердить почту");
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

  resendBtn.addEventListener("click", async () => {
    showAuthError("");
    if (!confirmEmail) return;
    try {
      const res = await fetch(`${API_BASE}/resend-code`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email: confirmEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        showAuthError(data.error || "Не удалось отправить код");
        return;
      }
      showAuthError("Код отправлен ещё раз. Проверь почту и папку спам.");
    } catch (err) {
      showAuthError("Проблема с соединением, попробуй ещё раз");
    }
  });

  backBtn.addEventListener("click", () => {
    if (tabRegister) tabRegister.click();
  });

  confirmForm.appendChild(codeField);
  confirmForm.appendChild(submitBtn);
  confirmForm.appendChild(resendBtn);
  confirmForm.appendChild(backBtn);
  confirmForm._codeField = codeField;

  if (authError && authError.parentNode) authError.parentNode.insertBefore(confirmForm, authError);
  else if (authPanel) authPanel.appendChild(confirmForm);
}

function showConfirmStep(email) {
  buildConfirmForm();
  confirmEmail = email;
  hideAllAuthSubforms();
  confirmForm.style.display = "flex";
  confirmForm._codeField.value = "";
  confirmForm._codeField.focus();
  showAuthError("Мы отправили код на " + email + ". Введи его ниже (проверь и папку спам).");
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
        if (data.needsConfirmation) {
          showConfirmStep(data.email || email);
          return;
        }
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
      if (data.needsConfirmation) {
        showConfirmStep(data.email || email);
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

  let colorRgb = "185,232,166";
  if (remainingPct < 7) {
    colorRgb = "232,138,154";
  } else if (remainingPct < 15) {
    colorRgb = "232,214,138";
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
  label.textContent = `${used} / ${budget} токенов`;

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
  if (role === "assistant" && opts.usedSearch) {
    label.style.cssText = "display:flex;align-items:center;gap:4px;";
    const globeIcon = document.createElement("span");
    globeIcon.title = "использован поиск в интернете";
    globeIcon.style.cssText = "display:inline-flex;line-height:0;color:var(--text-dim);";
    globeIcon.innerHTML =
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z"/></svg>';
    const labelText = document.createElement("span");
    labelText.textContent = "Yari";
    label.appendChild(globeIcon);
    label.appendChild(labelText);
  } else {
    label.textContent = role === "assistant" ? "Yari" : "ты";
  }

  const { displayText, options: quickOptions } = role === "assistant" ? parseQuickOptions(text) : { displayText: text, options: [] };

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  const bubbleImages = opts.images && opts.images.length ? opts.images : (opts.image ? [opts.image] : []);
  if (bubbleImages.length === 1) {
    const img = document.createElement("img");
    img.src = bubbleImages[0];
    img.style.cssText = "max-width:100%;border-radius:10px;display:block;cursor:pointer;" + (displayText && !opts.isLongFile ? "margin-bottom:6px;" : "");
    img.addEventListener("click", () => openImageLightbox(bubbleImages[0]));
    bubble.appendChild(img);
  } else if (bubbleImages.length > 1) {
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(2,1fr);gap:4px;" + (displayText && !opts.isLongFile ? "margin-bottom:6px;" : "");
    bubbleImages.forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
      img.style.cssText = "width:100%;height:110px;object-fit:cover;border-radius:8px;display:block;cursor:pointer;";
      img.addEventListener("click", () => openImageLightbox(src));
      grid.appendChild(img);
    });
    bubble.appendChild(grid);
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
  if (role === "assistant" && displayText) {
    // Текст и код в ответе Яри рендерятся раздельно: обычный текст —
    // как обычно, длинный код/html — отдельной файловой карточкой рядом.
    splitMessageIntoSegments(displayText).forEach((seg) => {
      if (seg.type === "code" && shouldConvertToFile(seg.content)) {
        bubble.appendChild(createFileCard(seg.content, deriveFileTitle(seg.content)));
      } else if (seg.type === "code") {
        const codeWrap = document.createElement("div");
        codeWrap.className = "msg-markdown";
        const rawHtml = window.marked
          ? marked.parse("```" + (seg.lang || "") + "\n" + seg.content + "\n```", { breaks: true })
          : `<pre><code>${seg.content}</code></pre>`;
        codeWrap.innerHTML = window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;
        bubble.appendChild(codeWrap);
      } else {
        const textEl = document.createElement("div");
        if (window.marked) {
          textEl.className = "msg-markdown";
          const rawHtml = marked.parse(seg.content, { breaks: true });
          textEl.innerHTML = window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;
        } else {
          textEl.className = "msg-plain-text";
          textEl.textContent = seg.content;
        }
        bubble.appendChild(textEl);
      }
    });
  } else if (opts.isLongFile && displayText) {
    const card = createFileCard(displayText, opts.fileTitle || deriveFileTitle(displayText));
    bubble.appendChild(card);
  } else if (displayText) {
    const textEl = document.createElement("div");
    textEl.className = "msg-plain-text";
    textEl.textContent = displayText;
    bubble.appendChild(textEl);
  }

  if (opts.attachedFile) {
    const attachedCard = createFileCard(opts.attachedFile.content, opts.attachedFile.title);
    if (bubble.childNodes.length) attachedCard.style.marginTop = "8px";
    bubble.appendChild(attachedCard);
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

  const actionsBar = document.createElement("div");
  actionsBar.style.cssText = "display:flex;gap:2px;margin-top:4px;";

  const iconBtnStyle =
    "background:transparent;border:none;color:var(--text-dim);cursor:pointer;padding:4px 6px;border-radius:6px;line-height:0;";

  const copyMsgBtn = document.createElement("button");
  copyMsgBtn.type = "button";
  copyMsgBtn.title = tr("msgCopy");
  copyMsgBtn.style.cssText = iconBtnStyle;
  copyMsgBtn.innerHTML = copyIconSvg();
  let copyMsgResetTimer = null;
  copyMsgBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // буфер обмена недоступен — тихо промолчим
    }
    copyMsgBtn.innerHTML = checkIconSvg();
    if (copyMsgResetTimer) clearTimeout(copyMsgResetTimer);
    copyMsgResetTimer = setTimeout(() => {
      copyMsgBtn.innerHTML = copyIconSvg();
    }, 30000);
  });
  actionsBar.appendChild(copyMsgBtn);

  if (role === "assistant") {
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
    up.type = "button";
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
    down.type = "button";
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

    actionsBar.appendChild(up);
    actionsBar.appendChild(down);
  }

  wrap.appendChild(actionsBar);

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
    addMessageToDOM(m.role, m.content, {
      proactive: m.proactive,
      image: m.image,
      generatedImage: m.generatedImage,
      usedSearch: m.usedSearch,
      isLongFile: m.isLongFile,
     fileTitle: m.fileTitle,
      attachedFile: m.attachedFile,
      images: m.images,
    })
  );
}

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

function needsSearchHeuristic(text) {
  const t = (text || "").toLowerCase();
  return /(сегодня|сейчас|последн\w*|актуальн\w*|новост\w*|курс\s+(доллара|валют|рубля)|погод\w*|кто\s+(сейчас|такой|такая)|что\s+случилось|произошло|в\s+этом\s+году|202[4-9]|вышел\s+ли|когда\s+выйдет|расписание|цена\s+на)/.test(t);
}

// Если к сообщению прикреплён файл (вставленный длинный текст), модель получает его
// текст вместе с текстом сообщения; на экране файл остаётся отдельной карточкой.
function withFileText(m) {
  if (!m.attachedFile) return m;
  return { ...m, content: (m.content ? m.content + "\n\n" : "") + m.attachedFile.content };
}

// Читает ответ /chat-stream (строки JSON). Возвращает { reply, usedSearch } или { error }.
async function readChatStream(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let reply = "";
  let usedSearch = false;
  let error = null;
  let finished = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); } catch (e) { continue; }
      if (ev.d) reply += ev.d;
      else if (ev.error) error = ev.error;
      else if (ev.done) { finished = true; usedSearch = !!ev.usedSearch; }
    }
  }
  if (error) return { error };
  if (!finished && !reply) return { error: "поток оборвался" };
  return { reply, usedSearch };
}

async function sendMessage(text, attachedFile) {
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

  const imagesToSend = isLoggedIn() ? pendingImages.slice() : [];
  clearPendingImages();

  // Фото загружаем в хранилище: в сообщении храним ссылки, а не тяжёлые base64-картинки.
  let imageUrls = [];
  if (imagesToSend.length) {
    setStatus(true);
    try {
      imageUrls = await uploadPhotos(imagesToSend);
    } catch (err) {
      setStatus(false);
      pendingImages = imagesToSend;
      renderAttachPreviews();
      input.value = text;
      addMessageToDOM("assistant", "не получилось загрузить фото: " + ((err && err.message) || "ошибка сети") + ". попробуй ещё раз.");
      return;
    }
    setStatus(false);
  }

// Прикреплённый файл остаётся отдельным блоком: текст, который человек пишет
  // сам, в него не вливается. Одиночное очень длинное сообщение, как и раньше,
  // превращается в файл.
  const isLongFile = !attachedFile && shouldConvertToFile(text);
  const fileTitle = isLongFile ? deriveFileTitle(text) : null;
  const attachedFileData = attachedFile ? { content: attachedFile.content, title: attachedFile.title } : null;

  c.messages.push({
    role: "user",
    content: text,
    images: imageUrls.length ? imageUrls : undefined,
    isLongFile,
    fileTitle,
    attachedFile: attachedFileData || undefined,
  });
  let titleChanged = false;
  if (c.messages.length === 1) {
    c.title = (fileTitle || (attachedFileData && attachedFileData.title) || text).slice(0, 30) || "фото";
    titleChanged = true;
  }

  if (isLoggedIn()) {
    await persistChatToServer(c, titleChanged);
  } else {
    saveStore(store);
  }
  incrementDailyUsage(limitKey);

  addMessageToDOM("user", text, { images: imageUrls, isLongFile, fileTitle, attachedFile: attachedFileData });
  renderChatsPanel();

  const typingEl = document.createElement("div");
  typingEl.className = "msg msg-bot";

  const typingLabel = document.createElement("div");
  typingLabel.className = "msg-label";
  typingLabel.textContent = "Yari";

  const typingBubble = document.createElement("div");
  typingBubble.className = "msg-bubble typing-indicator";

  if (needsSearchHeuristic(text)) {
    typingBubble.style.cssText = "display:flex;align-items:center;gap:6px;";
    typingBubble.innerHTML =
      '<span style="display:inline-flex;line-height:0;" class="search-indicator-icon">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z"/></svg></span>' +
      '<span class="search-indicator-text">Ищет в интернете</span>' +
      '<span class="typing-dots"><span></span><span></span><span></span></span>';
  } else {
    typingBubble.innerHTML =
      '<span class="typing-dots"><span></span><span></span><span></span></span>';
  }

  typingEl.appendChild(typingLabel);
  typingEl.appendChild(typingBubble);
  chat.appendChild(typingEl);
  chat.scrollTop = chat.scrollHeight;

  setStatus(true);

  try {
    const res = await fetch(`${API_BASE}/chat-stream`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
        ...(isLoggedIn() ? {} : { "x-yari-guest": getGuestId() }),
      }),
      body: JSON.stringify({
        chatId: c.id,
        reactionNote: pendingReactionNote,
        messages: c.messages.map(withFileText).map((m, idx, arr) => {
          const isLast = idx === arr.length - 1;
          const urls = Array.isArray(m.images) ? m.images : [];
          // Старые сообщения с одним фото хранят его как base64 в m.image.
          const legacy = m.image ? [m.image] : [];
          if ((urls.length || legacy.length) && isLast) {
            const parts = [];
            if (m.content) parts.push({ type: "text", text: m.content });
            // Ссылки на фото — отдельным текстом, чтобы Яри могла использовать их (например, на сайте).
            if (urls.length) parts.push({ type: "text", text: "[Фото пользователя, ссылки: " + urls.join(" ") + "]" });
            [...urls, ...legacy].forEach((u) => parts.push({ type: "image_url", image_url: { url: u } }));
            return { role: m.role, content: parts };
          }
          if (urls.length || legacy.length) {
            const note = urls.length ? " [фото: " + urls.join(" ") + "]" : " [фото]";
            return { role: m.role, content: (m.content || "") + note };
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

    const data = await readChatStream(res);
    typingEl.remove();
    refreshMyUsage();
    if (data.error) {
      addMessageToDOM("assistant", `у меня тут что-то с соединением: ${data.error}. попробуй ещё раз.`);
      return;
    }

    if (data.reply) {
      const replyIsLongFile = shouldConvertToFile(data.reply);
      const replyFileTitle = replyIsLongFile ? deriveFileTitle(data.reply) : null;

      c.messages.push({
        role: "assistant",
        content: data.reply,
        usedSearch: data.usedSearch || false,
        isLongFile: replyIsLongFile,
        fileTitle: replyFileTitle,
      });
      c.nextProactiveAt = Date.now() + randomGapMs();

      if (isLoggedIn()) {
        updateChatMeta(c.id, { nextProactiveAt: c.nextProactiveAt });
        await persistChatToServer(c, false);
      } else {
        saveStore(store);
      }
      addMessageToDOM("assistant", data.reply, {
        usedSearch: data.usedSearch,
        isLongFile: replyIsLongFile,
        fileTitle: replyFileTitle,
      });
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
  if (!text && !pendingImages.length && !pendingFile) return;

  if (imageMode) {
    if (!text) return;
    if (imageMode === "edit" && !pendingImages.length) {
      addMessageToDOM("assistant", "пожалуйста, добавьте изображение");
      return;
    }
    const mode = imageMode;
    const sourceImage = pendingImages[0];
    input.value = "";
    input.style.height = "auto";
    setImageMode(null);
    clearPendingImages();
    await handleGenerateImageFlow(text, mode, sourceImage);
    return;
  }

  input.value = "";
  input.style.height = "auto";

  if (text) {
    const unlocked = await tryUnlock(text);
    if (unlocked) return;

    const redeemed = await tryRedeemCode(text);
    if (redeemed) return;
  }

  const attachedFile = pendingFile;
  pendingFile = null;
  if (filePreviewBarEl) filePreviewBarEl.style.display = "none";

  sendMessage(text, attachedFile);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
});

let pendingReactionNote = null;

const LANG_CHOSEN_KEY = "yari_lang_chosen";

function showLanguageWelcomeIfNeeded() {
  if (isLoggedIn()) return;
  if (localStorage.getItem(LANG_CHOSEN_KEY)) return;
  const c = getActiveChat();
  if (c && c.messages.length > 0) return;

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
  updateAttachVisibility();
  updateImageToolsVisibility();

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
