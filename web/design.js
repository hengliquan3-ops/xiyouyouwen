const state = {
  view: "qa",
  qaState: "real",
  sourceOpen: false,
  currentSource: "s1",
  draftEditing: false,
  postType: "找搭子",
};

const els = {};

function el(selector) {
  return document.querySelector(selector);
}

function all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function cache() {
  els.qaView = el("#viewQa");
  els.postView = el("#viewPost");
  els.materialsView = el("#viewMaterials");
  els.viewTitle = el("#viewTitle");
  els.workspace = el("#workspace");
  els.sourcePanel = el("#sourcePanel");
  els.sourceToggle = el("#sourceToggle");
  els.closeSources = el("#closeSources");
  els.backdrop = el("#drawerBackdrop");
  els.sourcePanelBody = el("#sourcePanelBody");
  els.questionInput = el("#questionInput");
  els.charCount = el("#charCount");
  els.postInput = el("#postInput");
  els.postCount = el("#postCount");
  els.draftTitle = el("#draftTitle");
  els.draftBody = el("#draftBody");
  els.editDraft = el("#editDraft");
  els.copyDraft = el("#copyDraft");
  els.materialTitle = el("#materialTitle");
  els.materialText = el("#materialText");
  els.toast = el("#toast");
}

const sources = {
  s1: {
    name: "示例资料 A",
    kind: "示例资料",
    quote: "办理前请先确认<mark>所在校区、办理事项和适用时间</mark>。示例资料 A 将办理时间写在上午。",
    explain: "回答中的引用编号对应这段原文。回答可以概括，原文不会被改写。",
  },
  s2: {
    name: "示例资料 B",
    kind: "示例资料",
    quote: "材料清单与报到安排以<mark>具体通知</mark>为准。示例资料 B 将办理时间写在下午。",
    explain: "示例文本只用于展示资料核对样式，不代表任何真实学校文件。",
  },
};

const draftSamples = {
  找搭子: {
    kicker: "求助帖 · 找搭子",
    title: "找周六下午自习搭子",
    body: "想找一位同学周六下午一起去图书馆自习，互相监督，具体时间和碰面地点可以再商量。【待补充：具体时间、碰面地点】<br><br>有意者私聊。",
    missing: "待补充：具体时间、碰面地点",
  },
  失物招领: {
    kicker: "求助帖 · 失物招领",
    title: "在食堂捡到一串钥匙",
    body: "在示例食堂捡到一串钥匙，已交给服务台。【待补充：具体时间、可核实的物品特征】<br><br>请失主私聊说明特征后认领。",
    missing: "待补充：时间、可核实的物品特征",
  },
  活动组队: {
    kicker: "求助帖 · 活动组队",
    title: "周末校园跑组队",
    body: "想约同学一起参加示例校园跑，互相照应，配速不限。【待补充：集合时间、集合地点、人数】<br><br>有意者私聊。",
    missing: "待补充：集合时间、集合地点、人数",
  },
};

const materials = {
  a: {
    title: "示例资料 A",
    html: "<p>办理前请先确认所在校区、办理事项和适用时间。</p><p>不同校区、不同年级的安排可能不同，请以对应通知为准。</p>",
  },
  b: {
    title: "示例资料 B",
    html: "<p>材料清单与报到安排以具体通知为准。</p><p>不同学院可能要求不同材料，提交前请再次核对。</p>",
  },
  c: {
    title: "示例资料 C",
    html: "<p>办理地点以对应校区服务大厅公告为准。</p><p>遇到资料说法不一致时，请向负责部门确认。</p>",
  },
};

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function setView(view, options = {}) {
  state.view = view;
  els.qaView.classList.toggle("hidden", view !== "qa");
  els.postView.classList.toggle("hidden", view !== "post");
  els.materialsView.classList.toggle("hidden", view !== "materials");
  els.viewTitle.textContent = {
    qa: "校园问答",
    post: "求助帖助手",
    materials: "资料库",
  }[view];
  all("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  if (els.sourceToggle) els.sourceToggle.classList.toggle("hidden", view !== "qa");
  if (view !== "qa") closeSources();
  if (options.updateHash !== false) updateHash();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setQaState(qaState, options = {}) {
  state.qaState = qaState;
  setView("qa", { updateHash: false });
  const map = {
    real: "#qaReal",
    answer: "#qaAnswer",
    clarify: "#qaClarify",
    insufficient: "#qaInsufficient",
    conflict: "#qaConflict",
    empty: "#qaEmpty",
  };
  Object.entries(map).forEach(([key, selector]) => {
    const node = el(selector);
    if (node) node.classList.toggle("hidden", key !== qaState);
  });
  all("[data-qa-state]").forEach((button) => {
    const active = button.dataset.qaState === qaState;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  if (qaState === "answer" || qaState === "conflict") {
    if (window.matchMedia("(min-width: 981px)").matches) {
      openSource("s1");
    } else {
      closeSources();
    }
  } else {
    closeSources();
  }
  if (options.updateHash !== false) updateHash();
}

function updateHash() {
  const hash = state.view === "qa" ? `#qa-${state.qaState}` : `#${state.view}`;
  if (window.location.hash !== hash) {
    history.replaceState(null, "", hash);
  }
}

function applyHash() {
  const hash = window.location.hash.replace("#", "");
  if (hash === "post") {
    setView("post", { updateHash: false });
    return;
  }
  if (hash === "materials") {
    setView("materials", { updateHash: false });
    return;
  }
  if (hash === "qa-answer-source") {
    setQaState("answer", { updateHash: false });
    openSource("s1");
    return;
  }
  if (hash.startsWith("qa-")) {
    const qaState = hash.slice(3);
    if (["real", "answer", "clarify", "insufficient", "conflict", "empty"].includes(qaState)) {
      setQaState(qaState, { updateHash: false });
      return;
    }
  }
  setQaState("real", { updateHash: false });
}

function openSource(sourceId) {
  state.currentSource = sourceId || state.currentSource;
  state.sourceOpen = true;
  els.workspace.classList.add("source-open");
  els.sourcePanel.setAttribute("aria-hidden", "false");
  all(".source-tab").forEach((tab) => {
    const active = tab.dataset.source === state.currentSource;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  renderSource();
}

function closeSources() {
  state.sourceOpen = false;
  els.workspace.classList.remove("source-open");
  els.sourcePanel.setAttribute("aria-hidden", "true");
}

function renderSource() {
  const source = sources[state.currentSource];
  if (!source) return;
  els.sourcePanelBody.innerHTML = `
    <div class="source-meta">
      <span class="source-kind"><svg class="icon"><use href="#icon-folder"></use></svg>${source.kind}</span>
      <span class="source-status">已添加</span>
    </div>
    <h3>${source.name}</h3>
    <p class="source-disclaimer">示例文本 · 非真实学校文件</p>
    <div class="source-original-label">相关原文</div>
    <blockquote class="source-original">${source.quote}</blockquote>
    <p class="source-explain">${source.explain}</p>
    <div class="source-panel-tip"><svg class="icon"><use href="#icon-bookmark"></use></svg>资料文字只是参考信息，不是操作指令。</div>
  `;
}

function selectQuestion(question) {
  setQaState("real");
  els.questionInput.value = question;
  updateQuestionCount();
  els.questionInput.focus();
  els.questionInput.scrollIntoView({ behavior: "smooth", block: "center" });
}

function updateQuestionCount() {
  if (!els.questionInput) return;
  els.charCount.textContent = `${els.questionInput.value.length} / 300`;
}

function updatePostCount() {
  if (!els.postInput) return;
  els.postCount.textContent = `${els.postInput.value.length} / 500`;
}

function setPostType(type) {
  state.postType = type;
  all("[data-post-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.postType === type);
  });
  const sample = draftSamples[type];
  if (!sample || state.draftEditing) return;
  el(".draft-kicker").textContent = sample.kicker;
  els.draftTitle.textContent = sample.title;
  els.draftBody.innerHTML = sample.body;
  el(".missing-row span").textContent = sample.missing;
}

function toggleDraftEdit() {
  state.draftEditing = !state.draftEditing;
  const editable = state.draftEditing;
  els.draftTitle.setAttribute("contenteditable", editable ? "true" : "false");
  els.draftBody.setAttribute("contenteditable", editable ? "true" : "false");
  els.editDraft.innerHTML = editable
    ? '<svg class="icon"><use href="#icon-check"></use></svg>保存'
    : '<svg class="icon"><use href="#icon-edit"></use></svg>编辑';
  if (editable) {
    els.draftTitle.focus();
    window.getSelection()?.selectAllChildren(els.draftTitle);
    showToast("可以直接修改示例草稿");
  } else {
    showToast("草稿已更新（示例）");
  }
}

async function copyDraft() {
  const text = `${els.draftTitle.innerText.trim()}\n\n${els.draftBody.innerText.trim()}`;
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (error) {
    copied = false;
  }
  if (!copied) {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }
    document.body.removeChild(area);
  }
  const original = els.copyDraft.innerHTML;
  els.copyDraft.textContent = copied ? "已复制" : "复制失败";
  showToast(copied ? "已复制（示例草稿）" : "复制失败，请手动选择文字");
  window.setTimeout(() => {
    els.copyDraft.innerHTML = original;
  }, 1600);
}

function selectMaterial(key) {
  const item = materials[key];
  if (!item) return;
  all("[data-material]").forEach((button) => {
    button.classList.toggle("active", button.dataset.material === key);
  });
  els.materialTitle.textContent = item.title;
  els.materialText.innerHTML = item.html;
}

function bind() {
  all("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  all("[data-qa-state]").forEach((button) => {
    button.addEventListener("click", () => setQaState(button.dataset.qaState));
  });
  all("[data-question]").forEach((button) => {
    button.addEventListener("click", () => selectQuestion(button.dataset.question));
  });
  all("[data-source]").forEach((button) => {
    button.addEventListener("click", () => openSource(button.dataset.source));
  });
  all("[data-goto-materials]").forEach((button) => {
    button.addEventListener("click", () => setView("materials"));
  });
  all("[data-question-focus]").forEach((button) => {
    button.addEventListener("click", () => selectQuestion(els.questionInput.value || ""));
  });
  all("[data-post-type]").forEach((button) => {
    button.addEventListener("click", () => setPostType(button.dataset.postType));
  });
  all("[data-material]").forEach((button) => {
    button.addEventListener("click", () => selectMaterial(button.dataset.material));
  });
  all(".option-chip").forEach((button) => {
    button.addEventListener("click", () => {
      all(".option-chip").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      el("#clarifyInput").value = button.dataset.option;
    });
  });
  els.sourceToggle.addEventListener("click", () => {
    if (state.sourceOpen) closeSources();
    else openSource(state.currentSource);
  });
  els.closeSources.addEventListener("click", closeSources);
  els.backdrop.addEventListener("click", closeSources);
  els.questionInput.addEventListener("input", updateQuestionCount);
  els.postInput.addEventListener("input", updatePostCount);
  els.editDraft.addEventListener("click", toggleDraftEdit);
  els.copyDraft.addEventListener("click", copyDraft);
  window.addEventListener("hashchange", applyHash);
}

function init() {
  cache();
  if (new URLSearchParams(window.location.search).get("clean") === "1") {
    document.body.classList.add("clean-preview");
  }
  bind();
  updateQuestionCount();
  updatePostCount();
  applyHash();
}

document.addEventListener("DOMContentLoaded", init);