// 共通カラーパレット

// 未分類項目用の無彩色（グレー系）
export const UNCATEGORIZED_COLOR = "#94a3b8"; // slate-400

// APIから取得した未分類キーワード（初期値はフォールバック）
let uncategorizedKeywords: string[] = [
	"unknown",
	"uncategorized",
	"unclassified",
	"non-billable",
	"(none)",
	"",
	"other",
	"その他",
	"未分類",
];

// APIから定数を取得（アプリ起動時に1回だけ呼ばれる想定）
let constantsLoaded = false;
export async function loadConstants(): Promise<void> {
	if (constantsLoaded) return;
	try {
		const res = await fetch("/api/constants");
		if (res.ok) {
			const data = await res.json();
			if (data.uncategorized_keywords) {
				uncategorizedKeywords = data.uncategorized_keywords;
			}
		}
		constantsLoaded = true;
	} catch (e) {
		console.warn("Failed to load constants from API, using defaults", e);
		constantsLoaded = true;
	}
}

// 未分類かどうかを判定するヘルパー（エクスポート）
export function isUncategorized(name: string | undefined | null): boolean {
	if (!name || name.trim() === "") return true;
	const lowerName = name.toLowerCase().trim();
	return uncategorizedKeywords.includes(lowerName);
}

// カテゴリ用カラーパレット（暖色系 - 緑・黄・オレンジ・赤・ピンク系）
export const CATEGORY_COLORS = [
	"#fb923c", // orange
	"#84cc16", // lime
	"#ec4899", // pink
	"#22c55e", // green
	"#14b8a6", // teal
	"#10b981", // emerald
	"#eab308", // yellow
	"#f59e0b", // amber
	"#fc5c65", // red (was #f87171/ef4444)
	"#fb7185", // rose (was #f43f5e)
];

// プロジェクト用カラーパレット（寒色系 - 青・紫・インディゴ系のみ）
export const PROJECT_COLORS = [
	"#a855f7", // purple
	"#8b5cf6", // violet
	"#6366f1", // indigo
	"#3b82f6", // blue
	"#0ea5e9", // sky
	"#06b6d4", // cyan
	"#2563eb", // blue-600 (added back)
	"#4f46e5", // indigo-600 (added back)
	"#7c3aed", // violet-dark
	"#4338ca", // indigo-dark
];

// 文字列のハッシュ値を計算 (DJB2)
// 現在のシード値（デフォルト）
// export const DEFAULT_SEED = 7405;
export const DEFAULT_SEED = 7402;

// 文字列のハッシュ値を計算 (DJB2)
function hashString(str: string, seed: number = DEFAULT_SEED): number {
	let hash = seed;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}
	return Math.abs(hash);
}

// 名前に基づいて一貫した色を取得するユーティリティ (ハッシュベース)
export function getColorByName(
	name: string,
	palette: string[],
    seed: number = DEFAULT_SEED
): string {
    const index = hashString(name, seed) % palette.length;
    return palette[index];
}

// カスタムカテゴリ色（API設定からロード）
let customCategoryColors: Record<string, string> = {};

export function setCustomCategoryColors(colors: Record<string, string>) {
	customCategoryColors = colors || {};
}

// カテゴリ名から色を取得（未分類はグレー、カスタム色があればそれを使用）
export function getCategoryColor(category: string): string {
    if (isUncategorized(category)) return UNCATEGORIZED_COLOR;
    // カスタム色が設定されていればそれを使用
    if (customCategoryColors[category]) {
        return customCategoryColors[category];
    }
    return getColorByName(category, CATEGORY_COLORS);
}

// プロジェクト名から色を取得（未分類はグレー）
export function getProjectColor(project: string): string {
	if (isUncategorized(project)) return UNCATEGORIZED_COLOR;
	return getColorByName(project, PROJECT_COLORS);
}

