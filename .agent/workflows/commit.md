---
description: 変更をコミットする
---

1. 変更状態を確認します。
   // turbo
   ```bash
   git status
   ```

2. 変更をコミットします。
   - **重要**: 既にステージングされている変更がある場合は、`git add .` を実行せず、ステージングされている変更のみをコミットしてください。
   - ステージングされている変更がない場合は、`git add .` を実行してからコミットしてください。
   - コミットメッセージはユーザーに確認、または Conventional Commits に従って提案してください。
   ```bash
   # ステージング済みがある場合
   git commit -m "<COMMIT_MESSAGE>"

   # ステージング済みがない場合
   git add .
   git commit -m "<COMMIT_MESSAGE>"
   ```
