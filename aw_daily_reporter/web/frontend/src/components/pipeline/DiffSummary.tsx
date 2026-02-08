"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

interface DiffData {
	category_changes: Record<string, number>;
	project_changes?: Record<string, number>;
}

interface StageInfo {
	index: number;
	name: string;
	item_count: number;
	categorized_count: number;
	project_count: number;
	total_duration: number;
}

interface DiffSummaryProps {
	before: StageInfo | null;
	after: StageInfo | null;
	diff: DiffData | null;
}

function formatDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

function ChangeIndicator({ value }: { value: number }) {
	if (value === 0) {
		return (
			<span className="flex items-center gap-1 text-slate-400">
				<Minus size={12} />
				±0
			</span>
		);
	}
	if (value > 0) {
		return (
			<span className="flex items-center gap-1 text-emerald-600">
				<ArrowUp size={12} />+{value}
			</span>
		);
	}
	return (
		<span className="flex items-center gap-1 text-rose-500">
			<ArrowDown size={12} />
			{value}
		</span>
	);
}

export default function DiffSummary({ before, after, diff }: DiffSummaryProps) {
	if (!before || !after) {
		return (
			<div className="flex items-center justify-center h-32 text-slate-400 text-sm">
				Select a stage to see changes
			</div>
		);
	}

	const itemChange = after.item_count - before.item_count;
	const catChange = after.categorized_count - before.categorized_count;
	const projChange = after.project_count - before.project_count;

	// Sort category changes by absolute value
	const sortedCategoryChanges = Object.entries(diff?.category_changes || {})
		.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
		.slice(0, 6);

	return (
		<div className="space-y-4">
			{/* Summary Stats */}
			<div className="grid grid-cols-3 gap-3">
				<div className="bg-slate-50 rounded-lg p-3 text-center">
					<div className="text-xs text-slate-500 mb-1">Items</div>
					<div className="text-lg font-semibold text-slate-700">
						{after.item_count}
					</div>
					<ChangeIndicator value={itemChange} />
				</div>
				<div className="bg-emerald-50 rounded-lg p-3 text-center">
					<div className="text-xs text-slate-500 mb-1">Categorized</div>
					<div className="text-lg font-semibold text-emerald-700">
						{after.categorized_count}
					</div>
					<ChangeIndicator value={catChange} />
				</div>
				<div className="bg-indigo-50 rounded-lg p-3 text-center">
					<div className="text-xs text-slate-500 mb-1">With Project</div>
					<div className="text-lg font-semibold text-indigo-700">
						{after.project_count}
					</div>
					<ChangeIndicator value={projChange} />
				</div>
			</div>

			{/* Category Changes */}
			{sortedCategoryChanges.length > 0 && (
				<div>
					<h4 className="text-xs font-medium text-slate-500 mb-2">
						Category Distribution Changes
					</h4>
					<div className="space-y-1.5">
						{sortedCategoryChanges.map(([category, change]) => (
							<div
								key={category}
								className="flex items-center justify-between text-sm"
							>
								<span className="text-slate-600 truncate max-w-37.5">
									{category}
								</span>
								<span
									className={clsx(
										"font-medium",
										change > 0 && "text-emerald-600",
										change < 0 && "text-rose-500",
									)}
								>
									{change > 0 ? `+${change}` : change}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Duration */}
			<div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
				Total Duration: {formatDuration(after.total_duration)}
			</div>
		</div>
	);
}
