const state = {
  token: "",
  user: null,
  aiConfigured: false,
  model: "",
  baseUrl: "",
  counts: { material_count: 0, notice_count: 0, product_on_sale: 0, open_reports: 0 },
  statusError: false,
  materials: [],
  notices: [],
  ppt: null,
  chatSessions: [],
  chatSessionId: null,
  chatFeature: 0,
  messages: [],
  history: [],
  currentPost: null,
  currentProduct: null,
  sending: false,
  marketTab: "browse",
  marketProducts: [],
  mineProducts: [],
  conversations: [],
  activeConversation: null,
  chatTimer: null,
  reportTarget: null,
  imageContext: null,
  publish: { mode: "create", id: null, images: [], preview: null },
  adminTab: "materials",
  myTab: "history",
  myDashboard: null,
  myLoading: false,
  myError: "",
  publicPosts: [],
  publicLoading: false,
  publicError: "",
  publicOpenComments: new Set(),
};

const els = {};
let messageSeq = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function nextId() {
  messageSeq += 1;
  return `m${Date.now().toString(36)}${messageSeq}`;
}

function makeToken() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  const bytes = new Uint8Array(16);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getToken() {
  let token = localStorage.getItem("xy_user_token");
  if (!token || !/^[A-Za-z0-9_-]{16,80}$/.test(token)) {
    token = makeToken();
    localStorage.setItem("xy_user_token", token);
  }
  return token;
}

function chatStorageKey() {
  return `xy_chat_v2_${state.token}`;
}

function cacheElements() {
  const ids = [
    "aiBadge", "aiBadgeText", "identityBtn", "userName", "openMarket", "openAdmin", "openSettings", "marketCount",
    "pptBar", "pptBarName", "pptBarMeta", "dropPptBtn", "notices", "messages", "composer", "input", "sendBtn",
    "composerHint", "pptUploadBtn", "pptFile", "sideMatCount", "sideNoticeCount", "matPreview", "toast",
    "adminDialog", "adminTabs", "adminPanelMaterials", "adminPanelNotices", "adminPanelReports",
    "materialForm", "matName", "matContent", "matSubmit", "matFormMsg", "materialList", "matListCount",
    "noticeForm", "noticeTitle", "noticeSource", "noticePublished", "noticeEvent", "noticeDeadline",
    "noticeBody", "noticeFormMsg", "noticeSubmit", "noticeList", "noticeListCount", "reportList",
    "marketDialog", "marketTabs", "marketPanelBrowse", "marketPanelMine", "marketPanelChats",
    "openPublishBtn", "marketSearchInput", "marketSearchBtn", "marketGrid", "mineGrid", "conversationList",
    "productDialog", "productDetail", "publishDialog", "publishTitle", "publishFormStep", "publishPreviewStep",
    "pubName", "pubPrice", "pubCondition", "pubDescription", "pubAddImage", "pubImageMsg", "pubImageStrip",
    "publishMsg", "publishNext", "publishBack", "publishConfirm", "publishPreviewBody", "publishImageFile",
    "chatDialog", "chatTitle", "chatThread", "chatForm", "chatInput", "chatSendBtn",
    "reportDialog", "reportTarget", "reportReason", "reportMsg", "reportSubmit",
    "identityDialog", "identityName", "identityMsg", "identitySave",
    "myPage", "myTabs", "myContent", "myName", "myIdentityLine", "myEditName", "myPublishBtn", "myBack",
    "myCountHistory", "myCountProducts", "myCountWanted", "myCountPosts", "myCountChats",
    "publicFeedPage", "publicFeedBack", "publicPostCreate", "publicFeedRefresh", "publicPostCount", "publicPostList", "publicPostAi",
    "publicPostDialog", "publicPostType", "publicPostContentTitle", "publicPostBody", "publicPostMsg", "publicPostConfirm",
    "settingsDialog", "settingsForm", "settingKey", "settingBase", "settingModel", "settingsMsg",
    "settingsStatus", "settingsDot", "settingsSave", "clearKeyBtn",
  ];
  ids.forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

async function api(path, options = {}) {
  if(window.DESIGN_PREVIEW) throw new Error("在线版为页面设计预览。请启动本地完整版以使用 AI、集市数据和私聊。");
  const init = { ...options };
  init.headers = {
    "Content-Type": "application/json",
    "X-User-Token": state.token,
    ...(options.headers || {}),
  };
  let response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    const failure = new Error("无法连接本地服务，请确认“西邮有问”正在运行。");
    failure.code = "network";
    throw failure;
  }
  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }
  if (response.status === 401) { location.replace("/login"); }
  if (!response.ok) {
    const failure = new Error(data.message || `请求失败（HTTP ${response.status}）`);
    failure.code = data.error || "http_error";
    throw failure;
  }
  return data;
}

function bindEvents() {
  els.identityBtn.addEventListener("click", openMyPage);
  els.openMarket.addEventListener("click", openMarket);

  els.pptUploadBtn.addEventListener("click", () => els.pptFile.click());
  els.pptFile.addEventListener("change", handlePptFile);
  els.dropPptBtn.addEventListener("click", dropPpt);
  els.composer.addEventListener("submit", (event) => {
    event.preventDefault();
    submitInput();
  });
  els.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submitInput();
    }
  });
  els.input.addEventListener("input", autoResize);

  document.querySelectorAll("[data-market-tab]").forEach((button) => {
    button.addEventListener("click", () => switchMarketTab(button.dataset.marketTab));
  });
  document.querySelectorAll("[data-my-tab]").forEach((button) => {
    button.addEventListener("click", () => switchMyTab(button.dataset.myTab));
  });
  if (els.myEditName) els.myEditName.addEventListener("click", openIdentity);
  if (els.myPublishBtn) els.myPublishBtn.addEventListener("click", () => openPublishDialog("create", null));
  if (els.myBack) els.myBack.addEventListener("click", () => {
    if (typeof goHome === "function") goHome();
  });
  if (els.publicFeedBack) els.publicFeedBack.addEventListener("click", () => {
    if (typeof goHome === "function") goHome();
  });
  if (els.publicPostCreate) els.publicPostCreate.addEventListener("click", () => openPublicPostComposer());
  if (els.publicPostAi) els.publicPostAi.addEventListener("click", () => {
    if (typeof window.openPostWriter === "function") window.openPostWriter();
  });
  if (els.publicFeedRefresh) els.publicFeedRefresh.addEventListener("click", () => loadPublicPosts());
  if (els.publicPostConfirm) els.publicPostConfirm.addEventListener("click", submitPublicPost);
  document.querySelectorAll("[data-my-stat]").forEach((button) => {
    button.addEventListener("click", () => switchMyTab(button.dataset.myStat));
  });

  if (els.materialForm) els.materialForm.addEventListener("submit", addMaterial);
  if (els.noticeForm) els.noticeForm.addEventListener("submit", addNotice);
  els.openPublishBtn.addEventListener("click", () => openPublishDialog("create", null));
  els.marketSearchBtn.addEventListener("click", searchMarket);
  els.marketSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchMarket();
    }
  });
  els.pubAddImage.addEventListener("click", () => {
    state.imageContext = "publish";
    els.publishImageFile.click();
  });
  els.publishImageFile.addEventListener("change", handleImageFile);
  els.publishNext.addEventListener("click", showPublishPreview);
  els.publishBack.addEventListener("click", () => {
    els.publishPreviewStep.classList.add("hidden");
    els.publishFormStep.classList.remove("hidden");
  });
  els.publishConfirm.addEventListener("click", confirmPublish);
  els.chatForm.addEventListener("submit", sendChatMessage);
  els.reportSubmit.addEventListener("click", submitReport);
  els.identitySave.addEventListener("click", saveIdentity);
  if (els.settingsForm) els.settingsForm.addEventListener("submit", saveSettings);
  if (els.clearKeyBtn) els.clearKeyBtn.addEventListener("click", clearKey);

  [els.adminDialog, els.marketDialog, els.productDialog, els.publishDialog, els.reportDialog, els.identityDialog, els.publicPostDialog, els.settingsDialog].filter(Boolean).forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
  els.chatDialog.addEventListener("close", () => {
    stopChatPolling();
    if (els.myPage && !els.myPage.hidden) loadMyDashboard();
  });
  els.chatDialog.addEventListener("click", (event) => {
    if (event.target === els.chatDialog) els.chatDialog.close();
  });
  [els.marketDialog, els.productDialog, els.publishDialog].filter(Boolean).forEach((dialog) => {
    dialog.addEventListener("close", () => refreshMyIfOpen());
  });

  document.addEventListener("click", handleGlobalClick);
}

function handleGlobalClick(event) {
  const actionNode = event.target.closest("[data-action]");
  if (actionNode) {
    const action = actionNode.dataset.action;

    if (action === "market") openMarket();
    if (action === "ppt") els.pptFile.click();
  }
  const closeNode = event.target.closest("[data-close]");
  if (closeNode) {
    const dialog = closeNode.closest("dialog");
    if (dialog) dialog.close();
  }
  const fillNode = event.target.closest("[data-fill]");
  if (fillNode) {
    els.input.value = fillNode.dataset.fill;
    autoResize();
    els.input.focus();
  }
  const pickPpt = event.target.closest("[data-pick-ppt]");
  if (pickPpt) els.pptFile.click();
  const copyNode = event.target.closest("[data-copy-msg]");
  if (copyNode) copyMessage(copyNode.dataset.copyMsg, copyNode);
  const postMarket = event.target.closest("[data-post-market]");
  if (postMarket) openPostToMarket(postMarket.dataset.postMarket);
  const confirmNode = event.target.closest("[data-confirm-product]");
  if (confirmNode) publishChatProduct(confirmNode);
  const addImage = event.target.closest("[data-add-product-image]");
  if (addImage) {
    state.imageContext = "chat";
    els.publishImageFile.click();
  }
  const retryNode = event.target.closest("[data-retry]");
  if (retryNode) retryMessage(retryNode.dataset.retry);
  const productOpen = event.target.closest("[data-product-open]");
  if (productOpen) openProduct(productOpen.dataset.productOpen);
  const productContact = event.target.closest("[data-product-contact]");
  if (productContact) contactSeller(productContact.dataset.productContact);
  const productReport = event.target.closest("[data-product-report]");
  if (productReport) openReport("product", productReport.dataset.productReport, "举报这件商品");
  const materialDelete = event.target.closest("[data-material-delete]");
  if (materialDelete) deleteMaterial(materialDelete.dataset.materialDelete);
  const noticeDelete = event.target.closest("[data-notice-delete]");
  if (noticeDelete) deleteNotice(noticeDelete.dataset.noticeDelete);
  const reportAction = event.target.closest("[data-report-action]");
  if (reportAction) updateReport(reportAction.dataset.reportAction, reportAction.dataset.status, reportAction.dataset.takeDown === "1");
  const messageReport = event.target.closest("[data-message-report]");
  if (messageReport) openReport("message", messageReport.dataset.messageReport, "举报这条私聊消息");
}

function autoResize() {
  els.input.style.height = "auto";
  els.input.style.height = `${Math.min(els.input.scrollHeight, 150)}px`;
}

function toast(text) {
  els.toast.textContent = text;
  els.toast.classList.remove("hidden");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.add("hidden"), 2400);
}

async function init() {
  const loginResponse = await fetch("/api/me");
  if (!loginResponse.ok) { location.replace("/login"); return; }
  const loginData = await loginResponse.json();
  cacheElements();
  state.token = loginData.user.id;
  state.user = loginData.user;
  bindEvents();
  restoreChat();
  renderAll();
  try {
    const data = await api("/api/me");
    state.user = data.user;
  } catch (error) {
    state.user = { id: "", name: "同学" };
  }
  await refreshStatus();
  state.materials = [];
  renderAll();
  const params = new URLSearchParams(window.location.search);
  const myTab = params.get("tab");
  if (["history", "products", "wanted", "posts", "chats"].includes(myTab)) {
    state.myTab = myTab;
  }
  if (params.get("my") === "1") {
    window.setTimeout(openMyPage, 300);
  }
  if (params.get("feed") === "1") {
    window.setTimeout(openPublicFeed, 300);
  }
}

function conversationStorageKey() { return `xy_conversations_v1_${state.token}`; }
function loadConversation(session, feature = 0) {
  state.chatSessionId = session?.id || null;
  state.chatFeature = session?.feature ?? feature;
  state.messages = (session?.messages || []).filter(m => m && m.status !== "pending");
  state.history = session?.history || [];
  state.ppt = session?.ppt || null;
  state.currentPost = session?.currentPost || null;
  state.currentProduct = session?.currentProduct || null;
  els.input.value = session?.draft || "";
}
function restoreChat() {
  try {
    const stored = JSON.parse(localStorage.getItem(conversationStorageKey()) || "null");
    state.chatSessions = Array.isArray(stored) ? stored.filter(s => s && s.id && Array.isArray(s.messages) && Array.isArray(s.history) && Number.isInteger(s.feature) && s.feature >= 0 && s.feature < 4) : [];
    if (stored === null) {
      const legacy = JSON.parse(localStorage.getItem(chatStorageKey()) || "null");
      if (legacy && Array.isArray(legacy.messages) && legacy.messages.length) {
        state.chatSessions.push({...legacy, history: legacy.history || [], id: nextId(), feature: 0, updatedAt: Date.now()});
      }
    }
    loadConversation(state.chatSessions.find(s => s.feature === 0));
    saveChat();
  } catch (error) { state.chatSessions = []; loadConversation(null); }
}
function saveChat() {
  if (state.messages.length || state.ppt || els.input.value.trim()) {
    if (!state.chatSessionId) state.chatSessionId = nextId();
    const session = JSON.parse(JSON.stringify({
      id: state.chatSessionId, feature: state.chatFeature, updatedAt: Date.now(),
      messages: state.messages.slice(-60), history: state.history.slice(-16),
      ppt: state.ppt, currentPost: state.currentPost, currentProduct: state.currentProduct,
      draft: els.input.value,
    }));
    state.chatSessions = [session, ...state.chatSessions.filter(s => s.id !== session.id)];
  }
  try { localStorage.setItem(conversationStorageKey(), JSON.stringify(state.chatSessions)); }
  catch (error) { toast("浏览器存储空间不足，本次对话暂未保存，请勿关闭页面。"); }
  renderSide();
}
function switchConversationFeature(feature) {
  if (state.chatFeature === feature) return;
  saveChat();
  loadConversation(state.chatSessions.find(s => s.feature === feature), feature);
  renderSide();
}
function startNewConversation() {
  if (state.sending) { toast("请等待当前回答完成后再新建对话"); return; }
  saveChat();
  loadConversation(null, state.chatFeature);
  renderMessages(); renderPptBar(); renderSide(); autoResize(); els.input.focus();
}
function openSavedConversation(id) {
  if (state.sending) { toast("请等待当前回答完成后再切换对话"); return; }
  const session = state.chatSessions.find(s => s.id === id);
  if (!session) return;
  saveChat();
  window.enterFeature(session.feature);
  loadConversation(session);
  renderMessages(); renderPptBar(); renderSide(); autoResize();
}

async function refreshStatus() {
  try {
    const data = await api("/api/status");
    state.aiConfigured = Boolean(data.ai_configured);
    state.model = data.model || "";
    state.baseUrl = data.base_url || "";
    state.counts = {
      material_count: Number(data.material_count) || 0,
      notice_count: Number(data.notice_count) || 0,
      product_on_sale: Number(data.product_on_sale) || 0,
      open_reports: Number(data.open_reports) || 0,
    };
    state.statusError = false;
  } catch (error) {
    state.statusError = true;
  }
  renderStatus();
  renderNotices();
  renderSide();
  renderPptBar();
  updateSettingsStatus();
}

async function refreshMaterials() {
  state.materials = [];
  renderSide();
}

async function loadNotices() {
  try {
    const data = await api("/api/notices");
    state.notices = Array.isArray(data.notices) ? data.notices : [];
  } catch (error) {
    state.notices = [];
  }
  renderNoticeAdminList();
}

function renderAll() {
  renderStatus();
  renderNotices();
  renderSide();
  renderPptBar();
  renderMessages();
  renderMaterialList();
  renderNoticeAdminList();
  renderPptBar();
  updateSettingsStatus();
}

function renderStatus() {
  if(window.DESIGN_PREVIEW){els.aiBadgeText.textContent="设计预览";els.userName.textContent="同学";return;}
  els.userName.textContent = state.user?.name || "同学";
  els.marketCount.textContent = String(state.counts.product_on_sale || 0);
  if (state.statusError) {
    els.aiBadge.className = "ai-badge off";
    els.aiBadgeText.textContent = "连接失败";
    return;
  }
  if (state.aiConfigured) {
    els.aiBadge.className = "ai-badge on";
    els.aiBadgeText.textContent = "AI 已接通";
  } else {
    els.aiBadge.className = "ai-badge off";
    els.aiBadgeText.textContent = "AI 未接通";
  }
}

function renderNotices() {
  els.notices.innerHTML = "";
  if(window.DESIGN_PREVIEW){const n=el("div","notice");n.appendChild(el("p",null,"当前为界面设计预览。AI 回答、课件解析、集市数据和私聊请在本地完整版中使用。"));els.notices.appendChild(n);return;}
  if (state.statusError) {
    const notice = el("div", "notice");
    notice.appendChild(el("p", null, "连不上本地服务。请确认运行“西邮有问”的终端窗口还开着，然后刷新页面。"));
    els.notices.appendChild(notice);
    return;
  }
  if (!state.aiConfigured) {
    const notice = el("div", "notice");
    notice.appendChild(
      el("p", null, "AI 尚未接通：聊天自动判断、课件提问、校园情报和帖子创作暂不可用；集市和私聊可以直接使用。请联系维护者在管理端配置 AI 密钥。"),
    );
    const button = el("button", null, "维护入口");
    button.type = "button";
    button.addEventListener("click", () => {
      window.location.href = "/admin";
    });
    notice.appendChild(button);
    els.notices.appendChild(notice);
  }
  if ((state.counts.material_count || 0) === 0) {
    const notice = el("div", "notice slate");
    notice.appendChild(el("p", null, "学校资料库还是空的。请联系维护者在管理端添加资料，我才能依据资料回答校园问题。"));
    const button = el("button", null, "维护入口");
    button.type = "button";
    button.addEventListener("click", () => {
      window.location.href = "/admin";
    });
    notice.appendChild(button);
    els.notices.appendChild(notice);
  }
}

function renderSide() {
  const list = document.getElementById("conversationHistory");
  if (!list) return;
  list.replaceChildren();
  if (!state.chatSessions.length) { list.appendChild(el("p", "history-empty", "还没有对话记录，开始你的第一问吧。")); return; }
  const names = ["校园问答", "课件解读", "校园情报", "帖子创作"];
  [...state.chatSessions].sort((a,b) => b.updatedAt - a.updatedAt).forEach(session => {
    const button = el("button", "history-item" + (session.id === state.chatSessionId ? " active" : ""));
    button.type = "button";
    if (session.id === state.chatSessionId) button.setAttribute("aria-current", "true");
    const title = session.messages.find(m => m.role === "user")?.text || session.ppt?.filename || session.draft || "新对话";
    button.appendChild(el("strong", null, title.slice(0, 60)));
    const date = new Date(session.updatedAt).toLocaleString("zh-CN", {month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"});
    button.appendChild(el("small", null, `${names[session.feature]} · ${date}`));
    button.onclick = () => openSavedConversation(session.id);
    list.appendChild(button);
  });
}

function renderPptBar() {
  if (!state.ppt) {
    els.pptBar.classList.add("hidden");
    return;
  }
  els.pptBar.classList.remove("hidden");
  els.pptBarName.textContent = state.ppt.filename || "课件";
  const textPages = (state.ppt.text_pages || []).length;
  const images = (state.ppt.image_pages || []).length;
  els.pptBarMeta.textContent = `${state.ppt.slide_count || 0} 页 · 提取文字 ${textPages} 页 · 含图片 ${images} 页 · 图片和图表不会假装识别`;
}

function dropPpt() {
  state.ppt = null;
  saveChat();
  renderPptBar();
  toast("已结束课件提问，可以继续问其他问题。");
}

function emptyState() {
  if (window.featureEmptyState) return window.featureEmptyState();
  const wrap = el('div','empty');
  wrap.appendChild(el('h2',null,'欢迎来到西邮有问'));
  return wrap;
}

function renderMessages() {
  els.messages.innerHTML = "";
  if (state.messages.length === 0) {
    els.messages.appendChild(emptyState());
    return;
  }
  state.messages.forEach((message) => els.messages.appendChild(renderMessage(message)));
  requestAnimationFrame(() => {
    els.messages.scrollTop = els.messages.scrollHeight;
  });
}

function renderMessage(message) {
  const isUser = message.role === "user";
  const row = el("div", `msg ${isUser ? "user" : "assistant"}`);
  row.appendChild(el("div", "avatar", isUser ? "我" : "问"));
  const bubble = el("div", "bubble");
  if (message.status === "pending") {
    const typing = el("span", "typing");
    typing.appendChild(document.createTextNode(message.pendingLabel || "正在判断并处理"));
    typing.appendChild(el("i"));
    typing.appendChild(el("i"));
    typing.appendChild(el("i"));
    bubble.appendChild(typing);
  } else if (message.status === "error") {
    const card = el("div", "error-card");
    card.appendChild(el("strong", null, "这次没有成功"));
    card.appendChild(el("p", null, message.error || "未知错误，请重试。"));
    if (message.retry) {
      const retry = el("button", null, "重试");
      retry.type = "button";
      retry.dataset.retry = message.id;
      card.appendChild(retry);
    }
    bubble.appendChild(card);
  } else if (isUser) {
    bubble.textContent = message.text;
  } else if (message.data) {
    renderAssistantData(bubble, message);
  }
  row.appendChild(bubble);
  return row;
}

function renderAssistantData(container, message) {
  const data = message.data;
  switch (data.kind) {
    case "qa":
      renderQa(container, data);
      break;
    case "ppt":
      renderPptAnswer(container, data);
      break;
    case "ppt_uploaded":
      renderPptUploaded(container, data);
      break;
    case "intel":
      renderIntel(container, data);
      break;
    case "post":
      renderPost(container, data, message.id);
      break;
    case "post_clarify":
      container.appendChild(el("span", "tag clarify", "需要先补充信息"));
      container.appendChild(el("div", "answer-text", data.question || ""));
      break;
    case "no_materials":
      container.appendChild(el("span", "tag no_materials", "缺少资料"));
      container.appendChild(el("div", "answer-text", data.answer || ""));
      appendActionButton(container, "去添加学校资料", "admin");
      break;
    case "product_preview":
      renderProductPreview(container, data, message.id);
      break;
    case "product_search":
      renderProductSearch(container, data);
      break;
    case "product_published":
      container.appendChild(el("span", "tag answer", "已发布到集市"));
      container.appendChild(el("div", "answer-text", "商品已经公开发布，其他同学现在可以在集市里找到它。"));
      container.appendChild(productCard(data.product, { compact: true }));
      break;
    case "chat":
      container.appendChild(el("div", "answer-text", data.answer || ""));
      break;
    default:
      container.appendChild(el("div", "answer-text", data.answer || "处理完成。"));
  }
}

function appendActionButton(container, text, action) {
  const wrap = el("div", "inline-action");
  if (action === "admin") {
    const link = el("a", "link-btn", text);
    link.href = "/admin";
    wrap.appendChild(link);
  } else {
    const button = el("button", "link-btn", text);
    button.type = "button";
    button.dataset.action = action;
    wrap.appendChild(button);
  }
  container.appendChild(wrap);
}

function renderQa(container, data) {
  const labels = {
    answer: "依据资料回答",
    clarify: "需要先补充信息",
    not_found: "资料中未找到",
    conflict: "资料存在冲突",
    unverified: "来源未核对",
  };
  container.appendChild(el("span", `tag ${data.type || "answer"}`, labels[data.type] || "回答"));
  container.appendChild(el("div", "answer-text", data.answer || ""));
  if (Array.isArray(data.citations) && data.citations.length > 0) {
    const sources = el("div", "sources");
    sources.appendChild(el("div", "sources-title", "依据资料 · 原文已核对"));
    data.citations.forEach((citation) => {
      const card = el("div", "source");
      const head = el("div", "source-head");
      head.appendChild(el("span", null, `《${citation.material_name}》`));
      if (citation.verified) head.appendChild(el("span", "source-verified", "✓ 原文核对"));
      card.appendChild(head);
      card.appendChild(el("blockquote", null, citation.quote || ""));
      sources.appendChild(card);
    });
    container.appendChild(sources);
  }
  if (data.warning) container.appendChild(el("div", "verify-warn", data.warning));
}

function renderPptUploaded(container, data) {
  const ppt = data.ppt || {};
  container.appendChild(el("span", "tag ppt", "课件已读取"));
  const card = el("div", "ppt-card");
  card.appendChild(el("strong", null, ppt.filename || "PPTX 课件"));
  const meta = el("div", "ppt-meta");
  meta.appendChild(el("span", null, `${ppt.slide_count || 0} 页`));
  meta.appendChild(el("span", null, `有文字 ${(ppt.text_pages || []).length} 页`));
  meta.appendChild(el("span", null, `含图片 ${(ppt.image_pages || []).length} 页`));
  meta.appendChild(el("span", null, `含图表 ${(ppt.chart_pages || []).length} 页`));
  card.appendChild(meta);
  if ((ppt.empty_pages || []).length > 0) {
    card.appendChild(el("p", "ppt-note", `第 ${ppt.empty_pages.join("、")} 页没有提取到文字。`));
  }
  (ppt.caveats || []).forEach((item) => card.appendChild(el("p", "ppt-note", item)));
  card.appendChild(
    el("p", "ppt-note", "现在可以直接问：主要讲什么、按章节理清思路、解释某一页，或整理复习提纲。"),
  );
  container.appendChild(card);
}

function renderPptAnswer(container, data) {
  container.appendChild(el("span", "tag ppt", "课件解读"));
  container.appendChild(el("div", "answer-text", data.answer || ""));
  if (Array.isArray(data.pages) && data.pages.length > 0) {
    const pages = el("div", "page-chips");
    pages.appendChild(el("span", "page-chips-label", "对照页码"));
    data.pages.forEach((page) => pages.appendChild(el("span", "page-chip", `第 ${page} 页`)));
    container.appendChild(pages);
  }
  if (data.unreadable_note) container.appendChild(el("div", "verify-warn", data.unreadable_note));
}

function renderIntel(container, data) {
  container.appendChild(el("span", "tag intel", "校园情报"));
  container.appendChild(el("div", "answer-text", data.answer || ""));
  (data.notices || []).forEach((notice) => container.appendChild(noticeCard(notice)));
  if (data.warning) container.appendChild(el("div", "verify-warn", data.warning));
}

function noticeCard(notice) {
  const card = el("article", "intel-card");
  const head = el("div", "intel-head");
  head.appendChild(el("h4", null, notice.title || "通知"));
  head.appendChild(el("span", `status-pill ${notice.status_key || "unknown"}`, notice.status || "时间待确认"));
  card.appendChild(head);
  const meta = el("div", "intel-meta");
  meta.appendChild(el("span", null, `来源：${notice.source || "未注明"}`));
  meta.appendChild(el("span", null, `发布：${notice.published_at || "未注明"}`));
  if (notice.event_at) meta.appendChild(el("span", null, `活动：${notice.event_at}`));
  if (notice.deadline_at) meta.appendChild(el("span", null, `报名截止：${notice.deadline_at}`));
  card.appendChild(meta);
  if (notice.body) {
    const details = el("details", "intel-details");
    details.appendChild(el("summary", null, "查看通知原文"));
    details.appendChild(el("p", null, notice.body));
    card.appendChild(details);
  }
  return card;
}

function renderPost(container, data, messageId) {
  container.appendChild(el("span", "tag post", "帖子草稿 · 可复制"));
  const card = el("div", "post-card");
  const head = el("div", "post-head");
  head.appendChild(el("span", null, "尚未公开发布"));
  head.appendChild(el("span", null, "可直接复制到校园墙或群聊"));
  card.appendChild(head);
  card.appendChild(el("h3", "post-title", data.title || "校园帖子草稿"));
  card.appendChild(el("div", "post-body", data.body || ""));
  if (Array.isArray(data.missing) && data.missing.length > 0) {
    const missing = el("div", "missing");
    missing.appendChild(el("strong", null, "还需要你补充这些信息："));
    const list = el("div", "missing-list");
    data.missing.forEach((item) => list.appendChild(el("span", null, item)));
    missing.appendChild(list);
    card.appendChild(missing);
  }
  if (data.caution) card.appendChild(el("div", "verify-warn", data.caution));
  if (data.privacy_note) card.appendChild(el("div", "verify-warn", data.privacy_note));
  const actions = el("div", "post-actions");
  const copy = el("button", "copy-btn", "复制全文");
  copy.type = "button";
  copy.dataset.copyMsg = messageId;
  actions.appendChild(copy);
  const publicBtn = el("button", "ghost-btn", "发布到公共区");
  publicBtn.type = "button";
  publicBtn.addEventListener("click", () => openPublicPostComposer({
    title: data.title || "",
    body: data.body || "",
    post_type: data.post_type || "",
  }));
  actions.appendChild(publicBtn);
  const saleText = `${data.post_type || ""}${data.title || ""}`;
  if (/闲置|转让|出售|卖/.test(saleText)) {
    const market = el("button", "ghost-btn", "发布到校园集市");
    market.type = "button";
    market.dataset.postMarket = messageId;
    actions.appendChild(market);
  }
  card.appendChild(actions);
  container.appendChild(card);
  container.appendChild(el("p", "follow-hint", "想修改就直接说，例如“短一点”“别太正式”“标题醒目一点”“不要表情”。"));
}

function renderProductPreview(container, data, messageId) {
  container.appendChild(el("span", "tag product", data.published ? "商品已发布" : "商品发布预览"));
  const draft = data.draft || {};
  const card = el("div", "product-preview");
  const head = el("div", "product-preview-head");
  head.appendChild(el("strong", null, draft.name || "物品名称待补充"));
  head.appendChild(el("span", "price-tag", draft.price ? `¥${formatPrice(draft.price)}` : "价格待补充"));
  card.appendChild(head);
  const meta = el("div", "product-preview-meta");
  meta.appendChild(el("span", null, `成色：${draft.condition || "待补充"}`));
  meta.appendChild(el("span", null, `图片：${(draft.images || []).length} 张（可选）`));
  card.appendChild(meta);
  card.appendChild(el("p", "product-preview-desc", draft.description || "说明待补充"));
  const images = el("div", "image-strip");
  (draft.images || []).forEach((url) => {
    const thumb = el("div", "image-thumb");
    const img = el("img");
    img.src = url;
    img.alt = "商品图片";
    thumb.appendChild(img);
    images.appendChild(thumb);
  });
  card.appendChild(images);
  if (Array.isArray(data.missing) && data.missing.length > 0) {
    const missing = el("div", "missing");
    missing.appendChild(el("strong", null, `发布前还差：${data.missing.map((item) => item.label).join("、")}`));
    if (data.question) missing.appendChild(el("p", null, data.question));
    card.appendChild(missing);
  }
  if (data.privacy_note) card.appendChild(el("div", "verify-warn", data.privacy_note));
  const actions = el("div", "preview-actions");
  if (data.published) {
    actions.appendChild(el("span", "preview-wait", "已发布到集市，可在“集市”中查看。"));
    card.appendChild(actions);
    card.appendChild(el("p", "product-policy", "商品已经公开，其他同学可以在集市里找到它。"));
    container.appendChild(card);
    return;
  }
  const addImage = el("button", "ghost-btn", "添加图片（可选）");
  addImage.type = "button";
  addImage.dataset.addProductImage = messageId;
  actions.appendChild(addImage);
  if (data.can_publish) {
    const confirm = el("button", "primary-btn", "确认发布");
    confirm.type = "button";
    confirm.dataset.confirmProduct = messageId;
    actions.appendChild(confirm);
  } else {
    actions.appendChild(el("span", "preview-wait", "补充完信息后会出现“确认发布”"));
  }
  card.appendChild(actions);
  card.appendChild(el("p", "product-policy", "点击“确认发布”前不会公开。发布后不会展示手机号、学号或宿舍。"));
  container.appendChild(card);
}

function renderProductSearch(container, data) {
  container.appendChild(el("span", "tag market", "集市查找"));
  container.appendChild(el("div", "answer-text", data.answer || ""));
  if (Array.isArray(data.products) && data.products.length > 0) {
    const grid = el("div", "product-grid chat-product-grid");
    data.products.forEach((product) => grid.appendChild(productCard(product, { chat: true })));
    container.appendChild(grid);
  }
}

function formatPrice(price) {
  const value = Number(price);
  if (!Number.isFinite(value)) return String(price || "");
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function productCard(product, options = {}) {
  const card = el("article", `product-card ${options.compact ? "compact" : ""}`);
  const thumb = el("div", "product-thumb");
  if (product.images && product.images.length > 0) {
    const img = el("img");
    img.src = product.images[0];
    img.alt = product.name || "商品图片";
    thumb.appendChild(img);
  } else {
    thumb.appendChild(el("span", null, "暂无图片"));
  }
  card.appendChild(thumb);
  const body = el("div", "product-body");
  const top = el("div", "product-top");
  top.appendChild(el("h4", null, product.name || "未命名商品"));
  top.appendChild(el("strong", "price-tag", `¥${formatPrice(product.price)}`));
  body.appendChild(top);
  body.appendChild(el("p", "product-sub", `${product.condition || "成色未注明"} · ${product.seller_name || "同学"}`));
  if (product.status && product.status !== "on_sale") {
    body.appendChild(el("span", "status-pill ended", product.status === "sold" ? "已出" : "已下架"));
  }
  if (!options.compact) {
    if (product.description) body.appendChild(el("p", "product-desc", product.description));
    const actions = el("div", "product-actions");
    const view = el("button", "ghost-btn", "查看详情");
    view.type = "button";
    view.dataset.productOpen = product.id;
    actions.appendChild(view);
    if (options.chat && !product.is_mine && product.status === "on_sale") {
      const contact = el("button", "primary-btn", "联系卖家");
      contact.type = "button";
      contact.dataset.productContact = product.id;
      actions.appendChild(contact);
    }
    body.appendChild(actions);
  } else {
    const actions = el("div", "product-actions");
    const view = el("button", "ghost-btn", "在集市查看");
    view.type = "button";
    view.dataset.productOpen = product.id;
    actions.appendChild(view);
    body.appendChild(actions);
  }
  card.appendChild(body);
  return card;
}

function copyMessage(messageId, button) {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message || !message.data) return;
  const data = message.data;
  const text = `${data.title || ""}\n\n${data.body || ""}`.trim();
  copyText(text, button);
}

async function copyText(text, button) {
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch (error) {
    ok = false;
  }
  if (!ok) {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    document.body.removeChild(area);
  }
  const original = button.textContent;
  button.textContent = ok ? "已复制" : "复制失败，请手动选择";
  window.setTimeout(() => {
    button.textContent = original;
  }, 1800);
}

function submitInput() {
  const text = els.input.value.trim();
  if (!text || state.sending) {
    if (!text) els.input.focus();
    return;
  }
  els.input.value = "";
  autoResize();
  sendMessage(text);
}

async function sendMessage(text, options = {}) {
  if (state.sending) return;
  if (!options.reuseUser) {
    state.messages.push({ id: nextId(), role: "user", status: "done", text });
  }
  const pending = { id: nextId(), role: "assistant", status: "pending", pendingLabel: "正在判断并处理" };
  state.messages.push(pending);
  state.sending = true;
  setSendingState();
  saveChat();
  renderMessages();

  const payload = options.payload || {
    mode: "auto",
    message: text,
    history: state.history.slice(-8),
    ppt_id: state.ppt ? state.ppt.id : "",
    current_post: state.currentPost,
    current_product: state.currentProduct,
  };

  try {
    const data = await api("/api/chat", { method: "POST", body: JSON.stringify(payload) });
    pending.status = "done";
    pending.data = data;
    applyChatResult(data);
    state.history.push({ role: "user", content: text });
    state.history.push({ role: "assistant", content: summarizeResult(data) });
    if (state.history.length > 16) state.history = state.history.slice(-16);
    if (data.kind === "product_published" || data.kind === "product_preview") {
      await refreshStatus();
    }
  } catch (error) {
    pending.status = "error";
    pending.error = error.message;
    pending.retry = { text, payload };
  } finally {
    state.sending = false;
    setSendingState();
    saveChat();
    renderMessages();
    renderPptBar();
  }
}

function applyChatResult(data) {
  if (data.kind === "post" && data.title) {
    state.currentPost = { id: data.post_id || null, title: data.title, body: data.body || "" };
  }
  if (data.kind === "product_preview" && data.draft) {
    state.currentProduct = data.draft;
  }
  if (data.kind === "product_published") {
    state.currentProduct = null;
  }
  if (data.kind === "ppt" && data.ppt) {
    state.ppt = data.ppt;
  }
}

function summarizeResult(data) {
  if (!data) return "";
  if (data.kind === "post") return `帖子《${data.title || ""}》：${(data.body || "").slice(0, 300)}`;
  if (data.kind === "post_clarify") return `追问：${data.question || ""}`;
  if (data.kind === "product_preview") return `商品草稿：${(data.draft && data.draft.name) || ""}`;
  if (data.kind === "product_published") return `已发布商品：${(data.product && data.product.name) || ""}`;
  return (data.answer || data.question || "处理完成").slice(0, 500);
}

function retryMessage(id) {
  const index = state.messages.findIndex((message) => message.id === id);
  if (index === -1) return;
  const message = state.messages[index];
  if (!message.retry) return;
  const retry = message.retry;
  state.messages.splice(index, 1);
  renderMessages();
  sendMessage(retry.text, { reuseUser: true, payload: retry.payload });
}

function setSendingState() {
  els.sendBtn.disabled = state.sending;
  els.sendBtn.querySelector("span").textContent = state.sending ? "处理中" : "发送";
}

function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",", 2)[1] || "");
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

async function handlePptFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".pptx")) {
    toast("第一版只支持 .pptx 文件，旧版 .ppt、PDF、Word 请先另存为 PPTX。");
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    toast("PPTX 不能超过 25 MB。");
    return;
  }
  state.messages.push({ id: nextId(), role: "user", status: "done", text: `上传课件：${file.name}` });
  const pending = { id: nextId(), role: "assistant", status: "pending", pendingLabel: "正在解析课件文字" };
  state.messages.push(pending);
  state.sending = true;
  setSendingState();
  renderMessages();
  try {
    const encoded = await readFileBase64(file);
    const data = await api("/api/ppt", {
      method: "POST",
      body: JSON.stringify({ filename: file.name, data: encoded }),
    });
    state.ppt = data.ppt;
    pending.status = "done";
    pending.data = { kind: "ppt_uploaded", ppt: data.ppt };
    state.history.push({ role: "user", content: `上传课件《${file.name}》` });
    state.history.push({
      role: "assistant",
      content: `已读取《${file.name}》，共 ${data.ppt.slide_count} 页，图片和图表未识别。`,
    });
  } catch (error) {
    pending.status = "error";
    pending.error = error.message;
  } finally {
    state.sending = false;
    setSendingState();
    saveChat();
    renderMessages();
    renderPptBar();
  }
}

async function refreshAdmin() {
  await Promise.all([refreshMaterials(), loadNotices(), loadReports()]);
}

function openAdmin(tab = "materials") {
  switchAdminTab(tab);
  els.adminDialog.showModal();
  refreshAdmin();
}

function switchAdminTab(tab) {
  state.adminTab = tab;
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === tab);
  });
  els.adminPanelMaterials.classList.toggle("hidden", tab !== "materials");
  els.adminPanelNotices.classList.toggle("hidden", tab !== "notices");
  els.adminPanelReports.classList.toggle("hidden", tab !== "reports");
  if (tab === "notices") loadNotices();
  if (tab === "reports") loadReports();
}

function renderMaterialList() {
  if (!els.materialList) return;
  els.materialList.innerHTML = "";
  els.matListCount.textContent = `${state.materials.length} 份`;
  if (state.materials.length === 0) {
    els.materialList.appendChild(el("div", "mat-empty", "还没有资料。粘贴一段学校资料，保存后就能依据它回答。"));
    return;
  }
  state.materials.forEach((material) => {
    const item = el("div", "mat-item");
    const row = el("div", "mat-row");
    const toggle = el("button", "mat-toggle");
    toggle.type = "button";
    toggle.appendChild(el("strong", null, material.name));
    toggle.appendChild(el("small", null, `${material.content.length} 字 · ${material.created_at || "刚刚添加"} · 点击查看原文`));
    const content = el("pre", "mat-content hidden", material.content);
    toggle.addEventListener("click", () => content.classList.toggle("hidden"));
    const remove = el("button", "mat-del", "删除");
    remove.type = "button";
    remove.dataset.materialDelete = material.id;
    row.appendChild(toggle);
    row.appendChild(remove);
    item.appendChild(row);
    item.appendChild(content);
    els.materialList.appendChild(item);
  });
}

async function addMaterial(event) {
  event.preventDefault();
  const name = els.matName.value.trim();
  const content = els.matContent.value.trim();
  els.matFormMsg.className = "form-msg";
  if (!name) {
    els.matFormMsg.classList.add("error");
    els.matFormMsg.textContent = "请先填写资料名称。";
    return;
  }
  if (!content) {
    els.matFormMsg.classList.add("error");
    els.matFormMsg.textContent = "请先粘贴资料内容。";
    return;
  }
  els.matSubmit.disabled = true;
  els.matFormMsg.textContent = "正在保存…";
  try {
    await api("/api/materials", { method: "POST", body: JSON.stringify({ name, content }) });
    els.matName.value = "";
    els.matContent.value = "";
    els.matFormMsg.textContent = "已添加。现在可以在聊天里依据它提问。";
    await refreshMaterials();
    await refreshStatus();
    renderNotices();
  } catch (error) {
    els.matFormMsg.classList.add("error");
    els.matFormMsg.textContent = error.message;
  } finally {
    els.matSubmit.disabled = false;
  }
}

async function deleteMaterial(id) {
  const material = state.materials.find((item) => item.id === id);
  if (!material) return;
  if (!window.confirm(`确定删除资料「${material.name}」吗？删除后无法恢复。`)) return;
  try {
    await api(`/api/materials/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refreshMaterials();
    await refreshStatus();
    renderNotices();
    toast("资料已删除");
  } catch (error) {
    toast(error.message);
  }
}

function renderNoticeAdminList() {
  if (!els.noticeList) return;
  els.noticeList.innerHTML = "";
  els.noticeListCount.textContent = `${state.notices.length} 条`;
  if (state.notices.length === 0) {
    els.noticeList.appendChild(el("div", "mat-empty", "还没有通知。添加后，聊天里才能整理校园消息和截止时间。"));
    return;
  }
  state.notices.forEach((notice) => {
    const card = el("article", "admin-notice");
    const head = el("div", "intel-head");
    head.appendChild(el("h4", null, notice.title));
    head.appendChild(el("span", `status-pill ${notice.status_key}`, notice.status));
    card.appendChild(head);
    const meta = el("div", "intel-meta");
    meta.appendChild(el("span", null, `来源：${notice.source}`));
    meta.appendChild(el("span", null, `发布：${notice.published_at || "未注明"}`));
    if (notice.event_at) meta.appendChild(el("span", null, `活动：${notice.event_at}`));
    if (notice.deadline_at) meta.appendChild(el("span", null, `截止：${notice.deadline_at}`));
    card.appendChild(meta);
    const body = el("details", "intel-details");
    body.appendChild(el("summary", null, "查看正文"));
    body.appendChild(el("p", null, notice.body));
    card.appendChild(body);
    const actions = el("div", "admin-row-actions");
    const remove = el("button", "text-btn danger", "删除通知");
    remove.type = "button";
    remove.dataset.noticeDelete = notice.id;
    actions.appendChild(remove);
    card.appendChild(actions);
    els.noticeList.appendChild(card);
  });
}

async function addNotice(event) {
  event.preventDefault();
  const payload = {
    title: els.noticeTitle.value.trim(),
    source: els.noticeSource.value.trim(),
    published_at: els.noticePublished.value,
    event_at: els.noticeEvent.value,
    deadline_at: els.noticeDeadline.value,
    body: els.noticeBody.value.trim(),
  };
  els.noticeFormMsg.className = "form-msg";
  if (!payload.title || !payload.source || !payload.body) {
    els.noticeFormMsg.classList.add("error");
    els.noticeFormMsg.textContent = "标题、来源和正文都需要填写。";
    return;
  }
  els.noticeSubmit.disabled = true;
  els.noticeFormMsg.textContent = "正在保存…";
  try {
    await api("/api/notices", { method: "POST", body: JSON.stringify(payload) });
    els.noticeTitle.value = "";
    els.noticeSource.value = "";
    els.noticeEvent.value = "";
    els.noticeDeadline.value = "";
    els.noticeBody.value = "";
    els.noticeFormMsg.textContent = "通知已添加。聊天里可以问“最近有哪些校园消息”。";
    await loadNotices();
    await refreshStatus();
    toast("通知已添加");
  } catch (error) {
    els.noticeFormMsg.classList.add("error");
    els.noticeFormMsg.textContent = error.message;
  } finally {
    els.noticeSubmit.disabled = false;
  }
}

async function deleteNotice(id) {
  if (!window.confirm("确定删除这条通知吗？聊天将不再引用它。")) return;
  try {
    await api(`/api/notices/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadNotices();
    await refreshStatus();
    toast("通知已删除");
  } catch (error) {
    toast(error.message);
  }
}

async function loadReports() {
  try {
    const data = await api("/api/reports");
    renderReports(Array.isArray(data.reports) ? data.reports : []);
  } catch (error) {
    renderReports([]);
  }
}

function renderReports(reports) {
  els.reportList.innerHTML = "";
  if (!reports.length) {
    els.reportList.appendChild(el("div", "mat-empty", "目前没有举报。"));
    return;
  }
  reports.forEach((report) => {
    const card = el("article", `admin-report ${report.status}`);
    const head = el("div", "intel-head");
    head.appendChild(el("h4", null, report.target_label || "举报内容"));
    head.appendChild(el("span", `status-pill ${report.status === "open" ? "soon" : "unknown"}`, report.status === "open" ? "待处理" : report.status === "resolved" ? "已处理" : "已忽略"));
    card.appendChild(head);
    const meta = el("div", "intel-meta");
    meta.appendChild(el("span", null, `举报人：${report.reporter_name || "同学"}`));
    meta.appendChild(el("span", null, `时间：${report.created_at || ""}`));
    card.appendChild(meta);
    card.appendChild(el("p", "report-reason", `原因：${report.reason}`));
    if (report.status === "open") {
      const actions = el("div", "admin-row-actions");
      if (report.product_id) {
        const takeDown = el("button", "text-btn danger", "下架商品并处理");
        takeDown.type = "button";
        takeDown.dataset.reportAction = report.id;
        takeDown.dataset.status = "resolved";
        takeDown.dataset.takeDown = "1";
        actions.appendChild(takeDown);
      }
      const resolve = el("button", "text-btn", "仅标记已处理");
      resolve.type = "button";
      resolve.dataset.reportAction = report.id;
      resolve.dataset.status = "resolved";
      resolve.dataset.takeDown = "0";
      actions.appendChild(resolve);
      const dismiss = el("button", "text-btn", "忽略");
      dismiss.type = "button";
      dismiss.dataset.reportAction = report.id;
      dismiss.dataset.status = "dismissed";
      dismiss.dataset.takeDown = "0";
      actions.appendChild(dismiss);
      card.appendChild(actions);
    }
    els.reportList.appendChild(card);
  });
}

async function updateReport(id, status, takeDown) {
  try {
    await api(`/api/reports/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, take_down: takeDown }),
    });
    await loadReports();
    await refreshStatus();
    toast(takeDown ? "已下架商品并处理举报" : "举报状态已更新");
  } catch (error) {
    toast(error.message);
  }
}

function updateMyIdentityLine() {
  if (els.myName) els.myName.textContent = state.user?.name || "同学";
  if (els.myIdentityLine) els.myIdentityLine.textContent = `当前身份：${state.user?.name || "同学"}`;
}

async function openMyPage() {
  if (!els.myPage) return;
  const portal = document.getElementById("portal");
  const workspace = document.getElementById("workspace");
  if (portal) portal.hidden = true;
  if (workspace) workspace.hidden = true;
  els.myPage.hidden = false;
  const publicPage = document.getElementById("publicFeedPage");
  if (publicPage) publicPage.hidden = true;
  updateMyIdentityLine();
  switchMyTab(state.myTab, false);
  await loadMyDashboard();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function switchMyTab(tab, load = true) {
  if (tab === "chats" && load) { openSocial(); return; }
  if (!["history", "products", "wanted", "posts", "chats"].includes(tab)) return;
  state.myTab = tab;
  document.querySelectorAll(".my-tabs [data-my-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.myTab === tab);
  });
  document.querySelectorAll("[data-my-stat]").forEach((button) => {
    button.classList.toggle("active", button.dataset.myStat === tab);
  });
  renderMyTabs();
  renderMyContent();
  if (load) loadMyDashboard();
}

async function loadMyDashboard() {
  state.myLoading = true;
  state.myError = "";
  renderMyContent();
  try {
    state.myDashboard = await api("/api/me/dashboard");
  } catch (error) {
    state.myDashboard = null;
    state.myError = error.message;
  } finally {
    state.myLoading = false;
    renderMyTabs();
    renderMyContent();
    updateMyIdentityLine();
  }
}

function renderMyTabs() {
  const labels = {
    history: "浏览历史",
    products: "我的商品",
    wanted: "想要的",
    posts: "我的帖子",
    chats: "私聊",
  };
  const counts = state.myDashboard?.counts || null;
  document.querySelectorAll(".my-tabs [data-my-tab]").forEach((button) => {
    const key = button.dataset.myTab;
    button.textContent = counts ? `${labels[key]} ${counts[key] || 0}` : labels[key];
  });
  renderMyStats();
}

function renderMyStats() {
  const counts = state.myDashboard?.counts || {};
  const map = {
    myCountHistory: counts.history,
    myCountProducts: counts.products,
    myCountWanted: counts.wanted,
    myCountPosts: counts.posts,
    myCountChats: counts.chats,
  };
  Object.entries(map).forEach(([id, value]) => {
    const node = els[id];
    if (node) node.textContent = String(value || 0);
  });
}

function myEmpty(title, text, actionLabel, action) {
  const wrap = el("div", "my-empty");
  wrap.appendChild(el("h3", null, title));
  wrap.appendChild(el("p", null, text));
  if (actionLabel && action) {
    const button = el("button", "primary-btn", actionLabel);
    button.type = "button";
    button.addEventListener("click", action);
    wrap.appendChild(button);
  }
  return wrap;
}

function openMarketFromMy() {
  state.marketTab = "browse";
  openMarket();
}

function renderMyContent() {
  if (!els.myContent) return;
  els.myContent.innerHTML = "";
  if (state.myLoading) {
    els.myContent.appendChild(el("div", "market-loading", "正在整理你的校园足迹…"));
    return;
  }
  if (state.myError) {
    els.myContent.appendChild(
      myEmpty("没有加载成功", state.myError, "重试", () => loadMyDashboard()),
    );
    return;
  }
  const data = state.myDashboard;
  if (!data) {
    els.myContent.appendChild(el("div", "market-loading", "打开“我的”后加载数据"));
    return;
  }

  if (["history", "products", "wanted"].includes(state.myTab)) {
    const list = state.myTab === "history" ? data.history : state.myTab === "wanted" ? data.wanted : data.products;
    if (!list || list.length === 0) {
      if (state.myTab === "history") {
        els.myContent.appendChild(
          myEmpty("还没有浏览记录", "打开集市里的商品详情后，会记录在这里。", "去逛集市", openMarketFromMy),
        );
      } else if (state.myTab === "wanted") {
        els.myContent.appendChild(
          myEmpty("还没有想要的商品", "在商品详情里点“想要”，方便之后回来查看。", "去逛集市", openMarketFromMy),
        );
      } else {
        els.myContent.appendChild(
          myEmpty("还没有发布商品", "发布前会先预览，确认后才会公开。", "发布商品", () => {
            openPublishDialog("create", null);
          }),
        );
      }
      return;
    }
    const grid = el("div", "product-grid my-grid");
    list.forEach((product) => grid.appendChild(productCard(product, { chat: false })));
    els.myContent.appendChild(grid);
    return;
  }

  if (state.myTab === "posts") {
    if (!data.posts || data.posts.length === 0) {
      els.myContent.appendChild(
        myEmpty(
          "还没有帖子草稿",
          "AI 接通后生成的帖子会保存在这里。帖子只作为草稿，不会自动公开。",
          "去写帖子",
          () => {
            if (typeof enterFeature === "function") enterFeature(3);
          },
        ),
      );
      return;
    }
    const list = el("div", "my-post-list");
    data.posts.forEach((post) => list.appendChild(myPostCard(post)));
    els.myContent.appendChild(list);
    return;
  }

  if (!data.conversations || data.conversations.length === 0) {
    els.myContent.appendChild(
      myEmpty("还没有私聊", "在商品详情点“联系卖家”，会话会出现在这里。", "去逛集市", openMarketFromMy),
    );
    return;
  }
  const list = el("div", "conversation-list");
  data.conversations.forEach((conversation) => {
    const item = el("button", "conversation-item");
    item.type = "button";
    const top = el("div", "conversation-top");
    top.appendChild(el("strong", null, conversation.other_name));
    top.appendChild(el("span", "conversation-role", conversation.kind === "direct" ? "同学私聊" : (conversation.role === "seller" ? "我是卖家" : "我是买家")));
    item.appendChild(top);
    item.appendChild(el("p", null, conversation.kind === "direct" ? "校园好友 · 直接交流" : `商品：${conversation.product_name}`));
    item.appendChild(el("p", "conversation-last", conversation.last_message || "还没有消息"));
    item.appendChild(el("span", "conversation-time", conversation.last_time || ""));
    item.addEventListener("click", () => openChat(conversation));
    list.appendChild(item);
  });
  els.myContent.appendChild(list);
}

function myPostCard(post) {
  const card = el("article", "my-post-card");
  const head = el("div", "my-post-head");
  const title = el("div");
  title.appendChild(el("span", "draft-kicker", post.post_type ? `帖子草稿 · ${post.post_type}` : "帖子草稿"));
  title.appendChild(el("h3", null, post.title || "校园帖子草稿"));
  head.appendChild(title);
  head.appendChild(el("span", "draft-tag", "草稿"));
  card.appendChild(head);
  card.appendChild(el("p", "my-post-body", post.body || ""));
  if (Array.isArray(post.missing) && post.missing.length) {
    const missing = el("div", "my-post-missing");
    missing.appendChild(el("strong", null, "待补充："));
    missing.appendChild(el("span", null, post.missing.join("、")));
    card.appendChild(missing);
  }
  const foot = el("div", "my-post-foot");
  foot.appendChild(el("span", null, `更新：${post.updated_at || post.created_at || ""} · 仅自己可见，未公开发布`));
  const copy = el("button", "copy-btn", "复制全文");
  copy.type = "button";
  copy.addEventListener("click", () => copyText(`${post.title || ""}

${post.body || ""}`.trim(), copy));
  foot.appendChild(copy);
  const publicBtn = el("button", "ghost-btn", "发布到公共区");
  publicBtn.type = "button";
  publicBtn.addEventListener("click", () => openPublicPostComposer({
    title: post.title || "",
    body: post.body || "",
    post_type: post.post_type || "",
  }));
  foot.appendChild(publicBtn);
  card.appendChild(foot);
  return card;
}

async function refreshMyIfOpen() {
  if (els.myPage && !els.myPage.hidden) await loadMyDashboard();
}

async function openPublicFeed() {
  if (!els.publicFeedPage) return;
  const portal = document.getElementById("portal");
  const workspace = document.getElementById("workspace");
  const myPage = document.getElementById("myPage");
  if (portal) portal.hidden = true;
  if (workspace) workspace.hidden = true;
  if (myPage) myPage.hidden = true;
  els.publicFeedPage.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  await loadPublicPosts();
}

async function loadPublicPosts() {
  if (!els.publicPostList) return;
  state.publicLoading = true;
  state.publicError = "";
  renderPublicPosts();
  try {
    const data = await api("/api/posts");
    state.publicPosts = Array.isArray(data.posts) ? data.posts : [];
  } catch (error) {
    state.publicPosts = [];
    state.publicError = error.message;
  } finally {
    state.publicLoading = false;
    renderPublicPosts();
  }
}

function renderPublicPosts() {
  if (!els.publicPostList) return;
  els.publicPostList.innerHTML = "";
  if (els.publicPostCount) {
    els.publicPostCount.textContent = state.publicLoading
      ? "正在加载…"
      : `${state.publicPosts.length} 条公开帖子`;
  }
  if (state.publicLoading) {
    els.publicPostList.appendChild(el("div", "public-feed-empty", "正在加载公共帖子…"));
    return;
  }
  if (state.publicError) {
    const wrap = el("div", "public-feed-empty error");
    wrap.appendChild(el("p", null, state.publicError));
    const retry = el("button", "ghost-btn", "重试");
    retry.type = "button";
    retry.addEventListener("click", loadPublicPosts);
    wrap.appendChild(retry);
    els.publicPostList.appendChild(wrap);
    return;
  }
  if (!state.publicPosts.length) {
    els.publicPostList.appendChild(el("div", "public-feed-empty", "公共区还没有帖子。点右上角“发布帖子”，让全校同学看到你的第一条消息。"));
    return;
  }
  state.publicPosts.forEach((post) => els.publicPostList.appendChild(publicPostCard(post)));
}

function publicPostCard(post) {
  const card = el("article", "public-post-card");
  const head = el("div", "public-post-head");
  const who = el("div", "public-post-author");
  const authorButton = el("button", "public-author-link");
  authorButton.type = "button";
  authorButton.appendChild(el("strong", null, post.author_name || "同学"));
  authorButton.appendChild(el("span", null, post.is_mine ? "我发布的" : "点击发帖人进入私聊"));
  if (!post.is_mine && post.author_id) {
    authorButton.addEventListener("click", () => openDirectChat(post.author_id, post.author_name));
  } else {
    authorButton.disabled = true;
  }
  who.appendChild(authorButton);
  who.appendChild(el("span", "public-post-time", post.created_at || ""));
  head.appendChild(who);
  if (post.post_type) head.appendChild(el("span", "public-post-type", post.post_type));
  card.appendChild(head);
  card.appendChild(el("h3", "public-post-title", post.title || "未命名帖子"));
  card.appendChild(el("p", "public-post-body", post.body || ""));

  const actions = el("div", "public-post-actions");
  const like = el("button", `public-action${post.liked ? " active" : ""}`, undefined);
  like.type = "button";
  like.title = post.liked ? "取消点赞" : "点赞";
  like.appendChild(el("span", "public-action-icon", post.liked ? "♥" : "♡"));
  like.appendChild(el("span", "public-action-text", `点赞 ${post.like_count || 0}`));
  like.addEventListener("click", () => togglePublicLike(post, like));
  actions.appendChild(like);

  const commentButton = el("button", "public-action", undefined);
  commentButton.type = "button";
  commentButton.appendChild(el("span", "public-action-icon", "💬"));
  commentButton.appendChild(el("span", "public-action-text", `评论 ${post.comment_count || 0}`));
  actions.appendChild(commentButton);

  if (!post.is_mine && post.author_id) {
    const chat = el("button", "public-action", undefined);
    chat.type = "button";
    chat.appendChild(el("span", "public-action-icon", "✉"));
    chat.appendChild(el("span", "public-action-text", "私聊发帖人"));
    chat.addEventListener("click", () => openDirectChat(post.author_id, post.author_name));
    actions.appendChild(chat);
  }
  card.appendChild(actions);

  const commentsBox = buildPublicComments(post, commentButton);
  commentButton.addEventListener("click", () => {
    commentsBox.hidden = !commentsBox.hidden;
    commentButton.classList.toggle("active", !commentsBox.hidden);
    if (commentsBox.hidden) state.publicOpenComments.delete(post.id);
    else {
      state.publicOpenComments.add(post.id);
      const input = commentsBox.querySelector(".public-comment-input");
      if (input) input.focus();
    }
  });
  commentButton.classList.toggle("active", !commentsBox.hidden);
  card.appendChild(commentsBox);

  const foot = el("div", "public-post-foot");
  foot.appendChild(el("span", "public-post-public", post.is_mine ? "我发布的 · 所有人可见" : "公开帖子 · 所有人可见"));
  if (post.is_mine) {
    const remove = el("button", "ghost-btn danger", "删除帖子");
    remove.type = "button";
    remove.addEventListener("click", () => deletePublicPost(post.id));
    foot.appendChild(remove);
  }
  card.appendChild(foot);
  return card;
}

function buildPublicComments(post, countButton) {
  const box = el("div", "public-post-comments");
  box.hidden = !state.publicOpenComments.has(post.id);
  const list = el("div", "public-comment-list");
  renderPublicCommentList(post, list, countButton);
  box.appendChild(list);
  const form = el("form", "public-comment-form");
  const input = el("input", "public-comment-input");
  input.type = "text";
  input.maxLength = 500;
  input.placeholder = "写评论（请勿填写手机号、学号等个人信息）";
  input.setAttribute("aria-label", "评论内容");
  const send = el("button", "primary-btn", "发送");
  send.type = "submit";
  form.appendChild(input);
  form.appendChild(send);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitPublicComment(post, input, list, countButton);
  });
  box.appendChild(form);
  return box;
}

function renderPublicCommentList(post, list, countButton) {
  list.innerHTML = "";
  const comments = Array.isArray(post.comments) ? post.comments : [];
  if (countButton) {
    const text = countButton.querySelector(".public-action-text");
    if (text) text.textContent = `评论 ${post.comment_count || comments.length}`;
  }
  if (!comments.length) {
    list.appendChild(el("p", "public-comment-empty", "还没有评论，来说两句吧。"));
    return;
  }
  comments.forEach((comment) => {
    const row = el("div", "public-comment");
    const meta = el("div", "public-comment-meta");
    meta.appendChild(el("strong", null, comment.author_name || "同学"));
    meta.appendChild(el("span", null, comment.created_at || ""));
    row.appendChild(meta);
    row.appendChild(el("p", "public-comment-body", comment.body || ""));
    if (comment.is_mine || post.is_mine) {
      const remove = el("button", "public-comment-delete", "删除");
      remove.type = "button";
      remove.addEventListener("click", () => deletePublicComment(post, comment, list, countButton));
      row.appendChild(remove);
    }
    list.appendChild(row);
  });
}

async function togglePublicLike(post, button) {
  if (button.disabled) return;
  button.disabled = true;
  try {
    const data = await api(`/api/posts/${encodeURIComponent(post.id)}/like`, {
      method: "POST",
      body: "{}",
    });
    post.liked = Boolean(data.liked);
    post.like_count = Number(data.like_count) || 0;
    button.classList.toggle("active", post.liked);
    button.title = post.liked ? "取消点赞" : "点赞";
    const icon = button.querySelector(".public-action-icon");
    const text = button.querySelector(".public-action-text");
    if (icon) icon.textContent = post.liked ? "♥" : "♡";
    if (text) text.textContent = `点赞 ${post.like_count}`;
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

async function submitPublicComment(post, input, list, countButton) {
  const body = input.value.trim();
  if (!body) {
    input.focus();
    return;
  }
  const form = input.closest("form");
  const send = form ? form.querySelector("button") : null;
  if (send) send.disabled = true;
  try {
    const data = await api(`/api/posts/${encodeURIComponent(post.id)}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    post.comments = Array.isArray(post.comments) ? post.comments : [];
    post.comments.push(data.comment);
    post.comment_count = Number(data.comment_count) || post.comments.length;
    input.value = "";
    renderPublicCommentList(post, list, countButton);
    toast(data.comment && data.comment.privacy_applied ? "评论已发送，个人信息已自动隐去" : "评论已发送");
  } catch (error) {
    toast(error.message);
  } finally {
    if (send) send.disabled = false;
  }
}

async function deletePublicComment(post, comment, list, countButton) {
  if (!window.confirm("确认删除这条评论吗？")) return;
  try {
    const data = await api(`/api/posts/${encodeURIComponent(post.id)}/comments/${encodeURIComponent(comment.id)}`, {
      method: "DELETE",
    });
    post.comments = (Array.isArray(post.comments) ? post.comments : []).filter((item) => item.id !== comment.id);
    post.comment_count = Number(data.comment_count) || post.comments.length;
    renderPublicCommentList(post, list, countButton);
    toast("评论已删除");
  } catch (error) {
    toast(error.message);
  }
}

async function openDirectChat(userId, name) {
  if (!userId) return;
  try {
    const data = await api("/api/social", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, action: "message" }),
    });
    if (els.publicPostDialog && els.publicPostDialog.open) els.publicPostDialog.close();
    await openChat(data.conversation);
    toast(`已打开和 ${name || "同学"} 的私聊`);
  } catch (error) {
    toast(error.message);
  }
}

function openPublicPostComposer(prefill = {}) {
  if (!els.publicPostDialog || !els.publicPostType) return;
  const types = Array.from(els.publicPostType.options).map((option) => option.value);
  const wanted = String(prefill.post_type || "").trim();
  els.publicPostType.value = types.includes(wanted) ? wanted : types[0] || "找搭子";
  els.publicPostContentTitle.value = String(prefill.title || "").slice(0, 80);
  els.publicPostBody.value = String(prefill.body || "").slice(0, 3000);
  els.publicPostMsg.className = "form-msg";
  els.publicPostMsg.textContent = "";
  els.publicPostConfirm.disabled = false;
  els.publicPostDialog.showModal();
}

async function submitPublicPost() {
  const title = els.publicPostContentTitle.value.trim();
  const body = els.publicPostBody.value.trim();
  const postType = els.publicPostType.value;
  if (!title) {
    els.publicPostMsg.className = "form-msg error";
    els.publicPostMsg.textContent = "请填写帖子标题。";
    return;
  }
  if (!body) {
    els.publicPostMsg.className = "form-msg error";
    els.publicPostMsg.textContent = "请填写帖子正文。";
    return;
  }
  if (!window.confirm(`确认把这条帖子公开发布吗？发布后所有同学都能看到。\n\n${title}`)) return;
  els.publicPostConfirm.disabled = true;
  els.publicPostMsg.className = "form-msg";
  els.publicPostMsg.textContent = "正在发布…";
  try {
    const data = await api("/api/posts", {
      method: "POST",
      body: JSON.stringify({ title, body, post_type: postType }),
    });
    els.publicPostDialog.close();
    if (els.publicFeedPage && !els.publicFeedPage.hidden) await loadPublicPosts();
    toast(data.post && data.post.privacy_applied ? "已公开发布，手机号等个人信息已自动隐去" : "已公开发布，所有人可见");
  } catch (error) {
    els.publicPostMsg.className = "form-msg error";
    els.publicPostMsg.textContent = error.message;
  } finally {
    els.publicPostConfirm.disabled = false;
  }
}

async function deletePublicPost(postId) {
  if (!window.confirm("确认删除这条公开帖子吗？删除后所有同学都看不到了。")) return;
  try {
    await api(`/api/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
    state.publicPosts = state.publicPosts.filter((item) => item.id !== postId);
    renderPublicPosts();
    toast("帖子已删除");
  } catch (error) {
    toast(error.message);
  }
}

function openMarket() {
  els.marketDialog.showModal();
  switchMarketTab(state.marketTab);
  refreshMarket();
}

function switchMarketTab(tab) {
  state.marketTab = tab;
  document.querySelectorAll("[data-market-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.marketTab === tab);
    button.setAttribute("aria-selected",String(button.dataset.marketTab === tab));
  });
  els.marketPanelBrowse.classList.toggle("hidden", tab !== "browse");
  els.marketPanelMine.classList.toggle("hidden", tab !== "mine");
  els.marketPanelChats.classList.toggle("hidden", tab !== "chats");
  if (tab === "browse") searchMarket();
  if (tab === "mine") loadMine();
  if (tab === "chats") loadConversations();
}

async function refreshMarket() {
  await Promise.all([searchMarket(), loadMine(), loadConversations()]);
}

async function searchMarket() {
  const query = els.marketSearchInput.value.trim();
  els.marketGrid.innerHTML = "";
  els.marketGrid.appendChild(el("div", "market-loading", "正在加载在售商品…"));
  try {
    const data = await api(`/api/market/products?q=${encodeURIComponent(query)}`);
    state.marketProducts = Array.isArray(data.products) ? data.products : [];
    els.marketGrid.innerHTML = "";
    if (!state.marketProducts.length) {
      els.marketGrid.appendChild(el("div", "market-empty", query ? "没有找到匹配的在售商品。" : "集市里还没有在售商品。"));
      return;
    }
    state.marketProducts.forEach((product) => {
      els.marketGrid.appendChild(productCard(product, { chat: true }));
    });
  } catch (error) {
    els.marketGrid.innerHTML = "";
    els.marketGrid.appendChild(el("div", "market-empty", error.message));
  }
}

async function loadMine() {
  els.mineGrid.innerHTML = "";
  els.mineGrid.appendChild(el("div", "market-loading", "正在加载我的商品…"));
  try {
    const data = await api("/api/market/mine");
    state.mineProducts = Array.isArray(data.products) ? data.products : [];
    els.mineGrid.innerHTML = "";
    if (!state.mineProducts.length) {
      els.mineGrid.appendChild(el("div", "market-empty", "你还没有发布商品。可以在聊天里说“我要卖一盏台灯，25 元”，或点右上角手动发布。"));
      return;
    }
    state.mineProducts.forEach((product) => els.mineGrid.appendChild(productCard(product, { chat: false })));
  } catch (error) {
    els.mineGrid.innerHTML = "";
    els.mineGrid.appendChild(el("div", "market-empty", error.message));
  }
}

async function loadConversations() {
  els.conversationList.innerHTML = "";
  try {
    const data = await api("/api/market/conversations");
    state.conversations = Array.isArray(data.conversations) ? data.conversations : [];
    els.conversationList.innerHTML = "";
    if (!state.conversations.length) {
      els.conversationList.appendChild(el("div", "market-empty", "还没有私聊。从商品详情点“联系卖家”，或等别人联系你。"));
      return;
    }
    state.conversations.forEach((conversation) => {
      const item = el("button", "conversation-item");
      item.type = "button";
      const top = el("div", "conversation-top");
      top.appendChild(el("strong", null, conversation.other_name));
      top.appendChild(el("span", "conversation-role", conversation.kind === "direct" ? "同学私聊" : (conversation.role === "seller" ? "我是卖家" : "我是买家")));
      item.appendChild(top);
      item.appendChild(el("p", null, conversation.kind === "direct" ? "校园好友 · 直接交流" : `商品：${conversation.product_name}`));
      item.appendChild(el("p", "conversation-last", conversation.last_message || "还没有消息"));
      item.appendChild(el("span", "conversation-time", conversation.last_time || ""));
      item.addEventListener("click", () => openChat(conversation));
      els.conversationList.appendChild(item);
    });
  } catch (error) {
    els.conversationList.innerHTML = "";
    els.conversationList.appendChild(el("div", "market-empty", error.message));
  }
}

async function openProduct(productId) {
  try {
    const data = await api(`/api/market/products/${encodeURIComponent(productId)}`);
    renderProductDetail(data.product);
    els.productDialog.showModal();
    api(`/api/market/products/${encodeURIComponent(productId)}/view`, { method: "POST" }).catch(() => {});
  } catch (error) {
    toast(error.message);
  }
}

function renderProductDetail(product) {
  els.productDetail.innerHTML = "";
  const head = el("header", "sheet-head");
  const titleWrap = el("div");
  titleWrap.appendChild(el("p", "eyebrow", "商品详情"));
  titleWrap.appendChild(el("h2", null, product.name));
  head.appendChild(titleWrap);
  const close = el("button", "close-btn", "×");
  close.type = "button";
  close.dataset.close = "1";
  head.appendChild(close);
  els.productDetail.appendChild(head);

  const gallery = el("div", "detail-gallery");
  if (product.images && product.images.length) {
    product.images.forEach((url) => {
      const img = el("img");
      img.src = url;
      img.alt = product.name;
      gallery.appendChild(img);
    });
  } else {
    gallery.appendChild(el("div", "detail-no-image", "卖家没有上传图片"));
  }
  els.productDetail.appendChild(gallery);

  const priceRow = el("div", "detail-price-row");
  priceRow.appendChild(el("strong", "detail-price", `¥${formatPrice(product.price)}`));
  priceRow.appendChild(el("span", `status-pill ${product.status === "on_sale" ? "open" : "ended"}`, product.status === "on_sale" ? "在售" : product.status === "sold" ? "已出" : "已下架"));
  els.productDetail.appendChild(priceRow);
  const meta = el("div", "intel-meta detail-meta");
  meta.appendChild(el("span", null, `成色：${product.condition || "未注明"}`));
  meta.appendChild(el("span", null, `卖家：${product.seller_name}`));
  meta.appendChild(el("span", null, `发布：${product.created_at}`));
  els.productDetail.appendChild(meta);
  els.productDetail.appendChild(el("p", "detail-description", product.description || "卖家没有填写说明。"));

  const actions = el("div", "detail-actions");
  if (product.is_mine) {
    const edit = el("button", "ghost-btn", "修改");
    edit.type = "button";
    edit.addEventListener("click", () => {
      els.productDialog.close();
      openPublishDialog("edit", product);
    });
    actions.appendChild(edit);
    if (product.status === "on_sale") {
      const off = el("button", "ghost-btn", "下架");
      off.type = "button";
      off.addEventListener("click", () => updateProductStatus(product.id, "off_shelf"));
      actions.appendChild(off);
      const sold = el("button", "primary-btn", "标记已出");
      sold.type = "button";
      sold.addEventListener("click", () => updateProductStatus(product.id, "sold"));
      actions.appendChild(sold);
    } else {
      const relist = el("button", "primary-btn", "重新上架");
      relist.type = "button";
      relist.addEventListener("click", () => updateProductStatus(product.id, "on_sale"));
      actions.appendChild(relist);
    }
  } else {
    if (product.is_wanted || product.status === "on_sale") {
      const want = el("button", product.is_wanted ? "soft-btn" : "ghost-btn", product.is_wanted ? "取消想要" : "想要");
      want.type = "button";
      want.addEventListener("click", () => toggleWanted(product.id, !product.is_wanted));
      actions.appendChild(want);
    }
    if (product.status === "on_sale") {
      const contact = el("button", "primary-btn", "联系卖家");
      contact.type = "button";
      contact.addEventListener("click", () => contactSeller(product.id));
      actions.appendChild(contact);
      const report = el("button", "text-btn danger", "举报商品");
      report.type = "button";
      report.addEventListener("click", () => openReport("product", product.id, `举报商品「${product.name}」`));
      actions.appendChild(report);
    }
  }
  els.productDetail.appendChild(actions);
  els.productDetail.appendChild(el("p", "product-policy", "集市不提供支付、订单、配送或交易担保。请自行核实物品和对方身份，不要提前转账。"));
}

async function updateProductStatus(productId, status) {
  try {
    await api(`/api/market/products/${encodeURIComponent(productId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    toast(status === "sold" ? "已标记为已出" : status === "off_shelf" ? "商品已下架" : "商品已重新上架");
    els.productDialog.close();
    await refreshStatus();
    await refreshMarket();
    searchMarket();
    await refreshMyIfOpen();
  } catch (error) {
    toast(error.message);
  }
}

async function toggleWanted(productId, wanted) {
  try {
    await api(`/api/market/products/${encodeURIComponent(productId)}/wanted`, {
      method: wanted ? "POST" : "DELETE",
    });
    toast(wanted ? "已加入“想要的商品”" : "已取消想要");
    const data = await api(`/api/market/products/${encodeURIComponent(productId)}`);
    renderProductDetail(data.product);
    await refreshMyIfOpen();
  } catch (error) {
    toast(error.message);
  }
}

async function contactSeller(productId) {
  try {
    const data = await api("/api/market/conversations", {
      method: "POST",
      body: JSON.stringify({ product_id: productId }),
    });
    if (els.productDialog.open) els.productDialog.close();
    await openChat(data.conversation);
  } catch (error) {
    toast(error.message);
  }
}

async function openChat(conversation) {
  state.activeConversation = conversation;
  els.chatDialog.showModal();
  await loadThread();
  startChatPolling();
}

function startChatPolling() {
  stopChatPolling();
  state.chatTimer = window.setInterval(() => {
    if (!els.chatDialog.open) {
      stopChatPolling();
      return;
    }
    loadThread(true);
  }, 3000);
}

function stopChatPolling() {
  if (state.chatTimer) {
    window.clearInterval(state.chatTimer);
    state.chatTimer = null;
  }
}

async function loadThread(silent = false) {
  const conversation = state.activeConversation;
  if (!conversation) return;
  try {
    const data = await api(`/api/market/conversations/${encodeURIComponent(conversation.id)}/messages`);
    state.activeConversation = data.conversation;
    renderThread(data.conversation, Array.isArray(data.messages) ? data.messages : []);
  } catch (error) {
    if (!silent) toast(error.message);
  }
}

function renderThread(conversation, messages) {
  els.chatTitle.textContent = conversation.kind === "direct" ? conversation.other_name : `${conversation.role === "seller" ? "买家" : "卖家"}：${conversation.other_name}`;
  els.chatThread.innerHTML = "";
  const productLine = el("p", "thread-product", conversation.kind === "direct" ? "同学私聊" : `关于商品「${conversation.product_name}」`);
  els.chatThread.appendChild(productLine);
  if (!messages.length) {
    els.chatThread.appendChild(el("div", "thread-empty", conversation.kind === "direct" ? "还没有消息，和同学打个招呼吧。" : "还没有消息。可以先打个招呼，但不要提前转账。"));
  }
  messages.forEach((message) => {
    const row = el("div", `thread-msg ${message.mine ? "mine" : ""}`);
    const bubble = el("div", "thread-bubble");
    bubble.appendChild(el("p", null, message.body));
    const foot = el("div", "thread-foot");
    foot.appendChild(el("span", null, `${message.sender_name} · ${message.created_at}`));
    if (!message.mine) {
      const report = el("button", "thread-report", "举报");
      report.type = "button";
      report.dataset.messageReport = message.id;
      foot.appendChild(report);
    }
    bubble.appendChild(foot);
    row.appendChild(bubble);
    els.chatThread.appendChild(row);
  });
  requestAnimationFrame(() => {
    els.chatThread.scrollTop = els.chatThread.scrollHeight;
  });
}

async function sendChatMessage(event) {
  event.preventDefault();
  const body = els.chatInput.value.trim();
  const conversation = state.activeConversation;
  if (!body || !conversation) return;
  els.chatSendBtn.disabled = true;
  try {
    await api(`/api/market/conversations/${encodeURIComponent(conversation.id)}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    els.chatInput.value = "";
    await loadThread(true);
    await loadConversations();
  } catch (error) {
    toast(error.message);
  } finally {
    els.chatSendBtn.disabled = false;
  }
}

function openReport(type, id, label) {
  state.reportTarget = { type, id };
  els.reportTarget.textContent = label || "举报内容";
  els.reportReason.value = "";
  els.reportMsg.textContent = "";
  els.reportMsg.className = "form-msg";
  els.reportDialog.showModal();
}

async function submitReport() {
  if (!state.reportTarget) return;
  const reason = els.reportReason.value.trim();
  if (!reason) {
    els.reportMsg.className = "form-msg error";
    els.reportMsg.textContent = "请填写举报原因。";
    return;
  }
  els.reportSubmit.disabled = true;
  els.reportMsg.textContent = "正在提交…";
  try {
    await api("/api/reports", {
      method: "POST",
      body: JSON.stringify({
        target_type: state.reportTarget.type,
        target_id: state.reportTarget.id,
        reason,
      }),
    });
    els.reportMsg.className = "form-msg";
    els.reportMsg.textContent = "举报已提交，管理端会看到。";
    els.reportReason.value = "";
    await refreshStatus();
    window.setTimeout(() => els.reportDialog.close(), 900);
  } catch (error) {
    els.reportMsg.className = "form-msg error";
    els.reportMsg.textContent = error.message;
  } finally {
    els.reportSubmit.disabled = false;
  }
}

function openPublishDialog(mode, product) {
  state.publish = {
    mode,
    id: product?.id || null,
    images: product?.images ? [...product.images] : [],
    preview: null,
  };
  els.publishTitle.textContent = mode === "edit" ? "修改商品" : "发布商品";
  els.pubName.value = product?.name || "";
  els.pubPrice.value = product?.price ?? "";
  els.pubCondition.value = product?.condition || "";
  els.pubDescription.value = product?.description || "";
  els.publishMsg.textContent = "";
  els.publishMsg.className = "form-msg";
  els.publishFormStep.classList.remove("hidden");
  els.publishPreviewStep.classList.add("hidden");
  renderPublishImages();
  els.publishDialog.showModal();
}

function renderPublishImages() {
  els.pubImageStrip.innerHTML = "";
  state.publish.images.forEach((url) => {
    const thumb = el("div", "image-thumb");
    const img = el("img");
    img.src = url;
    img.alt = "商品图片";
    thumb.appendChild(img);
    const remove = el("button", "image-remove", "×");
    remove.type = "button";
    remove.addEventListener("click", () => {
      state.publish.images = state.publish.images.filter((item) => item !== url);
      renderPublishImages();
    });
    thumb.appendChild(remove);
    els.pubImageStrip.appendChild(thumb);
  });
}

async function handleImageFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
    toast("只支持 JPG、PNG、WEBP、GIF 图片。");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast("图片不能超过 5 MB。");
    return;
  }
  try {
    const encoded = await readFileBase64(file);
    const data = await api("/api/uploads", {
      method: "POST",
      body: JSON.stringify({ filename: file.name, data: encoded }),
    });
    if (state.imageContext === "publish") {
      if (state.publish.images.length >= 4) {
        toast("最多 4 张图片。");
        return;
      }
      state.publish.images.push(data.url);
      renderPublishImages();
    } else if (state.imageContext === "chat") {
      if (!state.currentProduct) return;
      state.currentProduct.images = [...(state.currentProduct.images || []), data.url].slice(0, 4);
      const preview = [...state.messages].reverse().find(
        (message) => message.data && message.data.kind === "product_preview",
      );
      if (preview) {
        preview.data.draft = state.currentProduct;
        preview.data.can_publish = isProductComplete(state.currentProduct);
      }
      saveChat();
      renderMessages();
      toast("图片已添加，仍要确认发布才会公开。");
    }
  } catch (error) {
    toast(error.message);
  }
}

function isProductComplete(product) {
  return Boolean(
    product &&
      String(product.name || "").trim() &&
      Number(product.price) > 0 &&
      String(product.condition || "").trim() &&
      String(product.description || "").trim(),
  );
}

function showPublishPreview() {
  const rawPrice = els.pubPrice.value.trim();
  const priceMatch = rawPrice.match(/\d+(?:\.\d+)?/);
  const product = {
    name: els.pubName.value.trim(),
    price: priceMatch ? Number(priceMatch[0]) : 0,
    condition: els.pubCondition.value.trim(),
    description: els.pubDescription.value.trim(),
    images: state.publish.images,
  };
  if (!product.name || !rawPrice || !product.condition || !product.description) {
    els.publishMsg.className = "form-msg error";
    els.publishMsg.textContent = "物品名称、价格、成色和说明都需要填写。";
    return;
  }
  if (!(Number(product.price) > 0)) {
    els.publishMsg.className = "form-msg error";
    els.publishMsg.textContent = "价格需要是大于 0 的数字。";
    return;
  }
  state.publish.preview = product;
  renderPublishPreview(product);
  els.publishFormStep.classList.add("hidden");
  els.publishPreviewStep.classList.remove("hidden");
}

function renderPublishPreview(product) {
  els.publishPreviewBody.innerHTML = "";
  const card = el("div", "product-preview");
  const head = el("div", "product-preview-head");
  head.appendChild(el("strong", null, product.name));
  head.appendChild(el("span", "price-tag", `¥${formatPrice(product.price)}`));
  card.appendChild(head);
  card.appendChild(el("p", "product-preview-meta", `成色：${product.condition}`));
  card.appendChild(el("p", "product-preview-desc", product.description));
  const strip = el("div", "image-strip");
  product.images.forEach((url) => {
    const thumb = el("div", "image-thumb");
    const img = el("img");
    img.src = url;
    img.alt = "商品图片";
    thumb.appendChild(img);
    strip.appendChild(thumb);
  });
  card.appendChild(strip);
  card.appendChild(el("p", "product-policy", `卖家昵称：${state.user?.name || "同学"}。不会展示手机号、学号或宿舍。`));
  els.publishPreviewBody.appendChild(card);
}

async function confirmPublish() {
  const product = state.publish.preview;
  if (!product) return;
  els.publishConfirm.disabled = true;
  try {
    if (state.publish.mode === "edit") {
      await api(`/api/market/products/${encodeURIComponent(state.publish.id)}`, {
        method: "PATCH",
        body: JSON.stringify(product),
      });
      toast("商品已修改");
    } else {
      await api("/api/market/products", { method: "POST", body: JSON.stringify(product) });
      toast("商品已发布");
    }
    els.publishDialog.close();
    await refreshStatus();
    await refreshMarket();
    await searchMarket();
    renderMessages();
    await refreshMyIfOpen();
  } catch (error) {
    els.publishMsg.className = "form-msg error";
    els.publishMsg.textContent = error.message;
    toast(error.message);
  } finally {
    els.publishConfirm.disabled = false;
  }
}

function openPostToMarket(messageId) {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message || !message.data) return;
  openPublishDialog("create", {
    name: String(message.data.title || "闲置转让").slice(0, 60),
    price: "",
    condition: "",
    description: String(message.data.body || "").slice(0, 1000),
    images: [],
  });
  toast("请补全价格和成色，预览确认后才会发布到集市。");
}

async function publishChatProduct(button) {
  const messageId = button.dataset.confirmProduct;
  const message = state.messages.find((item) => item.id === messageId);
  const draft = state.currentProduct || (message && message.data && message.data.draft);
  if (!draft) return;
  if (!isProductComplete(draft)) {
    toast("还缺少必要信息，先用聊天补充。");
    return;
  }
  button.disabled = true;
  try {
    const data = await api("/api/market/products", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    if (message && message.data) {
      message.data.published = true;
    }
    state.currentProduct = null;
    state.messages.push({
      id: nextId(),
      role: "assistant",
      status: "done",
      data: { kind: "product_published", product: data.product },
    });
    state.history.push({ role: "assistant", content: `已发布商品：${data.product.name}` });
    saveChat();
    renderMessages();
    await refreshStatus();
    toast("商品已发布到集市");
  } catch (error) {
    button.disabled = false;
    toast(error.message);
  }
}

function openIdentity() {
  els.identityName.value = state.user?.name || "";
  els.identityMsg.textContent = "";
  els.identityMsg.className = "form-msg";
  els.identityDialog.showModal();
}

async function saveIdentity() {
  const name = els.identityName.value.trim();
  if (!name) {
    els.identityMsg.className = "form-msg error";
    els.identityMsg.textContent = "昵称不能为空。";
    return;
  }
  els.identitySave.disabled = true;
  try {
    const data = await api("/api/me", { method: "POST", body: JSON.stringify({ name }) });
    state.user = data.user;
    els.identityMsg.className = "form-msg";
    els.identityMsg.textContent = "昵称已保存。";
    renderStatus();
    updateMyIdentityLine();
    toast("昵称已更新");
    window.setTimeout(() => els.identityDialog.close(), 700);
  } catch (error) {
    els.identityMsg.className = "form-msg error";
    els.identityMsg.textContent = error.message;
  } finally {
    els.identitySave.disabled = false;
  }
}

function openSettings() {
  els.settingsMsg.textContent = "";
  els.settingsMsg.className = "form-msg";
  els.settingKey.value = "";
  els.settingBase.value = state.baseUrl || "https://api.deepseek.com/v1";
  els.settingModel.value = state.model || "deepseek-chat";
  updateSettingsStatus();
  els.settingsDialog.showModal();
}

function updateSettingsStatus() {
  if (!els.settingsStatus) return;
  if (state.statusError) {
    els.settingsStatus.textContent = "连不上本地服务，请确认服务正在运行。";
    els.settingsDot.className = "status-dot";
    return;
  }
  if (state.aiConfigured) {
    els.settingsStatus.textContent = `已接通：${state.model || "AI 模型"}。密钥保存在本机，不会显示。`;
    els.settingsDot.className = "status-dot on";
  } else {
    els.settingsStatus.textContent = "尚未接通：填写密钥并保存后，聊天判断、课件提问、情报和写帖才能使用。";
    els.settingsDot.className = "status-dot";
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const payload = {
    base_url: els.settingBase.value.trim(),
    model: els.settingModel.value.trim(),
  };
  const key = els.settingKey.value.trim();
  if (key) payload.api_key = key;
  els.settingsMsg.className = "form-msg";
  if (!payload.base_url || !payload.model) {
    els.settingsMsg.classList.add("error");
    els.settingsMsg.textContent = "接口地址和模型名称不能为空。";
    return;
  }
  els.settingsSave.disabled = true;
  els.settingsMsg.textContent = "正在保存…";
  try {
    const data = await api("/api/config", { method: "POST", body: JSON.stringify(payload) });
    state.aiConfigured = Boolean(data.ai_configured);
    state.model = data.model || "";
    state.baseUrl = data.base_url || "";
    state.statusError = false;
    els.settingsMsg.textContent = state.aiConfigured ? "已保存，AI 已接通。回到聊天区即可使用。" : "已保存，但密钥为空，AI 仍未接通。";
    els.settingKey.value = "";
    updateSettingsStatus();
    renderStatus();
    renderNotices();
  } catch (error) {
    els.settingsMsg.classList.add("error");
    els.settingsMsg.textContent = error.message;
  } finally {
    els.settingsSave.disabled = false;
  }
}

async function clearKey() {
  if (!window.confirm("确定清除已保存的 API 密钥吗？清除后智能问答、课件提问、情报和写帖会停止使用。")) return;
  try {
    await api("/api/config", { method: "POST", body: JSON.stringify({ api_key: "" }) });
    state.aiConfigured = false;
    els.settingsMsg.className = "form-msg";
    els.settingsMsg.textContent = "密钥已清除。";
    updateSettingsStatus();
    renderStatus();
    renderNotices();
  } catch (error) {
    els.settingsMsg.className = "form-msg error";
    els.settingsMsg.textContent = error.message;
  }
}

window.addEventListener("pagehide", () => { if (state.token && els.input) saveChat(); });
document.addEventListener("DOMContentLoaded", init);
async function logoutStudent() {
  if (state.sending) { toast("请等待当前回答完成"); return; }
  saveChat();
  await fetch("/api/auth/logout", {method:"POST", headers:{"Content-Type":"application/json"}, body:"{}"});
  location.replace("/login");
}

let socialMode = "friends";
let socialLoadVersion = 0;
function openSocial() {
  const dialog = document.getElementById("socialDialog");
  if (!dialog.open) dialog.showModal();
  loadSocial();
}
async function loadSocial() {
  const version = ++socialLoadVersion;
  const list = document.getElementById("socialList");
  list.textContent = "正在加载…";
  document.querySelectorAll('[data-social-mode]').forEach(b => b.classList.toggle('active', b.dataset.socialMode === socialMode));
  try {
    if (socialMode === "messages") {
      const data = await api('/api/market/conversations');
      if (version !== socialLoadVersion) return;
      list.replaceChildren();
      data.conversations.forEach(c => { const b=el('button','history-item');b.type='button';b.appendChild(el('strong',null,c.other_name));b.appendChild(el('small',null,(c.kind==='direct'?'同学私聊':'集市咨询')+' · '+(c.last_message||'开始聊天')));b.onclick=()=>openChat(c);list.appendChild(b); });
    } else {
      const data = await api('/api/social?mode='+socialMode+'&q='+encodeURIComponent(document.getElementById('socialSearch').value));
      if (version !== socialLoadVersion) return;
      list.replaceChildren();
      data.users.forEach(u=>{
        const row=el('article','social-person');const info=el('div');info.appendChild(el('strong',null,u.name));info.appendChild(el('small',null,'账号：'+u.account));row.appendChild(info);
        const actions=el('div','social-actions');
        const button=(label,action)=>{const b=el('button','ghost-btn',label);b.type='button';b.onclick=async()=>{b.disabled=true;try{const result=await api('/api/social',{method:'POST',body:JSON.stringify({user_id:u.id,action})});if(action==='message')await openChat(result.conversation);else await loadSocial();}catch(e){toast(e.message);}finally{b.disabled=false;}};actions.appendChild(b);};
        button(u.mutual?'已互关':u.following?'已关注':'关注',u.following?'unfollow':'follow');
        if(u.friend_status==='incoming'){button('同意好友','accept');button('拒绝','decline');}
        else if(u.friend_status==='outgoing')button('撤回申请','cancel');
        else if(u.friend_status==='friends')button('解除好友','remove');
        else button('加好友','request');
        button('发消息','message');row.appendChild(actions);list.appendChild(row);
      });
    }
    if(!list.children.length)list.appendChild(el('p','history-empty',socialMode==='search'?'输入账号或昵称查找同学。':'这里暂时没有记录，搜索同学开启交流吧。'));
  } catch(e){if(version===socialLoadVersion)list.textContent=e.message;}
}
document.addEventListener('DOMContentLoaded',()=>{
 document.getElementById('socialSearchForm').onsubmit=e=>{e.preventDefault();socialMode='search';loadSocial();};
 document.querySelectorAll('[data-social-mode]').forEach(b=>b.onclick=()=>{socialMode=b.dataset.socialMode;loadSocial();});
 document.getElementById('openSocialHeader').onclick=openSocial;
});
