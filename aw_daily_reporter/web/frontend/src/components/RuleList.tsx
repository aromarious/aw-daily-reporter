"use client";

import clsx from "clsx";
import { Edit, GripVertical, Trash2 } from "lucide-react";

interface Rule {
	keyword: string | string[];
	category: string;
	project: string;
	target?: string;
	app?: string;
	enabled?: boolean;
}

// 配列の場合は空白で結合して表示
function formatKeyword(keyword: string | string[]): string {
	if (Array.isArray(keyword)) {
		return keyword.join(" ");
	}
	return keyword;
}

interface RuleListProps {
	rules: Rule[];
	onEdit: (index: number) => void;
	onDelete: (index: number) => void;
	onToggle: (index: number) => void;
	onDragStart: (event: React.DragEvent, index: number) => void;
	onDragOver: (event: React.DragEvent) => void;
	onDrop: (event: React.DragEvent, index: number) => void;
	onDragEnd: () => void;
	draggedIndex: number | null;
}

export default function RuleList({
	rules,
	onEdit,
	onDelete,
	onToggle,
	onDragStart,
	onDragOver,
	onDrop,
	onDragEnd,
	draggedIndex,
}: RuleListProps) {
	if (!rules || rules.length === 0) {
		return (
			<div className="text-center py-8 text-base-content/60 bg-base-200 rounded-lg border border-dashed border-base-content/10">
				No rules defined. Add one above.
			</div>
		);
	}

	return (
		<ul className="flex flex-col gap-2">
			{rules.map((rule, index) => {
				const isDragged = draggedIndex === index;
				return (
					<li
						key={`${rule.keyword}-${rule.category}-${index}`}
						draggable
						onDragStart={(e) => onDragStart(e, index)}
						onDragOver={onDragOver}
						onDrop={(e) => onDrop(e, index)}
						onDragEnd={onDragEnd}
						className={clsx(
							"group flex gap-3 p-3 rounded-lg border transition-all text-left w-full list-none",
							isDragged
								? "opacity-50 border-dashed border-primary bg-base-200"
								: "border-base-content/10 bg-base-100 hover:bg-base-200 hover:border-primary/30",
						)}
					>
						{/* Enable/Disable Toggle */}
						<input
							type="checkbox"
							className="toggle toggle-sm shrink-0 self-start mt-1 border-base-content/20 bg-base-300 text-base-content checked:border-primary checked:bg-primary checked:text-primary-content"
							checked={rule.enabled !== false}
							onChange={(e) => {
								e.stopPropagation();
								onToggle(index);
							}}
							title={rule.enabled !== false ? "Enabled" : "Disabled"}
						/>

						<div
							className="cursor-move pt-1 text-base-content/40 hover:text-base-content/80 self-start"
							title="Drag to reorder"
						>
							<GripVertical size={18} />
						</div>

						<div className="flex-1 flex flex-col gap-1.5 min-w-0">
							{/* Top Row: Keyword - Target - AppFilter */}
							<div className="flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={() => onEdit(index)}
									className="text-base-content font-semibold hover:text-primary transition-colors focus:outline-none truncate max-w-75"
									title={formatKeyword(rule.keyword)}
								>
									{formatKeyword(rule.keyword)}
								</button>
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<span className="bg-base-200 text-base-content/60 px-2 py-0.5 rounded border border-base-content/10 whitespace-nowrap">
										Target: {rule.target || "title"}
									</span>
									{rule.app && (
										<span className="bg-base-200 text-base-content/60 px-2 py-0.5 rounded border border-base-content/10 whitespace-nowrap">
											Filter: {rule.app}
										</span>
									)}
								</div>
							</div>

							{/* Bottom Row: Output (Category - Project) */}
							<div className="flex flex-wrap gap-2 text-xs w-full">
								{rule.category ? (
									<span className="badge badge-primary badge-outline font-medium gap-1">
										→ Cat: {rule.category}
									</span>
								) : (
									<span className="text-base-content/40 italic">
										No Category
									</span>
								)}
								{rule.project && (
									<span className="badge badge-success badge-outline font-medium gap-1">
										→ Proj: {rule.project}
									</span>
								)}
							</div>
						</div>

						<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-start shrink-0">
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onEdit(index);
								}}
								className="p-1.5 text-base-content/40 hover:text-primary hover:bg-primary/10 rounded transition-colors"
								title="Edit"
							>
								<Edit size={16} />
							</button>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onDelete(index);
								}}
								className="p-1.5 text-base-content/40 hover:text-error hover:bg-error/10 rounded transition-colors"
								title="Delete"
							>
								<Trash2 size={16} />
							</button>
						</div>
					</li>
				);
			})}
		</ul>
	);
}
