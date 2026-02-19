---
title: Golf Swing Analyser
emoji: ⛳
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 8000
pinned: false
---

Golf Swing Analyser Space.

## GA4 Setup (Frontend)

1. `apps/frontend/.env` に `VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX` を設定
2. フロントエンドを再起動
3. GA4 の `Realtime` で `page_view` と以下イベントを確認

### Tracked events

- `page_view` (SPAルーティング対応)
- `video_file_selected`
- `analysis_started`
- `analysis_completed`
- `analysis_failed`
- `analysis_jump`
- `ai_prompt_submitted`
- `ai_advice_received`
- `ai_request_error`
- `login`
- `sign_up`
- `logout`
- `auth_error`
- `checkout_started`
- `checkout_redirected`
- `checkout_skipped_paid`
- `checkout_failed`
- `video_sync_play`
- `video_sync_pause`

## 無料でできる分析（GA4標準）

- ページ別の利用状況（`page_view`）
- 解析開始率 / 完了率（`analysis_started` と `analysis_completed` の比較）
- AI機能の利用率（`ai_prompt_submitted`）
- 購入導線の離脱（`checkout_started` → `checkout_redirected`）
- 主要操作の利用傾向（`analysis_jump`, `video_sync_play`）
