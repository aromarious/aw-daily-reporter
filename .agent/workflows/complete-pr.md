---
description: プルリクを完了する
---

1. プルリクの状態を確認します。
   // turbo
   ```bash
   gh pr view <PR_NUMBER> --json State,Mergeable,HeadBranch
   ```

2. CIの実行結果を確認します。
   // turbo
   ```bash
   gh pr checks <PR_NUMBER> --watch
   ```
   - すべてのチェックが `pass` になることを確認します。

3. マージ処理を行います。
   - まだマージされていない場合:
     ```bash
     gh pr merge <PR_NUMBER> --squash --delete-branch
     ```
   - すでにマージ済みの場合:
     - リモートブランチが残っていれば削除します。
     ```bash
     git push origin --delete <BRANCH_NAME>
     ```

4. ローカル環境を整理します。
   - `develop` ブランチに切り替えて最新にします。
     ```bash
     git checkout develop && git pull origin develop
     ```
   - ローカルの作業ブランチを削除します。
     ```bash
     git branch -D <BRANCH_NAME>
     ```
   - リモートの不要な参照を削除します。
     ```bash
     git fetch --prune
     ```

5. 完了をユーザーに報告します。
   - 「プレビュー環境で確認をお願いします」と伝えます。
