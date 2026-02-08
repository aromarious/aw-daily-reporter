---
description: mainブランチにマージする
---

1. `main` ブランチに切り替えます。
   ```bash
   git checkout main
   ```
   // turbo
   ```bash
   git pull origin main
   ```

2. `develop` ブランチの変更をマージします。
   ```bash
   git merge develop
   ```

3. リモート `main` にプッシュします。
   ```bash
   git push origin main
   ```

4. 完了をユーザーに報告します。
