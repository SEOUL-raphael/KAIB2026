# 국회 회의록 공유판

이 폴더는 GitHub Pages에서 바로 열 수 있는 정적 공개판입니다.

예상 공개 주소:
- `https://seoUL-raphael.github.io/KAIB2026/projects/assembly-minutes-share/`

구성:
- `index.html`: 공개 화면
- `styles.css`: 레이아웃/반응형 스타일
- `app.js`: Supabase 조회, 트리/상세/목록 렌더링, AI 요약 호출

데이터 경로:
- 기본 데이터: Supabase `assembly_minutes_raw`
- AI 요약: Supabase Edge Function `assembly-brief`

주의:
- 현재 공개 페이지는 Edge Function이 미배포여도 동작합니다.
- Edge Function이 없으면 AI 요약은 브라우저에서 로컬 통계 요약으로 대체됩니다.

배포 체크리스트:
1. `supabase/functions/assembly-brief` 배포
2. GitHub repo `main` 브랜치에 이 폴더 푸시
3. GitHub Pages가 `main` 브랜치 루트 기준으로 켜져 있으면 위 경로로 접근 가능
