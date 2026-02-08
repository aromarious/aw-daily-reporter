# パフォーマンス最適化ガイド

本ドキュメントでは、aw-daily-reporterのパフォーマンス最適化で実施した改善内容とテクニックを記載します。

## 最適化結果サマリ

| 計測項目       | Before    | After     | 改善率       |
| -------------- | --------- | --------- | ------------ |
| processor_afk  | 19.3秒    | <0.5秒    | **40倍以上** |
| merge_timeline | 1.9秒     | 0.7秒     | **2.7倍**    |
| scanner_git    | 1.1秒     | 0.5秒     | **2倍**      |
| **Total**      | **9.5秒** | **2.2秒** | **4.3倍**    |

---

## 1. AFKプロセッサ最適化

### 問題
`is_in_active`関数が2100万回呼び出され、線形探索（O(n)）で時間範囲をチェックしていた。

### 解決策

#### バイナリサーチの導入
```python
import bisect
import numpy as np

# active_rangesをソート済みNumPy配列に変換
sorted_ranges = sorted(active_ranges, key=lambda x: x[0])
range_starts_ns = np.array([r[0].value for r in sorted_ranges], dtype="int64")
range_ends_ns = np.array([r[1].value for r in sorted_ranges], dtype="int64")

def is_in_active(t: pd.Timestamp) -> bool:
    # バイナリサーチで候補範囲を特定（O(log n)）
    t_ns = t.value
    idx = bisect.bisect_right(range_starts_ns, t_ns) - 1
    return idx >= 0 and range_starts_ns[idx] <= t_ns < range_ends_ns[idx]
```

#### ポイント
- `pd.Timestamp.value`でナノ秒精度を保持
- `bisect`モジュールでO(log n)検索
- NumPy配列で高速な比較演算

---

## 2. merge_timeline最適化

### 問題
`iterrows()`によるDataFrame行ごとの反復処理が遅い（各行でpandas Seriesを生成）。

### 解決策

#### iterrows → itertuples
```python
# Before (遅い)
for _, row in df.iterrows():
    ts = row["timestamp"]
    app = row.get("app", "")

# After (5-10倍高速)
for row in df.itertuples():
    ts = row.timestamp
    app = getattr(row, "app", "")
```

#### ポイント
- `itertuples()`はnamedtupleを返すため軽量
- 属性アクセスは`getattr()`を使用
- `row._asdict()`でDict変換可能

---

## 3. ルールマッチング最適化

### 問題
- `df.at[idx, col]`による毎回のpandasインデックス参照
- `re.search()`による正規表現の毎回コンパイル

### 解決策

#### 正規表現の事前コンパイル
```python
# Before (毎回コンパイル)
matched = bool(re.search(pattern, text, re.IGNORECASE))

# After (事前コンパイル)
compiled = re.compile(pattern, re.IGNORECASE)
matched = bool(compiled.search(text))
```

#### リスト操作への変換
```python
# Before (df.at[]は遅い)
for idx in df.index:
    category = df.at[idx, "category"]
    df.at[idx, "category"] = new_category

# After (リスト操作は高速)
categories = df["category"].tolist()
for i in range(len(df)):
    categories[i] = new_category
df["category"] = categories
```

---

## 4. GitScanner並列化

### 問題
複数リポジトリに対するgit/gh CLI呼び出しがシーケンシャル実行。

### 解決策

#### ThreadPoolExecutorによる並列化
```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def fetch_repo_data(repo: str) -> List[Union[TimelineItem, str]]:
    items: List[Union[TimelineItem, str]] = []
    items.extend(self.get_commits(repo, start_time, end_time))
    items.extend(self.get_gh_pr_status(repo, start_time, end_time))
    return items

# 最大4スレッドで並列実行
with ThreadPoolExecutor(max_workers=4) as executor:
    futures = {executor.submit(fetch_repo_data, repo): repo for repo in repos}
    for future in as_completed(futures):
        all_items.extend(future.result())
```

#### ポイント
- I/O待ちが多い処理はスレッド並列化が効果的
- `as_completed()`で完了順に結果を取得
- 例外処理を適切に行う

---

## パフォーマンス計測方法

### DEBUGログによる計測
```bash
AW_DEBUG=1 poetry run python -m aw_daily_reporter report -d 2026-02-08
```

### cProfileによる詳細分析
```python
import cProfile
import pstats

profiler = cProfile.Profile()
profiler.enable()
# 計測対象のコード
profiler.disable()

stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(25)
```

---

## 最適化のベストプラクティス

1. **計測ファースト**: 推測ではなくプロファイリングでボトルネックを特定
2. **pandas操作を最小化**: `iterrows()`より`itertuples()`、`df.at[]`よりリスト操作
3. **正規表現は事前コンパイル**: ループ内での`re.search()`を避ける
4. **アルゴリズム改善**: O(n)をO(log n)に（バイナリサーチ、インデックス活用）
5. **I/O並列化**: 外部コマンドやAPI呼び出しは`ThreadPoolExecutor`で並列化
