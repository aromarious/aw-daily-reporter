"use client";

import type { EChartsOption } from "echarts";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const EChartsWrapper = dynamic(() => import("./EChartsWrapper"), {
	ssr: false,
});

interface TimelineItem {
	timestamp: string;
	duration: number;
	app: string;
	title: string;
	category?: string;
	project?: string;
}

interface Snapshot {
	name: string;
	timeline: TimelineItem[];
}

interface ProcessingStageVisualizerProps {
	snapshots: Snapshot[];
}

// 美しいカラーパレット
const CATEGORY_COLORS: Record<string, string> = {
	Work: "#6366f1",
	Coding: "#22c55e",
	Communication: "#06b6d4",
	Break: "#f59e0b",
	Other: "#94a3b8",
};

function getColor(category: string, index: number): string {
	if (CATEGORY_COLORS[category]) {
		return CATEGORY_COLORS[category];
	}
	const colors = ["#8b5cf6", "#ec4899", "#84cc16", "#f97316", "#14b8a6"];
	return colors[index % colors.length];
}

function formatDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) {
		return `${h}h ${m}m`;
	}
	return `${m}m`;
}

export default function ProcessingStageVisualizer({
	snapshots,
}: ProcessingStageVisualizerProps) {
	const [expandedStage, setExpandedStage] = useState<number | null>(
		snapshots.length > 0 ? snapshots.length - 1 : null,
	);

	// 各ステージの統計を計算
	const stageStats = useMemo(() => {
		return snapshots.map((snap) => {
			const categoryMap = new Map<string, number>();
			let totalDuration = 0;
			const itemCount = snap.timeline.length;
			let categorizedCount = 0;

			snap.timeline.forEach((item) => {
				const cat = item.category || "Uncategorized";
				categoryMap.set(cat, (categoryMap.get(cat) || 0) + item.duration);
				totalDuration += item.duration;
				if (item.category) {
					categorizedCount++;
				}
			});

			const categories = Array.from(categoryMap.entries())
				.map(([name, value]) => ({ name, value }))
				.sort((a, b) => b.value - a.value);

			return {
				name: snap.name,
				itemCount,
				totalDuration,
				categorizedCount,
				categories,
			};
		});
	}, [snapshots]);

	// サンキー風の遷移データを生成
	const transitionOption = useMemo<EChartsOption>(() => {
		if (stageStats.length < 2) {
			return {};
		}

		const stages = stageStats.map((s) => s.name);
		const data: { name: string }[] = [];
		const links: { source: string; target: string; value: number }[] = [];

		// 各ステージをノードとして追加
		stages.forEach((stage, idx) => {
			const stat = stageStats[idx];
			stat.categories.slice(0, 5).forEach((cat) => {
				const nodeName = `${stage}\n${cat.name}`;
				data.push({ name: nodeName });

				// 前のステージからのリンクを作成
				if (idx > 0) {
					const prevStat = stageStats[idx - 1];
					const prevCat = prevStat.categories.find((c) => c.name === cat.name);
					if (prevCat) {
						links.push({
							source: `${stages[idx - 1]}\n${cat.name}`,
							target: nodeName,
							value: Math.min(cat.value, prevCat.value),
						});
					}
				}
			});
		});

		return {
			tooltip: {
				trigger: "item",
				triggerOn: "mousemove",
				backgroundColor: "rgba(255, 255, 255, 0.95)",
				borderColor: "#e2e8f0",
				borderWidth: 1,
				textStyle: { color: "#334155" },
				extraCssText:
					"box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px;",
			},
			series: [
				{
					type: "sankey",
					layout: "none",
					emphasis: {
						focus: "adjacency",
					},
					data,
					links,
					lineStyle: {
						color: "gradient",
						curveness: 0.5,
					},
					itemStyle: {
						borderWidth: 1,
						borderColor: "#fff",
					},
					label: {
						fontSize: 10,
						color: "#64748b",
					},
				},
			],
		};
	}, [stageStats]);

	if (!snapshots || snapshots.length === 0) {
		return (
			<div className="flex items-center justify-center h-32 text-slate-400">
				No processing stages available
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* ステージ遷移の概要 */}
			<div className="flex items-center gap-2 overflow-x-auto pb-2">
				{stageStats.map((stat, idx) => (
					<div key={stat.name} className="flex items-center">
						<button
							type="button"
							onClick={() =>
								setExpandedStage(expandedStage === idx ? null : idx)
							}
							className={`
								flex flex-col items-center p-3 rounded-lg border-2 transition-all min-w-32
								${
									expandedStage === idx
										? "border-indigo-400 bg-indigo-50 shadow-md"
										: "border-slate-200 bg-white/50 hover:border-indigo-200"
								}
							`}
						>
							<span className="text-xs font-medium text-slate-500">
								{stat.name}
							</span>
							<span className="text-lg font-bold text-slate-700">
								{stat.itemCount}
							</span>
							<span className="text-xs text-slate-400">
								{formatDuration(stat.totalDuration)}
							</span>
							<div className="mt-1 flex gap-0.5">
								{stat.categories.slice(0, 4).map((cat, catIdx) => (
									<div
										key={cat.name}
										className="w-2 h-2 rounded-full"
										style={{ backgroundColor: getColor(cat.name, catIdx) }}
										title={`${cat.name}: ${formatDuration(cat.value)}`}
									/>
								))}
							</div>
						</button>
						{idx < stageStats.length - 1 && (
							<ChevronRight className="mx-2 text-slate-300" size={20} />
						)}
					</div>
				))}
			</div>

			{/* 展開されたステージの詳細 */}
			{expandedStage !== null && stageStats[expandedStage] && (
				<div className="border border-slate-200 rounded-xl p-4 bg-white/50 backdrop-blur-sm">
					<div className="flex items-center justify-between mb-3">
						<h4 className="font-medium text-slate-700 flex items-center gap-2">
							<Layers size={16} />
							{stageStats[expandedStage].name}
						</h4>
						<span className="text-sm text-slate-500">
							{stageStats[expandedStage].categorizedCount} /{" "}
							{stageStats[expandedStage].itemCount} categorized
						</span>
					</div>

					{/* カテゴリ別ミニバー */}
					<div className="space-y-2">
						{stageStats[expandedStage].categories.map((cat, idx) => {
							const percentage =
								(cat.value / stageStats[expandedStage].totalDuration) * 100;
							return (
								<div key={cat.name} className="flex items-center gap-2">
									<div
										className="w-24 text-xs text-slate-600 truncate"
										title={cat.name}
									>
										{cat.name}
									</div>
									<div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
										<div
											className="h-full rounded-full transition-all"
											style={{
												width: `${percentage}%`,
												backgroundColor: getColor(cat.name, idx),
											}}
										/>
									</div>
									<div className="w-16 text-xs text-right text-slate-500">
										{formatDuration(cat.value)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* サンキー図（複数ステージがある場合） */}
			{stageStats.length >= 2 && Object.keys(transitionOption).length > 0 && (
				<div className="border border-slate-200 rounded-xl p-4 bg-white/50 backdrop-blur-sm">
					<h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
						<ChevronDown size={16} />
						Data Flow Between Stages
					</h4>
					<EChartsWrapper
						option={transitionOption}
						style={{ height: "250px", width: "100%" }}
					/>
				</div>
			)}
		</div>
	);
}
