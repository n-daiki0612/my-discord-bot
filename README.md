# google_calendar_bot

Discord から Google カレンダーを確認・追加できる Bot です。  
普段よく開く Discord 上で予定を扱えるようにしたアプリです。
インストールについては [INSTALL_GUIDE.md](./INSTALL_GUIDE.md)　をご確認ください

## アプリ概要

- Discord 上で予定確認・予定追加を行える
- Cloudflare Worker で Discord 署名検証を実施
- 各ユーザーの GAS に処理を委譲する構成

## 開発背景

Googleカレンダー通知は埋もれやすく、確認が後回しになりがちでした。  
一方で Discord を開く頻度は高いため、日常導線上で予定管理できるようにしました。

## 主な機能

- `/ping` : Bot の動作確認
- `/whoami` : 実行ユーザー名を表示
- `/schedule` : 予定一覧の表示
- `/schedule_add` : 予定追加（モーダル入力）
- `/setup` : 接続情報の登録
- `/setup_clear` : 接続情報の削除

## システム構成

```text
Discord User
   ↓ Slash Command / Modal
Discord Interactions
   ↓ (signed request)
Cloudflare Worker
   ├─ 署名検証
   ├─ setup情報をKVに保存/削除
   └─ GASへ転送
Google Apps Script (Web App)
   └─ Google Calendar を操作して結果返却
```

## 使用技術と選定理由

- Discord Interactions API
  - スラッシュコマンドとモーダルを標準で扱えるため
- Cloudflare Workers
  - 署名検証を軽量に実装でき、運用負荷が低いため
- Cloudflare KV
  - ユーザー/サーバーごとの設定を保存するため
- Google Apps Script
  - Google Calendar 操作との相性が良く、導入しやすいため
- TypeScript + esbuild + clasp
  - 開発効率と型安全性を確保しつつGASへ反映しやすいため

## データ設計（KV）

- `guild:<guild_id>` : サーバー単位設定
- `user:<user_id>` : DM単位設定

保存値（JSON）例:

```json
{
  "gasWebhookUrl": "https://script.google.com/macros/s/.../exec",
  "proxyToken": "32+ random chars"
}
```

## セキュリティ注意

- `BOT_TOKEN` は公開しない
- `PROXY_TOKEN` は公開しない
- `.clasp.json` や秘密情報をGitHubに含めない

## 補足

- Cloudflare Worker と `commands.json` 更新は管理者側で実施
- GASロジック変更時は、各ユーザー側GASの更新が必要になる場合があります
