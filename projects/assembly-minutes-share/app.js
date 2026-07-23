import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAiViewModel, cleanText, formatNumber, retrievalLabel } from "./ui-state.js";

const SUPABASE_URL = "https://ltmrtmavgjlflvcbahpy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_G7KWaNGrMUE-5bZ4XxmiQg_sO-ZEaUC";
const ASSEMBLY_BRIEF_URL = `${SUPABASE_URL}/functions/v1/assembly-brief`;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const startDateEl = document.getElementById("startDate");
const endDateEl = document.getElementById("endDate");
const searchInputEl = document.getElementById("searchInput");
const refreshBtnEl = document.getElementById("refreshBtn");
const modeCommitteeBtnEl = document.getElementById("modeCommitteeBtn");
const modeSpeakerBtnEl = document.getElementById("modeSpeakerBtn");
const statusLineEl = document.getElementById("statusLine");
const treeRootEl = document.getElementById("treeRoot");
const treeSummaryEl = document.getElementById("treeSummary");
const detailMetaEl = document.getElementById("detailMeta");
const detailBoxEl = document.getElementById("detailBox");
const tableBodyEl = document.getElementById("tableBody");
const tableMetaEl = document.getElementById("tableMeta");
const kpiRowsEl = document.getElementById("kpiRows");
const kpiCommitteesEl = document.getElementById("kpiCommittees");
const kpiSpeakersEl = document.getElementById("kpiSpeakers");
const kpiDayEl = document.getElementById("kpiDay");
const aiQuestionEl = document.getElementById("aiQuestion");
const aiBtnEl = document.getElementById("aiBtn");
const aiResultEl = document.getElementById("aiResult");
const aiTraceEl = document.getElementById("aiTrace");
const aiStatusEl = document.getElementById("aiStatus");
const syncMetaEl = document.getElementById("syncMeta");
const modelMetaEl = document.getElementById("modelMeta");
const vectorMetaEl = document.getElementById("vectorMeta");
let recordMetaEl = document.getElementById("recordMeta");
let recordListEl = document.getElementById("recordList");
let agendaMetaEl = document.getElementById("agendaMeta");
let agendaListEl = document.getElementById("agendaList");

const state = {
  rows: [],
  filteredRows: [],
  selectedId: null,
  mode: "committee",
  aiMode: "unknown",
};

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
}

function shiftDay(day, delta) {
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  d.setDate(d.getDate() + delta);
  return isoDay(d);
}

function normalizeLabel(value, fallback = "미상") {
  const text = String(value ?? "")
    .replace(/\bnan\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  const lowered = text.toLowerCase();
  if (["n/a", "na", "null", "undefined", "unknown"].includes(lowered)) return fallback;
  return text;
}

function committeeSegments(committee) {
  const raw = normalizeLabel(committee, "위원회 미상");
  const parts = raw.split("-").map((item) => item.trim()).filter(Boolean);
  return parts.length ? parts : [raw];
}

function shortText(text, length = 84) {
  const clean = cleanText(text);
  return clean.length > length ? `${clean.slice(0, length)}...` : clean;
}

function setSyncMeta(latestDate) {
  if (!syncMetaEl) return;
  syncMetaEl.textContent = latestDate
    ? `최종 동기화 기준일: ${latestDate}`
    : "최종 동기화 기준일 확인 불가";
}

function setVectorMeta(text) {
  if (!vectorMetaEl) return;
  vectorMetaEl.textContent = text || "벡터 적재 범위 확인 불가";
}

function setModelMeta(mode = "", retrievalMode = "") {
  const retrieval = retrievalMode ? ` · ${retrievalLabel(retrievalMode)}` : "";
  if (!modelMetaEl) return;
  if (mode === "minimax") {
    modelMetaEl.textContent = `AI 요약: MiniMax 응답 확인${retrieval}`;
    return;
  }
  if (mode === "fallback") {
    modelMetaEl.textContent = `AI 요약: 로컬 대체 요약 사용 중${retrieval}`;
    return;
  }
  modelMetaEl.textContent = `AI 요약: MiniMax 연계${retrieval}`;
}

function setAiOutputs(answerText, traceLines = []) {
  aiResultEl.textContent = answerText || "??? ?? ????.";
  aiResultEl.classList.remove("empty");
  if (aiTraceEl) {
    aiTraceEl.textContent = (traceLines || []).join("
") || "?? ??? ?? ????.";
    aiTraceEl.classList.remove("empty");
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ensureInfoPanels() {
  if (recordMetaEl && recordListEl && agendaMetaEl && agendaListEl) return;

  if (!document.getElementById("assembly-share-inline-style")) {
    const style = document.createElement("style");
    style.id = "assembly-share-inline-style";
    style.textContent = `
      .info-grid { margin-top: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      .mini-list { display: grid; gap: 10px; }
      .mini-item { border: 1px solid var(--line); border-radius: 16px; background: #fbfcfb; padding: 14px; }
      .mini-item strong { display: block; margin-bottom: 6px; font-size: 15px; }
      .mini-item p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.65; }
      .mini-links { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
      .mini-link { display: inline-flex; align-items: center; padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px; background: white; color: var(--accent); font-size: 12px; text-decoration: none; }
      @media (max-width: 1024px) { .info-grid { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  const kpisSection = document.querySelector(".kpis");
  if (!kpisSection) return;

  const wrapper = document.createElement("section");
  wrapper.className = "info-grid";
  wrapper.innerHTML = `
    <article class="card panel">
      <div class="panel-head">
        <h2>의정 기록</h2>
        <span id="recordMeta" class="panel-meta">최근 회의 단위 기록</span>
      </div>
      <div id="recordList" class="mini-list"></div>
    </article>
    <article class="card panel">
      <div class="panel-head">
        <h2>관련 정보</h2>
        <span id="agendaMeta" class="panel-meta">주요 안건과 발언자</span>
      </div>
      <div id="agendaList" class="mini-list"></div>
    </article>
  `;
  kpisSection.insertAdjacentElement("afterend", wrapper);
  recordMetaEl = document.getElementById("recordMeta");
  recordListEl = document.getElementById("recordList");
  agendaMetaEl = document.getElementById("agendaMeta");
  agendaListEl = document.getElementById("agendaList");
}

function enrichRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    session_id: cleanText(row.session_id, ""),
    meeting_date: row.meeting_date || "",
    meeting_type: normalizeLabel(row.meeting_type, "회의유형 미상"),
    speaker: normalizeLabel(row.speaker, "발언자 미상"),
    committee: normalizeLabel(row.committee, "위원회 미상"),
    committee_path: committeeSegments(row.committee).join(" > "),
    agenda: cleanText(row.agenda1 || row.agenda2 || "안건 미상", "안건 미상"),
    speech_text: cleanText(row.speech_text),
    speech_preview: shortText(row.speech_text, 96),
  }));
}

function filterRows(rows, query) {
  const q = cleanText(query).toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const hay = [row.speaker, row.committee_path, row.agenda, row.speech_text, row.meeting_type]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function buildAssemblyTree(rows, mode = "committee") {
  const roots = [];
  const rootMap = new Map();
  const childMap = new Map();

  const ensureNode = (map, key, builder, parentChildren = null) => {
    if (map.has(key)) return map.get(key);
    const node = builder();
    map.set(key, node);
    if (parentChildren) parentChildren.push(node);
    else roots.push(node);
    return node;
  };

  const sortedRows = [...rows].sort((a, b) => {
    const d = String(b.meeting_date || "").localeCompare(String(a.meeting_date || ""));
    if (d !== 0) return d;
    return String(a.speaker || "").localeCompare(String(b.speaker || ""), "ko");
  });

  for (const row of sortedRows) {
    const speaker = row.speaker;
    const committeeParts = committeeSegments(row.committee);
    const leafLabel = `${shortText(row.speech_text, 54)} (${row.meeting_date || "-"})`;

    if (mode === "committee") {
      let parentChildren = null;
      let pathKey = "";
      for (const part of committeeParts) {
        pathKey = `${pathKey}/${part}`;
        const node = ensureNode(
          childMap,
          `committee:${pathKey}`,
          () => ({ id: `committee:${pathKey}`, label: part, count: 0, meta: {}, children: [] }),
          parentChildren,
        );
        node.count += 1;
        parentChildren = node.children;
      }
      const speakerKey = `${pathKey}/speaker:${speaker}`;
      const speakerNode = ensureNode(
        childMap,
        speakerKey,
        () => ({ id: speakerKey, label: speaker, count: 0, meta: { speaker }, children: [] }),
        parentChildren,
      );
      speakerNode.count += 1;
      speakerNode.children.push({
        id: `utterance:${row.utterance_id}`,
        label: leafLabel,
        count: 1,
        meta: { utteranceId: row.utterance_id },
        children: [],
      });
      continue;
    }

    const speakerRoot = ensureNode(
      rootMap,
      `speaker:${speaker}`,
      () => ({ id: `speaker:${speaker}`, label: speaker, count: 0, meta: { speaker }, children: [] }),
      null,
    );
    speakerRoot.count += 1;
    let parentChildren = speakerRoot.children;
    let pathKey = `speaker:${speaker}`;
    for (const part of committeeParts) {
      pathKey = `${pathKey}/committee:${part}`;
      const node = ensureNode(
        childMap,
        pathKey,
        () => ({ id: pathKey, label: part, count: 0, meta: {}, children: [] }),
        parentChildren,
      );
      node.count += 1;
      parentChildren = node.children;
    }
    parentChildren.push({
      id: `utterance:${row.utterance_id}`,
      label: leafLabel,
      count: 1,
      meta: { utteranceId: row.utterance_id },
      children: [],
    });
  }

  return roots;
}

function getSelectedRow() {
  return state.filteredRows.find((row) => row.utterance_id === state.selectedId) || state.filteredRows[0] || null;
}

function computeKpis(rows) {
  const committees = new Set();
  const speakers = new Set();
  for (const row of rows) {
    committees.add(row.committee_path);
    speakers.add(row.speaker);
  }
  kpiRowsEl.textContent = formatNumber(rows.length);
  kpiCommitteesEl.textContent = formatNumber(committees.size);
  kpiSpeakersEl.textContent = formatNumber(speakers.size);
  const selected = getSelectedRow();
  kpiDayEl.textContent = selected?.meeting_date || endDateEl.value || "-";
}

function renderTreeNode(node) {
  if (!node.children?.length) {
    const button = document.createElement("button");
    button.className = `tree-leaf ${state.selectedId === node.meta?.utteranceId ? "active" : ""}`;
    button.innerHTML = `<span>${escapeHtml(node.label)}</span><span class="tree-count">1건</span>`;
    button.onclick = () => {
      state.selectedId = node.meta?.utteranceId || null;
      renderAll();
    };
    return button;
  }

  const details = document.createElement("details");
  details.className = "tree-branch";
  details.open = node.count <= 12 || node.label.includes("위원회");
  const summary = document.createElement("summary");
  summary.innerHTML = `<span>${escapeHtml(node.label)}</span><span class="tree-count">${formatNumber(node.count)}건</span>`;
  details.appendChild(summary);
  const childrenBox = document.createElement("div");
  childrenBox.className = "tree-children";
  for (const child of node.children) {
    childrenBox.appendChild(renderTreeNode(child));
  }
  details.appendChild(childrenBox);
  return details;
}

function renderTree() {
  treeRootEl.innerHTML = "";
  const nodes = buildAssemblyTree(state.filteredRows, state.mode);
  treeSummaryEl.textContent = state.mode === "committee" ? "위원회 → 발언자 → 발언" : "발언자 → 위원회 → 발언";
  if (!nodes.length) {
    treeRootEl.innerHTML = '<div class="detail-box empty">표시할 발언이 없습니다.</div>';
    return;
  }
  for (const node of nodes) treeRootEl.appendChild(renderTreeNode(node));
}

function renderDetail() {
  const row = getSelectedRow();
  if (!row) {
    detailMetaEl.textContent = "-";
    detailBoxEl.className = "detail-box empty";
    detailBoxEl.textContent = "발언을 선택해 주세요.";
    return;
  }
  detailMetaEl.textContent = `${row.meeting_date} · ${row.meeting_type}`;
  detailBoxEl.className = "detail-box";
  detailBoxEl.innerHTML = `
    <div class="detail-meta">
      <span class="badge">${escapeHtml(row.speaker)}</span>
      <span> ${escapeHtml(row.committee_path)}</span>
      <span> · ${escapeHtml(row.agenda)}</span>
    </div>
    <div>${escapeHtml(row.speech_text)}</div>
    ${row.source_url ? `<div class="detail-meta" style="margin-top:12px;"><a href="${escapeHtml(row.source_url)}" target="_blank" rel="noreferrer">원문 링크 열기</a></div>` : ""}
  `;
}

function renderTable() {
  const selected = getSelectedRow();
  const rows = state.filteredRows.slice(0, 200);
  tableMetaEl.textContent = `상위 ${formatNumber(rows.length)}건 표시`;
  tableBodyEl.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.className = `row-button ${selected?.utterance_id === row.utterance_id ? "active" : ""}`;
    tr.innerHTML = `
      <td>${escapeHtml(row.meeting_date || "-")}</td>
      <td>${escapeHtml(row.meeting_type)}</td>
      <td>${escapeHtml(row.committee_path)}</td>
      <td>${escapeHtml(row.speaker)}</td>
      <td>${escapeHtml(row.agenda)}</td>
      <td>${escapeHtml(row.speech_preview)}</td>
    `;
    tr.onclick = () => {
      state.selectedId = row.utterance_id;
      renderAll();
    };
    tableBodyEl.appendChild(tr);
  }
}

function renderRecordPanels() {
  ensureInfoPanels();
  if (!recordMetaEl || !recordListEl || !agendaMetaEl || !agendaListEl) return;
  const sessionMap = new Map();
  const agendaMap = new Map();
  const speakerMap = new Map();

  for (const row of state.filteredRows) {
    const sessionKey = `${row.session_id || "unknown"}|${row.meeting_date}|${row.committee_path}`;
    if (!sessionMap.has(sessionKey)) {
      sessionMap.set(sessionKey, {
        sessionId: row.session_id || "미상",
        meetingDate: row.meeting_date || "-",
        meetingType: row.meeting_type,
        committeePath: row.committee_path,
        sourceUrl: row.source_url || "",
        agendas: new Set(),
        utteranceCount: 0,
        speakers: new Set(),
      });
    }
    const item = sessionMap.get(sessionKey);
    item.utteranceCount += 1;
    item.speakers.add(row.speaker);
    if (row.agenda && row.agenda !== "안건 미상") item.agendas.add(row.agenda);

    agendaMap.set(row.agenda, (agendaMap.get(row.agenda) || 0) + 1);
    speakerMap.set(row.speaker, (speakerMap.get(row.speaker) || 0) + 1);
  }

  const sessions = [...sessionMap.values()]
    .sort((a, b) => String(b.meetingDate).localeCompare(String(a.meetingDate)))
    .slice(0, 8);
  const agendas = [...agendaMap.entries()]
    .filter(([name]) => name && name !== "안건 미상")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const speakers = [...speakerMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  recordMetaEl.textContent = `최근 회의 ${formatNumber(sessions.length)}건`;
  agendaMetaEl.textContent = `주요 안건 ${formatNumber(agendas.length)}개 · 주요 발언자 ${formatNumber(speakers.length)}명`;

  recordListEl.innerHTML = sessions.length
    ? sessions.map((item) => `
        <article class="mini-item">
          <strong>${escapeHtml(item.committeePath)}</strong>
          <p>${escapeHtml(item.meetingDate)} · ${escapeHtml(item.meetingType)} · 회의번호 ${escapeHtml(item.sessionId)}</p>
          <p>발언 ${formatNumber(item.utteranceCount)}건 · 발언자 ${formatNumber(item.speakers.size)}명</p>
          <p>${escapeHtml([...item.agendas].slice(0, 3).join(" / ") || "안건 정보 없음")}</p>
          <div class="mini-links">
            ${item.sourceUrl ? `<a class="mini-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">원문 PDF</a>` : ""}
          </div>
        </article>
      `).join("")
    : `<div class="detail-box empty">표시할 회의 기록이 없습니다.</div>`;

  agendaListEl.innerHTML = `
    <article class="mini-item">
      <strong>주요 안건</strong>
      <p>${agendas.map(([name, count]) => `${escapeHtml(name)} (${formatNumber(count)}건)`).join("<br>") || "안건 정보 없음"}</p>
    </article>
    <article class="mini-item">
      <strong>주요 발언자</strong>
      <p>${speakers.map(([name, count]) => `${escapeHtml(name)} (${formatNumber(count)}건)`).join("<br>") || "발언자 정보 없음"}</p>
    </article>
  `;
}

function renderAll() {
  computeKpis(state.filteredRows);
  renderRecordPanels();
  renderTree();
  renderDetail();
  renderTable();
}

function localSummary(rows, question) {
  const committees = new Map();
  const speakers = new Map();
  for (const row of rows) {
    committees.set(row.committee_path, (committees.get(row.committee_path) || 0) + 1);
    speakers.set(row.speaker, (speakers.get(row.speaker) || 0) + 1);
  }
  const topCommittees = [...committees.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topSpeakers = [...speakers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const samples = rows.slice(0, 3).map((row) => `- ${row.speaker} / ${row.committee_path}: ${shortText(row.speech_text, 100)}`);
  return [
    `[로컬 요약] ${question || "회의록 핵심 쟁점"}`,
    `조회 발언 수: ${formatNumber(rows.length)}건`,
    "",
    "주요 위원회",
    ...topCommittees.map(([name, count]) => `- ${name}: ${formatNumber(count)}건`),
    "",
    "주요 발언자",
    ...topSpeakers.map(([name, count]) => `- ${name}: ${formatNumber(count)}건`),
    "",
    "발언 샘플",
    ...samples,
  ].join("\n");
}

function localTraceLines(rows, question) {
  return [
    "1. ?? ??",
    `2. ?? ??: ${question}`,
    "3. ?? ??: SQL ?? ??",
    `4. ?? ??? ??: ${formatNumber(rows.length)}?`,
    `5. ?? ?? ????: ${formatNumber(Math.min(rows.length, 3))}?`,
    "6. MiniMax ?? ??? ?? ?? ??",
    "7. ?? ?? ?? ?? ??",
  ];
}

async function fetchAssemblyRows(start, end) {
  const pageSize = 1000;
  const hardLimit = 5000;
  const all = [];

  for (let offset = 0; offset < hardLimit; offset += pageSize) {
    const { data, error } = await supabase
      .from("assembly_minutes_raw")
      .select("utterance_id,session_id,meeting_date,meeting_type,committee,agenda1,agenda2,speaker,speech_order,speech_text,source_url")
      .gte("meeting_date", start)
      .lte("meeting_date", end)
      .order("meeting_date", { ascending: false })
      .order("speech_order", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const page = data || [];
    all.push(...page);
    if (page.length < pageSize) break;
  }

  return all;
}

async function fetchLatestMeetingDate() {
  const { data, error } = await supabase
    .from("assembly_minutes_raw")
    .select("meeting_date")
    .order("meeting_date", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.meeting_date || null;
}

async function fetchVectorCoverage() {
  const table = "assembly_minutes_embedding_nemotron1024";

  const [{ count, error: countError }, { data: minData, error: minError }, { data: maxData, error: maxError }] =
    await Promise.all([
      supabase.from(table).select("utterance_id", { count: "exact", head: true }),
      supabase.from(table).select("meeting_date").order("meeting_date", { ascending: true }).limit(1),
      supabase.from(table).select("meeting_date").order("meeting_date", { ascending: false }).limit(1),
    ]);

  if (countError) throw countError;
  if (minError) throw minError;
  if (maxError) throw maxError;

  return {
    count: Number(count || 0),
    start: minData?.[0]?.meeting_date || null,
    end: maxData?.[0]?.meeting_date || null,
  };
}

async function refreshRows() {
  const start = startDateEl.value;
  const end = endDateEl.value;
  statusLineEl.textContent = "Supabase에서 회의록을 불러오는 중...";
  refreshBtnEl.disabled = true;
  try {
    const rows = await fetchAssemblyRows(start, end);
    state.rows = enrichRows(rows);
    state.filteredRows = filterRows(state.rows, searchInputEl.value);
    state.selectedId = state.filteredRows[0]?.utterance_id || null;
    statusLineEl.textContent = `불러오기 완료 · ${formatNumber(state.rows.length)}건`;
    renderAll();
  } catch (error) {
    console.error(error);
    statusLineEl.textContent = `불러오기 실패 · ${error.message || error}`;
    state.rows = [];
    state.filteredRows = [];
    state.selectedId = null;
    renderAll();
  } finally {
    refreshBtnEl.disabled = false;
  }
}

async function runAiBrief() {
  const selected = getSelectedRow();
  const question = cleanText(aiQuestionEl.value, "?? ??? ?? ??? ????");
  const targetDay = selected?.meeting_date || endDateEl.value;
  aiBtnEl.disabled = true;
  aiResultEl.textContent = "?? ?? ?...";
  if (aiTraceEl) {
    aiTraceEl.textContent = [
      "1. ?? ??",
      `2. ?? ??: ${question}`,
      `3. ?? ?? ??: ${startDateEl.value} ~ ${endDateEl.value}`,
      "4. ???? ??? ?? ?? ??",
      "5. MiniMax ?? ?? ?...",
    ].join("
");
    aiTraceEl.classList.remove("empty");
  }
  try {
    aiStatusEl.textContent = "???? ??? ???? MiniMax ?? ?...";

    const response = await fetch(ASSEMBLY_BRIEF_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        question,
        day: targetDay,
        start: startDateEl.value,
        end: endDateEl.value,
        domain: "assembly",
        limit: 6,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "?? ??");
    state.aiMode = payload.mode || "unknown";
    const viewModel = buildAiViewModel(payload);
    aiStatusEl.textContent = viewModel.statusText;
    modelMetaEl.textContent = viewModel.modelMetaText;
    setAiOutputs(viewModel.answerText, viewModel.traceLines);
  } catch (error) {
    console.warn("AI brief fallback", error);
    aiStatusEl.textContent = "?? ?? ??";
    setModelMeta("fallback", "sql_range");
    setAiOutputs(localSummary(state.filteredRows, question), localTraceLines(state.filteredRows, question));
  } finally {
    aiBtnEl.disabled = false;
  }
}

function syncModeButtons() {
  const committeeMode = state.mode === "committee";
  modeCommitteeBtnEl.classList.toggle("active", committeeMode);
  modeSpeakerBtnEl.classList.toggle("active", !committeeMode);
}

function setMode(mode) {
  state.mode = mode;
  syncModeButtons();
  renderAll();
}

function applySearch() {
  state.filteredRows = filterRows(state.rows, searchInputEl.value);
  if (!state.filteredRows.find((row) => row.utterance_id === state.selectedId)) {
    state.selectedId = state.filteredRows[0]?.utterance_id || null;
  }
  statusLineEl.textContent = `필터 적용 · ${formatNumber(state.filteredRows.length)}건`;
  renderAll();
}

function initDates() {
  endDateEl.value = isoDay(new Date());
  startDateEl.value = daysAgo(30);
}

refreshBtnEl.addEventListener("click", refreshRows);
modeCommitteeBtnEl.addEventListener("click", () => setMode("committee"));
modeSpeakerBtnEl.addEventListener("click", () => setMode("speaker"));
searchInputEl.addEventListener("input", applySearch);
aiBtnEl.addEventListener("click", runAiBrief);

async function init() {
  initDates();
  syncModeButtons();
  setVectorMeta("벡터 적재 범위 확인 중...");
  try {
    const latest = await fetchLatestMeetingDate();
    if (latest) {
      endDateEl.value = latest;
      startDateEl.value = shiftDay(latest, -14);
      setSyncMeta(latest);
      statusLineEl.textContent = `최신 회의일 기준 기본 범위 적용 · ${startDateEl.value} ~ ${endDateEl.value}`;
    }
  } catch (error) {
    console.warn("latest meeting date fallback", error);
    setSyncMeta("");
  }
  try {
    const vector = await fetchVectorCoverage();
    if (vector.count > 0 && vector.start && vector.end) {
      setVectorMeta(`벡터DB 적재 범위: ${vector.start} ~ ${vector.end} · ${formatNumber(vector.count)}건`);
    } else {
      setVectorMeta("벡터DB 적재 범위: 아직 없음");
    }
  } catch (error) {
    console.warn("vector coverage fallback", error);
    setVectorMeta("벡터DB 적재 범위 확인 불가");
  }
  setModelMeta("", "");
  await refreshRows();
}

init();
