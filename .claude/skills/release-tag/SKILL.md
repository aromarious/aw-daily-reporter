---
name: release-tag
description: バージョンタグを作成してリリースを公開する
disable-model-invocation: false
allowed-tools: Bash
---

# バージョンタグを作成してリリースを公開する

このスキルは、新しいバージョンタグを作成し、GitHub Actions経由でリリースを自動作成するプロセスをガイドします。

## 前提条件

- developブランチが最新の状態であること
- すべての変更がコミット済みであること
- バージョン番号が決定していること

## 手順

### 1. 現在のバージョンを確認

```bash
git tag --sort=-version:refname | head -5
```

```bash
grep '^version = ' pyproject.toml
```

```bash
grep '"version":' package.json
```

### 2. ブランチとリモートの状態を確認

developブランチにいることを確認し、リモートと同期していることを確認する。

```bash
git status
```

```bash
git log origin/develop..HEAD --oneline
```

developが最新でない場合は警告してユーザーに確認する。

### 3. リリースノートの準備

前回のタグからの変更を確認し、リリースノートの内容を準備する。

```bash
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

### 4. バージョンタグを作成

**重要**: タグ名は `v` プレフィックス付きのセマンティックバージョン（例: `v0.2.3`）を使用すること。

```bash
git tag -a v[VERSION] -m "Release v[VERSION]"
```

### 5. タグをリモートにプッシュ

```bash
git push origin v[VERSION]
```

### 6. GitHub Actionsの実行を確認

タグがプッシュされると、`.github/workflows/ci.yml` が自動的に実行されます。

```bash
gh run list --workflow=ci.yml --limit 3
```

ワークフローの進行状況を確認:

```bash
gh run watch
```

### 7. リリースが作成されたことを確認

ワークフローが完了したら、リリースが正しく作成されたか確認する。

```bash
gh release list | head -5
```

作成されたリリースの詳細を確認:

```bash
gh release view v[VERSION]
```

### 8. リリースノートを編集（必要に応じて）

自動生成されたリリースノートを編集する場合:

```bash
gh release edit v[VERSION]
```

または、Web UIで編集する場合はURLを提供:

```text
https://github.com/aromarious/aw-daily-reporter/releases/edit/v[VERSION]

```

## トラブルシューティング

### 重複リリースが作成された場合

同じタグに対して複数のリリースが作成された場合（1つは正常、もう1つは `untagged-...`）:

1. リリース一覧を確認:

   ```bash
   gh release list --json tagName,name,isDraft,isLatest
   ```

2. 不要なリリースのIDを取得:

   ```bash
   gh api repos/:owner/:repo/releases --jq '.[] | select(.name == "不要なリリース名") | .id'
   ```

3. 不要なリリースを削除:

   ```bash
   gh api repos/:owner/:repo/releases/<RELEASE_ID> -X DELETE
   ```

4. 正しいリリースのタグを修正（必要に応じて）:

   ```bash
   gh api repos/:owner/:repo/releases/<RELEASE_ID> -X PATCH -f tag_name=v[VERSION]
   ```

### タグを間違えて作成した場合

ローカルタグを削除:

```bash
git tag -d v[VERSION]
```

リモートタグを削除（注意: 既にリリースが作成されている場合は慎重に）:

```bash
git push origin :refs/tags/v[VERSION]
```

## 注意事項

- **1つのタグに対して1つのリリースのみ**: GitHubでは1つのタグに対して1つのリリースしか関連付けられません
- **タグの命名規則**: 必ず `v` プレフィックスを付けること（例: `v0.2.3`）
- **バージョン番号の整合性**: `pyproject.toml` と `package.json` のバージョンが一致していることを確認
- **GPG署名**: タグに署名する場合は `-s` オプションを使用（`git tag -s v[VERSION] -m "Release v[VERSION]"`）

## 完了報告

ユーザーに以下を報告する:

- 作成されたタグ名
- リリースのURL
- リリースに含まれるアセット（ビルド成果物）
- 次のステップ（必要に応じて）
