---
description: プルリクの作成
---

1. 現在のブランチを確認します。
   // turbo
   ```bash
   git branch --show-current
   ```
   - `main` や `develop` でないことを確認してください。

2. 変更状態を確認します。
   // turbo
   ```bash
   git status
   ```

3. 変更をステージングしてコミットします。
   - ユーザーにコミットメッセージを確認してください。
   ```bash
   git add .
   git commit -m "<COMMIT_MESSAGE>"
   ```

4. リモートにプッシュします。
   ```bash
   git push origin <BRANCH_NAME>
   ```

5. `develop` ブランチに向けたプルリクエストを作成します。
   ```bash
   gh pr create --base develop --title "<PR_TITLE>" --body "<PR_DESCRIPTION>"
   ```

6. 作成完了をユーザーに報告します。
   - 作成されたPRのURLを伝えてください。
