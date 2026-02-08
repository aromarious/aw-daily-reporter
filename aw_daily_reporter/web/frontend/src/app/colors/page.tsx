"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "@/contexts/I18nContext";
import {
	CATEGORY_COLORS,
	DEFAULT_SEED,
	getColorByName,
	PROJECT_COLORS,
} from "@/lib/colors";

export default function ColorsPage() {
	const { t } = useTranslation();
	const [seed, setSeed] = useState<number>(DEFAULT_SEED);
	const [customCategory, setCustomCategory] = useState("Coding");

	const SAMPLE_CATEGORIES = [
		"Coding",
		"Browsing",
		"Meeting",
		"Communication",
		"Design",
		"Management",
		"Research",
		"Writing",
		// ユーザー指定: "開発" ではなく "コーディング"
		"コーディング",
		"ブラウジング",
		"会議",
		"チャット",
		"デザイン",
		"管理",
		"調査",
		"執筆",
	];

	const SAMPLE_PROJECTS = [
		"aw-daily-reporter",
		"Company Research",
		"Personal",
		"Side Project",
		"Learning",
		"Infrastructure",
		"社内開発",
		"個人開発",
		"学習",
		"インフラ構築",
	];

	const handleRandomize = () => {
		setSeed(Math.floor(Math.random() * 10000) + 1);
	};

	return (
		<main className="container mx-auto px-6 py-8">
			<div className="flex items-center gap-4 mb-8">
				<Link
					href="/"
					className="p-2 hover:bg-base-200 rounded-lg transition-colors"
				>
					<ArrowLeft size={20} />
				</Link>
				<h1 className="text-2xl font-bold">{t("Color Palette Adjustment")}</h1>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* Settings Panel */}
				<div className="flex flex-col gap-6">
					<div className="bg-base-200 p-6 rounded-xl">
						<h2 className="text-lg font-semibold mb-4">
							{t("Hash Configuration")}
						</h2>

						<div className="form-control w-full max-w-xs mb-4">
							<label className="label" htmlFor="seed-input">
								<span className="label-text">{t("Seed Value")}</span>
							</label>
							<div className="flex gap-2">
								<input
									id="seed-input"
									type="number"
									value={seed}
									onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
									className="input input-bordered w-full"
								/>
								<button
									type="button"
									onClick={handleRandomize}
									className="btn btn-square btn-outline"
									title="Randomize"
								>
									<RefreshCw size={18} />
								</button>
							</div>
							<div className="label">
								<span className="label-text-alt text-base-content/60">
									Change this value to shuffle color assignments.
								</span>
							</div>
						</div>

						<div className="alert alert-info text-sm">
							<span className="font-semibold">How to apply:</span>
							<span>
								Update <code>src/lib/colors.ts</code> line ~75:
							</span>
							<pre className="bg-black/20 p-2 rounded mt-2 font-mono">
								export const DEFAULT_SEED = {seed}
								{";"}
							</pre>
						</div>
					</div>

					<div className="bg-base-100 border border-base-200 p-6 rounded-xl">
						<h2 className="text-lg font-semibold mb-4">
							{t("Palette Preview")}
						</h2>
						<div className="flex flex-wrap gap-2 mb-2">
							{CATEGORY_COLORS.map((color, i) => (
								<div
									key={color}
									className="w-24 h-8 rounded-full shadow-sm flex items-center justify-center text-[10px] text-white font-mono"
									style={{ backgroundColor: color }}
									title={color}
								>
									#{i} <span className="opacity-80 ml-1">{color}</span>
								</div>
							))}
						</div>
						<p className="text-xs text-base-content/60 mb-4">
							Category Palette ({CATEGORY_COLORS.length} colors)
						</p>

						<div className="flex flex-wrap gap-2 mb-2">
							{PROJECT_COLORS.map((color, i) => (
								<div
									key={color}
									className="w-24 h-8 rounded-full shadow-sm flex items-center justify-center text-[10px] text-white font-mono"
									style={{ backgroundColor: color }}
									title={color}
								>
									#{i} <span className="opacity-80 ml-1">{color}</span>
								</div>
							))}
						</div>
						<p className="text-xs text-base-content/60">
							Project Palette ({PROJECT_COLORS.length} colors)
						</p>
					</div>
				</div>

				{/* Preview Panel */}
				<div className="flex flex-col gap-6">
					<div className="bg-base-100 border border-base-200 p-6 rounded-xl">
						<h2 className="text-lg font-semibold mb-4">
							{t("Category Colors")}
						</h2>
						<div className="space-y-4">
							{SAMPLE_CATEGORIES.map((cat) => {
								const color = getColorByName(cat, CATEGORY_COLORS, seed);
								return (
									<div key={cat} className="flex items-center gap-4">
										<div
											className="w-10 h-10 rounded-full shadow-sm"
											style={{ backgroundColor: color }}
										/>
										<span className="font-medium text-lg">{cat}</span>
										<span className="text-sm font-mono text-base-content/40 ml-auto">
											{color}
										</span>
									</div>
								);
							})}

							{/* Custom Input */}
							<div className="divider my-4"></div>
							<div className="flex items-center gap-4">
								<div
									className="w-10 h-10 rounded-full shadow-sm"
									style={{
										backgroundColor: getColorByName(
											customCategory,
											CATEGORY_COLORS,
											seed,
										),
									}}
								/>
								<input
									type="text"
									value={customCategory}
									onChange={(e) => setCustomCategory(e.target.value)}
									className="input input-md input-bordered flex-1"
									placeholder="Type category name..."
								/>
							</div>
						</div>
					</div>

					<div className="bg-base-100 border border-base-200 p-6 rounded-xl">
						<h2 className="text-lg font-semibold mb-4">
							{t("Project Colors")}
						</h2>
						<div className="space-y-4">
							{SAMPLE_PROJECTS.map((proj) => {
								const color = getColorByName(proj, PROJECT_COLORS, seed);
								return (
									<div key={proj} className="flex items-center gap-4">
										<div
											className="w-10 h-10 rounded-md shadow-sm"
											style={{ backgroundColor: color }}
										/>
										<span className="font-medium text-lg">{proj}</span>
										<span className="text-sm font-mono text-base-content/40 ml-auto">
											{color}
										</span>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}
