import test from "node:test";
import assert from "node:assert/strict";

import { buildAiViewModel, buildLiveTraceLines, retrievalLabel } from "./ui-state.js";

test("retrievalLabel maps known modes", () => {
  assert.equal(retrievalLabel("vector_nemotron1024"), "벡터 RAG(Nemotron1024)");
  assert.equal(retrievalLabel("sql_range"), "SQL 범위 조회");
  assert.equal(retrievalLabel("unknown"), "조회 경로 미상");
});

test("buildLiveTraceLines includes vector evidence details", () => {
  const lines = buildLiveTraceLines({
    mode: "minimax",
    stats: {
      retrieval_mode: "vector_nemotron1024",
      semantic_rows: 12,
      total_rows: 320,
      context_rows: 72,
      vector_error: "",
    },
  });

  assert.ok(lines.includes("3. 회의록 검색 경로: 벡터 RAG(Nemotron1024)"));
  assert.ok(lines.includes("6. 벡터 근거 매치: 12건"));
  assert.equal(lines.at(-1), "7. MiniMax 응답 수신 완료");
});

test("buildAiViewModel prefers server trace_log when provided", () => {
  const payload = {
    mode: "minimax",
    answer: "브리핑 본문",
    trace_log: ["1. 요청 접수", "2. 서버 처리 완료"],
    stats: {
      retrieval_mode: "sql_range",
      semantic_rows: 0,
      total_rows: 40,
      context_rows: 20,
      vector_error: "",
    },
  };

  const viewModel = buildAiViewModel(payload);
  assert.equal(viewModel.answerText, "브리핑 본문");
  assert.equal(viewModel.statusText, "응답 완료 · SQL 범위 조회");
  assert.deepEqual(viewModel.traceLines, ["1. 요청 접수", "2. 서버 처리 완료"]);
});

test("buildAiViewModel builds fallback status text", () => {
  const viewModel = buildAiViewModel({
    mode: "fallback",
    answer: "대체 요약",
    stats: {
      retrieval_mode: "sql_range",
      semantic_rows: 0,
      total_rows: 18,
      context_rows: 18,
      vector_error: "",
    },
  });

  assert.equal(viewModel.modelMetaText, "AI 요약: 로컬 대체 요약 사용 중 · SQL 범위 조회");
  assert.equal(viewModel.statusText, "로컬 대체 요약 · SQL 범위 조회");
  assert.ok(viewModel.traceLines.length >= 6);
});
