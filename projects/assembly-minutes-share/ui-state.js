export function cleanText(value, fallback = "") {
  const text = String(value ?? "")
    .replace(/\bnan\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}

export function retrievalLabel(retrievalMode = "") {
  if (retrievalMode === "vector_nemotron1024") return "벡터 RAG(Nemotron1024)";
  if (retrievalMode === "vector_local384") return "벡터 RAG(local384)";
  if (retrievalMode === "vector_jina1024") return "벡터 RAG";
  if (retrievalMode === "sql_range") return "SQL 범위 조회";
  return "조회 경로 미상";
}

export function shortError(text, maxLength = 84) {
  const value = cleanText(text, "");
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

export function buildLiveTraceLines(payload = {}) {
  const stats = payload?.stats || {};
  const retrievalMode = stats.retrieval_mode || "";
  const semanticRows = Number(stats.semantic_rows || 0);
  const totalRows = Number(stats.total_rows || 0);
  const contextRows = Number(stats.context_rows || 0);
  const vectorError = shortError(stats.vector_error || "");
  const mode = payload?.mode || "unknown";

  const lines = [
    "1. 요청 접수",
    `2. 조회 범위 확정`,
    `3. 회의록 검색 경로: ${retrievalLabel(retrievalMode)}`,
    `4. 원천 회의록 후보: ${formatNumber(totalRows)}건`,
    `5. 모델 전달 컨텍스트: ${formatNumber(contextRows)}건`,
  ];

  if (semanticRows > 0) {
    lines.push(`6. 벡터 근거 매치: ${formatNumber(semanticRows)}건`);
  } else if (vectorError) {
    lines.push(`6. 벡터 경로 메모: ${vectorError}`);
  }

  lines.push(mode === "minimax" ? "7. MiniMax 응답 수신 완료" : "7. 대체 요약 경로 사용");
  return lines;
}

export function buildAiViewModel(payload = {}) {
  const stats = payload?.stats || {};
  const retrievalMode = stats.retrieval_mode || "";
  const semanticRows = Number(stats.semantic_rows || 0);
  const vectorError = shortError(stats.vector_error || "");
  const mode = payload?.mode || "unknown";

  let statusText = `응답 완료 · ${retrievalLabel(retrievalMode)}`;
  if (mode === "minimax" && semanticRows > 0) {
    statusText = `MiniMax 응답 · ${retrievalLabel(retrievalMode)} · 근거 ${formatNumber(semanticRows)}건`;
  } else if (mode === "minimax" && vectorError) {
    statusText = `MiniMax 응답 · ${retrievalLabel(retrievalMode)} · ${vectorError}`;
  } else if (mode !== "minimax") {
    statusText = `로컬 대체 요약 · ${retrievalLabel(retrievalMode || "sql_range")}`;
  }

  let modelMetaText = "AI 요약: MiniMax 연계";
  if (mode === "minimax") {
    modelMetaText = `AI 요약: MiniMax 응답 확인 · ${retrievalLabel(retrievalMode)}`;
  } else if (mode === "fallback") {
    modelMetaText = `AI 요약: 로컬 대체 요약 사용 중 · ${retrievalLabel(retrievalMode || "sql_range")}`;
  }

  return {
    answerText: payload?.answer || "응답이 비어 있습니다.",
    statusText,
    modelMetaText,
    traceLines: Array.isArray(payload?.trace_log) && payload.trace_log.length
      ? payload.trace_log
      : buildLiveTraceLines(payload),
  };
}
