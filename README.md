# Rubox

Rubox は、Ruby WASM、TypeScript、および Vite を使用したクライアントサイドで動作する Ruby プレイグラウンドです。

## 特徴

- **Ruby WASM**: バックエンドなしで、ブラウザ上で直接 Ruby コードを実行します。
- **Vite + TypeScript**: 高速なビルドシステムと型安全な開発環境。
- **Monaco Editor**: プロフェッショナルなコード編集体験。
- **共有機能**: URL 経由でコードを同期・共有可能（pako による圧縮）。
- **リファレンス表示**: カーソル位置のメソッドやクラスのドキュメントを即座に表示。

## はじめに

### 前提条件

- [Node.js](https://nodejs.org/) (v18 以上)

### インストール & セットアップ

依存関係のインストールを行います：

```bash
npm run setup
```

> [!NOTE]
> Ruby WASM バイナリや RBS ファイルなどの成果物はすでに `public/` ディレクトリに含まれているため、すぐに開発を開始できます。

### 開発環境の起動

開発サーバーを起動します：

```bash
npm run dev
```

アプリは `http://localhost:5173` で利用可能になります。

### テスト

ユニットテストと E2E テストの両方を実行します：

```bash
npm test
```

個別に実行する場合：
- ユニットテスト: `npm run test:unit`
- E2E テスト: `npx playwright test`

### リント

ESLint による静的解析と Prettier による整形を行います：

```bash
npm run lint    # チェックのみ
npm run format  # 自動整形
```

### ビルド

プロダクションサイトを `dist/` ディレクトリにビルドします：

```bash
npm run build
```

`dist/` の内容は、GitHub Pages、Vercel、Netlify などのあらゆる静的サイトホスティングサービスにデプロイ可能です。

## アーキテクチャ

- `src/main.ts`: エントリポイント。各コンポーネントの初期化を行います。
- `src/ruby-vm.ts`: Ruby WASM の初期化と実行を管理します。
- `src/editor.ts`: Monaco Editor のセットアップと操作を管理します。
- `src/console.ts`: 実行結果の表示とターミナルの操作を管理します。
- `src/reference/`: Ruby リファレンス表示機能。
- `public/`: Ruby WASM バイナリやアイコンなどの静的アセット。
- `index.html`: メインアプリケーションのレイアウト。

## 免責事項

本サービスは現状有姿で提供され、動作を保証するものではありません。入力されたコードはサーバーに送信されず、すべてブラウザ内（WebAssembly）で実行されます。
