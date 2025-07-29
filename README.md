# 建物リユース資材調査アプリケーション

Google Maps API、PLATEAU配信サービス、生成AIを統合して、建物に関連するデータを収集し、リユース可能な資材情報をまとめるWebアプリケーションです。

## 🎯 目的

- 建物の解体前に、リユース可能な建築資材を特定・評価
- 環境インパクト（CO2削減量、廃棄物削減量）の推定
- 財務的価値の算出
- 視覚的で分かりやすいレポートの生成

## 🚀 セットアップ

### 前提条件

- Node.js (v14以上)
- npm または yarn

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/slalom-one/arch-hub-experimental.git
cd arch-hub-experimental

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してAPIキーを設定
```

### 開発サーバーの起動

```bash
# 開発モード
npm run dev

# 本番モード
npm start
```

サーバーはデフォルトで http://localhost:3000 で起動します。

## 📚 プロジェクト構造

```
arch-hub-experimental/
├── src/
│   └── index.js        # メインサーバーファイル
├── ideas/              # プロジェクトアイデアとサンプル
├── requirements/       # 要件定義書
├── .env.example        # 環境変数のテンプレート
├── .gitignore          # Git除外設定
├── package.json        # プロジェクト設定
└── README.md           # このファイル
```

## 🔧 環境変数

`.env.example` を参考に以下の環境変数を設定してください：

- `PORT`: サーバーポート（デフォルト: 3000）
- `NODE_ENV`: 実行環境（development/production）
- `GOOGLE_MAPS_API_KEY`: Google Maps APIキー
- `OPENAI_API_KEY`: OpenAI APIキー

## 📋 開発フェーズ

- [x] Phase 1-1: プロジェクト初期セットアップ
- [ ] Phase 1-2: Google Maps API統合
- [ ] Phase 2: PLATEAU API統合
- [ ] Phase 3: AI統合
- [ ] Phase 4: レポート機能
- [ ] Phase 5: 拡張機能

## 🤝 コントリビューション

プルリクエストを歓迎します。大きな変更の場合は、まずissueを作成して変更内容を議論してください。

## 📄 ライセンス

[ISC](https://choosealicense.com/licenses/isc/)