"use client";

import clsx from "clsx";
import { ArrowRight, Check, Circle, Loader2 } from "lucide-react";

interface StageInfo {
	index: number;
	name: string;
	item_count: number;
	categorized_count: number;
	project_count: number;
	total_duration: number;
}

interface PipelineStepsProps {
	stages: StageInfo[];
	selectedStage: number;
	onStageSelect: (index: number) => void;
	isLoading?: boolean;
	orientation?: "horizontal" | "vertical";
}

export default function PipelineSteps({
	stages,
	selectedStage,
	onStageSelect,
	isLoading,
	orientation = "horizontal",
}: PipelineStepsProps) {
	if (stages.length === 0) {
		return (
			<div className="flex items-center justify-center h-16 text-slate-400">
				{isLoading ? (
					<>
						<Loader2 className="animate-spin mr-2" size={18} />
						Loading pipeline...
					</>
				) : (
					"No pipeline data"
				)}
			</div>
		);
	}

	const isVertical = orientation === "vertical";

	return (
		<div
			className={clsx("overflow-x-auto", isVertical ? "h-full pr-2" : "pb-2")}
		>
			<div
				className={clsx(
					"flex items-center gap-1 min-w-max",
					isVertical ? "flex-col w-full items-stretch gap-3" : "",
				)}
			>
				{stages.map((stage, idx) => (
					<div
						key={stage.index}
						className={clsx(
							"flex items-center",
							isVertical ? "flex-col w-full" : "",
						)}
					>
						{/* Stage Node */}
						<button
							type="button"
							onClick={() => onStageSelect(stage.index)}
							className={clsx(
								"relative flex transition-all",
								isVertical
									? "w-full items-center p-3 rounded-lg border text-left gap-3"
									: "flex-col items-center p-3 rounded-xl border-2 min-w-30",
								"hover:shadow-md",
								selectedStage === stage.index
									? "border-indigo-500 bg-indigo-50 shadow-md"
									: "border-slate-200 bg-white hover:border-indigo-300",
							)}
						>
							{/* Status Icon */}
							<div
								className={clsx(
									"rounded-full flex items-center justify-center shrink-0",
									isVertical ? "w-6 h-6" : "w-8 h-8 mb-2",
									selectedStage === stage.index
										? "bg-indigo-500 text-white"
										: stage.index < selectedStage
											? "bg-emerald-100 text-emerald-600"
											: "bg-slate-100 text-slate-400",
								)}
							>
								{stage.index < selectedStage ? (
									<Check size={isVertical ? 14 : 16} />
								) : selectedStage === stage.index ? (
									<Circle
										size={isVertical ? 14 : 16}
										className="fill-current"
									/>
								) : (
									<Circle size={isVertical ? 14 : 16} />
								)}
							</div>

							{/* Content */}
							<div className={clsx(isVertical ? "flex-1 min-w-0" : "")}>
								{/* Stage Name */}
								<span
									className={clsx(
										"font-medium leading-tight block truncate",
										selectedStage === stage.index
											? "text-indigo-700"
											: "text-slate-600",
										isVertical ? "text-sm" : "text-xs text-center",
									)}
								>
									{stage.name.replace("After ", "")}
								</span>

								{/* Stats */}
								<div
									className={clsx(
										"text-slate-400 mt-1",
										isVertical
											? "text-xs flex items-center gap-2"
											: "text-[10px] flex justify-center gap-2",
									)}
								>
									<span>{stage.item_count} items</span>
									{stage.categorized_count > 0 && (
										<span className="text-emerald-500">
											{stage.categorized_count} cat
										</span>
									)}
								</div>
							</div>
						</button>

						{/* Arrow - Hide in vertical mode for cleaner look, or use Down arrow */}
						{!isVertical && idx < stages.length - 1 && (
							<ArrowRight
								size={18}
								className={clsx(
									"mx-1 shrink-0",
									idx < selectedStage ? "text-emerald-400" : "text-slate-300",
								)}
							/>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
