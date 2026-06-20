# インストール手順

## 0. 事前に必要なもの

- Discord アカウント
- Google アカウント
- 

## 1. Botをサーバーに入れる

1. 招待リンクを開く
   サーバーの場合　https://discord.com/oauth2/authorize?client_id=1497556622568980491&permissions=8&integration_type=0&scope=bot+applications.commands
3. 追加したいDiscordサーバーを選ぶ
4. 承認する

## 2. テンプレートをコピーする

1. 次のテンプレートシートを開く  
   `https://docs.google.com/spreadsheets/d/1H6qeXjvSLAmJL3-P6vz4RmipOGP6HvXbgM1anyc2IwM/edit?gid=0#gid=0`
2. `ファイル` → `コピーを作成` を選ぶ
3. 自分のGoogle Driveにコピーを作成する
4. コピーしたシートで `拡張機能` → `Apps Script` を開く
## 3. 設定値を入れる（Apps Script側）

Apps Script の `プロジェクトの設定` → `スクリプト プロパティ` で次を追加します。

- `PROXY_TOKEN` : 32文字以上のランダム文字列
- `CALENDAR_ID` : まずは `primary` でOK

## 4. Webアプリとして公開する（Apps Script側）

1. 右上の `デプロイ` → `新しいデプロイ`
2. 種類を `ウェブアプリ` にする
3. `アクセスできるユーザー` を `全員` にする
4. デプロイして `.../exec` のURLをコピー
   - `.../dev` ではなく `.../exec` を使います

## 5. Discordで接続設定する

1. Discordで `/setup` を実行
2. 入力画面に次を入れる
   - `GAS Webhook URL` : さっきコピーした `.../exec`
   - `PROXY_TOKEN` : GASに入れたものと同じ値
3. `Setup saved.` が出たら完了

## 6. 動作確認

- `/ping`
- `/schedule`

これで返事が来れば完了です。

## よくあるエラー

### `Setup not found. Run /setup first.`
`/setup` が未実行です。先に `/setup` を実行してください。

### `GAS request failed.`
次を確認してください。

- URL が `.../exec` になっているか（`.../dev` ではない）
- Webアプリの公開範囲が `全員` か
- `PROXY_TOKEN` がGAS設定と `/setup` 入力で一致しているか
- デプロイ後の最新URLを使っているか
- GASを再デプロイしてURLが変わった場合、Discordで `/setup` を再実行したか
