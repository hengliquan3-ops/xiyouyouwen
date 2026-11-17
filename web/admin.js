const state = {
  configured: false,
  authenticated: false,
  section: "overview",
  ai: { configured: false, model: "", baseUrl: "" },
  materials: [],
  notices: [],
  reports: [],
};

const els = {};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function cacheElements() {
  const ids = [
    "authView", "adminApp", "authEyebrow", "authTitle", "authDesc", "authMsg",
    "setupForm", "setupKey", "setupKey2", "setupBtn", "loginForm", "loginKey", "loginBtn",
    "adminNav", "sectionTitle", "adminBadge", "logoutSide", "logoutTop", "logoutBottom",
    "backToStudentTop", "backToStudentSide", "adminPublicWarning",
    "sectionOverview", "sectionMaterials", "sectionNotices", "sectionReports", "sectionAi", "sectionSecurity",
    "statMaterials", "statNotices", "statEnded", "statProducts", "statReports", "statUsers", "statAI", "statModel",
    "materialForm", "matName", "matContent", "matSubmit", "matFormMsg", "materialList", "matListCount",
    "noticeForm", "noticeTitle", "noticeSource", "noticePublished", "noticeEvent", "noticeDeadline",
    "noticeBody", "noticeFormMsg", "noticeSubmit", "noticeList", "noticeListCount",
    "reportList", "aiDot", "aiStatusText", "aiForm", "aiKey", "aiBase", "aiModel", "aiMsg", "aiSave", "aiClear",
    "securityForm", "currentKey", "newKey", "newKey2", "securityMsg", "changeKeyBtn", "toast",
  ];
  ids.forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

async function api(path, options = {}) {
  const init = { ...options, credentials: "same-origin" };
  init.headers = { "Content-Type": "application/json", ...(options.headers || {}) };
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
  if (!response.ok) {
    const failure = new Error(data.message || `请求失败（HTTP ${response.status}）`);
    failure.code = data.error || "http_error";
    if (response.status === 401 && failure.code === "admin_auth_required") {
      state.authenticated = false;
      showAuth("login", "登录已过期，请重新输入管理密钥。");
    }
    throw failure;
  }
  return data;
}

function bindEvents() {
  els.setupForm.addEventListener("submit", setupAdmin);
  els.loginForm.addEventListener("submit", loginAdmin);
  [els.logoutSide, els.logoutTop, els.logoutBottom].forEach((button) => {
    if (button) button.addEventListener("click", logoutAdmin);
  });
  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => switchSection(button.dataset.section));
  });
  els.materialForm.addEventListener("submit", addMaterial);
  els.noticeForm.addEventListener("submit", addNotice);
  els.aiForm.addEventListener("submit", saveAi);
  els.aiClear.addEventListener("click", clearAi);
  els.securityForm.addEventListener("submit", changeKey);
  document.addEventListener("click", handleGlobalClick);
}

function handleGlobalClick(event) {
  const materialDelete = event.target.closest("[data-mat-del]");
  if (materialDelete) deleteMaterial(materialDelete.dataset.matDel);
  const noticeDelete = event.target.closest("[data-notice-del]");
  if (noticeDelete) deleteNotice(noticeDelete.dataset.noticeDel);
  const reportAction = event.target.closest("[data-report-action]");
  if (reportAction) {
    updateReport(
      reportAction.dataset.reportAction,
      reportAction.dataset.status,
      reportAction.dataset.takeDown === "1",
    );
  }
}

function toast(text) {
  els.toast.textContent = text;
  els.toast.classList.remove("hidden");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.add("hidden"), 2400);
}

function showMessage(node, text, error = false) {
  node.textContent = text;
  node.className = `form-msg ${error ? "error" : ""}`;
}

function configureAccessLinks() {
  const host = window.location.hostname;
  const local = host === "127.0.0.1" || host === "localhost" || host === "::1";
  [els.backToStudentTop, els.backToStudentSide].forEach((link) => {
    if (!link) return;
    if (local) {
      link.href = "http://127.0.0.1:8000/";
      link.classList.remove("hidden");
    } else {
      link.classList.add("hidden");
    }
  });
  if (els.adminPublicWarning) {
    els.adminPublicWarning.classList.toggle("hidden", local);
  }
}

async function init() {
  cacheElements();
  bindEvents();
  configureAccessLinks();
  if (els.noticePublished && !els.noticePublished.value) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    els.noticePublished.value = `${yyyy}-${mm}-${dd}`;
  }
  await checkAuth();
}

async function checkAuth() {
  try {
    const data = await api("/api/admin/me");
    state.configured = Boolean(data.configured);
    state.authenticated = Boolean(data.authenticated);
  } catch (error) {
    showAuth("login", error.message);
    return;
  }
  if (!state.configured) {
    showAuth("setup", "");
    return;
  }
  if (!state.authenticated) {
    showAuth("login", "");
    return;
  }
  await enterAdmin();
}

function showAuth(mode, message) {
  els.authView.classList.remove("hidden");
  els.adminApp.classList.add("hidden");
  els.setupForm.classList.toggle("hidden", mode !== "setup");
  els.loginForm.classList.toggle("hidden", mode !== "login");
  if (mode === "setup") {
    els.authEyebrow.textContent = "首次使用 · 管理端";
    els.authTitle.textContent = "设置管理密钥";
    els.authDesc.textContent = "第一次进入管理端，请先设置一个管理密钥。之后每次进入都要输入它。";
    els.setupKey.value = "";
    els.setupKey2.value = "";
    els.setupKey.focus();
  } else {
    els.authEyebrow.textContent = "维护者入口";
    els.authTitle.textContent = "管理端登录";
    els.authDesc.textContent = "学生端不需要登录；这里只给维护者使用。请输入管理密钥。";
    els.loginKey.value = "";
    els.loginKey.focus();
  }
  showMessage(els.authMsg, message || "", Boolean(message));
}

async function setupAdmin(event) {
  event.preventDefault();
  const key = els.setupKey.value;
  const confirm = els.setupKey2.value;
  if (key.length < 8) {
    showMessage(els.authMsg, "管理密钥至少需要 8 个字符。", true);
    return;
  }
  if (key !== confirm) {
    showMessage(els.authMsg, "两次输入的密钥不一致。", true);
    return;
  }
  els.setupBtn.disabled = true;
  showMessage(els.authMsg, "正在保存…");
  try {
    const data = await api("/api/admin/setup", { method: "POST", body: JSON.stringify({ key }) });
    state.configured = true;
    state.authenticated = Boolean(data.authenticated);
    await enterAdmin();
    toast("管理密钥已设置");
  } catch (error) {
    showMessage(els.authMsg, error.message, true);
  } finally {
    els.setupBtn.disabled = false;
  }
}

async function loginAdmin(event) {
  event.preventDefault();
  const key = els.loginKey.value;
  if (!key) {
    showMessage(els.authMsg, "请输入管理密钥。", true);
    return;
  }
  els.loginBtn.disabled = true;
  showMessage(els.authMsg, "正在验证…");
  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify({ key }) });
    state.authenticated = true;
    await enterAdmin();
  } catch (error) {
    showMessage(els.authMsg, error.message, true);
  } finally {
    els.loginBtn.disabled = false;
  }
}

async function logoutAdmin() {
  try {
    await api("/api/admin/logout", { method: "POST", body: "{}" });
  } catch (error) {
    return;
  }
  state.authenticated = false;
  state.configured = true;
  showAuth("login", "已经退出管理端。");
}

async function enterAdmin() {
  els.authView.classList.add("hidden");
  els.adminApp.classList.remove("hidden");
  els.adminBadge.textContent = "已登录";
  switchSection("overview");
  await loadOverview();
}

function switchSection(section) {
  state.section = section;
  document.querySelectorAll("[data-section]").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === section);
  });
  const names = {
    overview: "概览",
    materials: "学校资料",
    notices: "校园通知",
    reports: "举报处理",
    ai: "AI 设置",
    security: "安全",
  };
  els.sectionTitle.textContent = names[section] || "管理端";
  ["Overview", "Materials", "Notices", "Reports", "Ai", "Security"].forEach((name) => {
    const node = els[`section${name}`];
    if (node) node.classList.toggle("hidden", name.toLowerCase() !== section);
  });
  if (section === "overview" || section === "ai") loadOverview();
  if (section === "materials") loadMaterials();
  if (section === "notices") loadNotices();
  if (section === "reports") loadReports();
}

async function loadOverview() {
  try {
    const data = await api("/api/admin/overview");
    els.statUsers.textContent = String(data.registered_users || 0);
    els.statMaterials.textContent = String(data.material_count || 0);
    els.statNotices.textContent = String(data.notice_count || 0);
    els.statEnded.textContent = String(data.notice_ended || 0);
    els.statProducts.textContent = String(data.product_on_sale || 0);
    els.statReports.textContent = String(data.open_reports || 0);
    els.statAI.textContent = data.ai_configured ? "已接通" : "未接通";
    els.statAI.classList.toggle("off", !data.ai_configured);
    els.statModel.textContent = data.model || "";
    state.ai = {
      configured: Boolean(data.ai_configured),
      model: data.model || "",
      baseUrl: data.base_url || "",
    };
    updateAiStatus();
  } catch (error) {
    if (error.code !== "admin_auth_required") toast(error.message);
  }
}

function updateAiStatus() {
  if (state.ai.configured) {
    els.aiStatusText.textContent = `已接通：${state.ai.model || "AI 模型"}。密钥只保存在本机。`;
    els.aiDot.className = "status-dot on";
  } else {
    els.aiStatusText.textContent = "尚未接通：填写 API 密钥并保存后，学生端的问答、课件、情报和帖子才能使用。";
    els.aiDot.className = "status-dot";
  }
  els.aiBase.value = state.ai.baseUrl || "https://api.deepseek.com/v1";
  els.aiModel.value = state.ai.model || "deepseek-chat";
}

async function loadMaterials() {
  els.materialList.innerHTML = "";
  try {
    const data = await api("/api/materials");
    state.materials = Array.isArray(data.materials) ? data.materials : [];
    renderMaterials();
  } catch (error) {
    els.materialList.appendChild(el("div", "mat-empty", error.message));
  }
}

function renderMaterials() {
  els.materialList.innerHTML = "";
  els.matListCount.textContent = `${state.materials.length} 份`;
  if (!state.materials.length) {
    els.materialList.appendChild(el("div", "mat-empty", "还没有学校资料。学生端问校园问题时，将没有可依据的内容。"));
    return;
  }
  state.materials.forEach((material) => {
    const item = el("div", "mat-item");
    const row = el("div", "mat-row");
    const toggle = el("button", "mat-toggle");
    toggle.type = "button";
    toggle.appendChild(el("strong", null, material.name));
    toggle.appendChild(el("small", null, `${material.content.length} 字 · ${material.created_at || ""} · 点击查看原文`));
    const content = el("pre", "mat-content hidden", material.content);
    toggle.addEventListener("click", () => content.classList.toggle("hidden"));
    const remove = el("button", "mat-del", "删除");
    remove.type = "button";
    remove.dataset.matDel = material.id;
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
  if (!name || !content) {
    showMessage(els.matFormMsg, "请填写资料名称和内容。", true);
    return;
  }
  els.matSubmit.disabled = true;
  showMessage(els.matFormMsg, "正在保存…");
  try {
    await api("/api/materials", { method: "POST", body: JSON.stringify({ name, content }) });
    els.matName.value = "";
    els.matContent.value = "";
    showMessage(els.matFormMsg, "资料已添加。学生端现在可以依据它问答。");
    await loadMaterials();
    await loadOverview();
    toast("资料已添加");
  } catch (error) {
    showMessage(els.matFormMsg, error.message, true);
  } finally {
    els.matSubmit.disabled = false;
  }
}

async function deleteMaterial(id) {
  const material = state.materials.find((item) => item.id === id);
  if (!material) return;
  if (!window.confirm(`确定删除资料「${material.name}」吗？删除后学生端将不再引用它。`)) return;
  try {
    await api(`/api/materials/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadMaterials();
    await loadOverview();
    toast("资料已删除");
  } catch (error) {
    toast(error.message);
  }
}

async function loadNotices() {
  els.noticeList.innerHTML = "";
  try {
    const data = await api("/api/notices");
    state.notices = Array.isArray(data.notices) ? data.notices : [];
    renderNotices();
  } catch (error) {
    els.noticeList.appendChild(el("div", "mat-empty", error.message));
  }
}

function renderNotices() {
  els.noticeList.innerHTML = "";
  els.noticeListCount.textContent = `${state.notices.length} 条`;
  if (!state.notices.length) {
    els.noticeList.appendChild(el("div", "mat-empty", "还没有校园通知。学生端查询校园消息时将没有内容。"));
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
    remove.dataset.noticeDel = notice.id;
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
  if (!payload.title || !payload.source || !payload.body) {
    showMessage(els.noticeFormMsg, "标题、来源和正文都需要填写。", true);
    return;
  }
  els.noticeSubmit.disabled = true;
  showMessage(els.noticeFormMsg, "正在保存…");
  try {
    await api("/api/notices", { method: "POST", body: JSON.stringify(payload) });
    els.noticeTitle.value = "";
    els.noticeSource.value = "";
    els.noticeEvent.value = "";
    els.noticeDeadline.value = "";
    els.noticeBody.value = "";
    showMessage(els.noticeFormMsg, "通知已添加。学生端可以查询校园消息和截止时间。");
    await loadNotices();
    await loadOverview();
    toast("通知已添加");
  } catch (error) {
    showMessage(els.noticeFormMsg, error.message, true);
  } finally {
    els.noticeSubmit.disabled = false;
  }
}

async function deleteNotice(id) {
  if (!window.confirm("确定删除这条通知吗？学生端将不再引用它。")) return;
  try {
    await api(`/api/notices/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadNotices();
    await loadOverview();
    toast("通知已删除");
  } catch (error) {
    toast(error.message);
  }
}

async function loadReports() {
  els.reportList.innerHTML = "";
  try {
    const data = await api("/api/reports");
    state.reports = Array.isArray(data.reports) ? data.reports : [];
    renderReports();
  } catch (error) {
    els.reportList.appendChild(el("div", "mat-empty", error.message));
  }
}

function renderReports() {
  els.reportList.innerHTML = "";
  if (!state.reports.length) {
    els.reportList.appendChild(el("div", "mat-empty", "目前没有举报。"));
    return;
  }
  state.reports.forEach((report) => {
    const card = el("article", `admin-report ${report.status}`);
    const head = el("div", "intel-head");
    head.appendChild(el("h4", null, report.target_label || "举报内容"));
    const statusText = report.status === "open" ? "待处理" : report.status === "resolved" ? "已处理" : "已忽略";
    head.appendChild(el("span", `status-pill ${report.status === "open" ? "soon" : "unknown"}`, statusText));
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
    await loadOverview();
    toast(takeDown ? "已下架商品并处理举报" : "举报状态已更新");
  } catch (error) {
    toast(error.message);
  }
}

async function saveAi(event) {
  event.preventDefault();
  const payload = {
    base_url: els.aiBase.value.trim(),
    model: els.aiModel.value.trim(),
  };
  const key = els.aiKey.value.trim();
  if (key) payload.api_key = key;
  if (!payload.base_url || !payload.model) {
    showMessage(els.aiMsg, "接口地址和模型名称不能为空。", true);
    return;
  }
  els.aiSave.disabled = true;
  showMessage(els.aiMsg, "正在保存…");
  try {
    const data = await api("/api/config", { method: "POST", body: JSON.stringify(payload) });
    state.ai.configured = Boolean(data.ai_configured);
    state.ai.model = data.model || "";
    state.ai.baseUrl = data.base_url || "";
    els.aiKey.value = "";
    updateAiStatus();
    await loadOverview();
    showMessage(els.aiMsg, data.ai_configured ? "已保存，AI 已接通。学生端现在可以使用。" : "已保存，但密钥为空，AI 仍未接通。");
    toast("AI 设置已保存");
  } catch (error) {
    showMessage(els.aiMsg, error.message, true);
  } finally {
    els.aiSave.disabled = false;
  }
}

async function clearAi() {
  if (!window.confirm("确定清除 AI 密钥吗？学生端的聊天、课件、情报和帖子会停止使用 AI。")) return;
  try {
    await api("/api/config", { method: "POST", body: JSON.stringify({ api_key: "" }) });
    state.ai.configured = false;
    updateAiStatus();
    await loadOverview();
    showMessage(els.aiMsg, "AI 密钥已清除。");
    toast("AI 密钥已清除");
  } catch (error) {
    showMessage(els.aiMsg, error.message, true);
  }
}

async function changeKey(event) {
  event.preventDefault();
  const current = els.currentKey.value;
  const next = els.newKey.value;
  const confirm = els.newKey2.value;
  if (!current || !next) {
    showMessage(els.securityMsg, "请填写当前密钥和新密钥。", true);
    return;
  }
  if (next.length < 8) {
    showMessage(els.securityMsg, "新密钥至少需要 8 个字符。", true);
    return;
  }
  if (next !== confirm) {
    showMessage(els.securityMsg, "两次输入的新密钥不一致。", true);
    return;
  }
  els.changeKeyBtn.disabled = true;
  showMessage(els.securityMsg, "正在修改…");
  try {
    await api("/api/admin/change-key", {
      method: "POST",
      body: JSON.stringify({ current_key: current, new_key: next }),
    });
    els.currentKey.value = "";
    els.newKey.value = "";
    els.newKey2.value = "";
    showMessage(els.securityMsg, "管理密钥已修改，当前登录仍然有效。");
    toast("管理密钥已修改");
  } catch (error) {
    showMessage(els.securityMsg, error.message, true);
  } finally {
    els.changeKeyBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", init);