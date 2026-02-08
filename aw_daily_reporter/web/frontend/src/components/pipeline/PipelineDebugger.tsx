"use client";

import { ArrowDown, Bug, CalendarDays, Loader2, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/Card";

//const PipelineSteps = dynamic(() => import("./PipelineSteps"), { ssr: false });
const SnapshotTimeline = dynamic(() => import("./SnapshotTimeline"), {
	ssr: false,
});

interface StageInfo {
	index: number;
	name: string;
	item_count: number;
	categorized_count: number;
	project_count: number;
	total_duration: number;
}

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
	plugin?: string;
}

interface PipelineData {
	stages: StageInfo[];
	before: Snapshot | null;
	after: Snapshot | null;
	snapshots: Snapshot[];
	diff: {
		category_changes: Record<string, number>;
		project_changes?: Record<string, number>;
	};
	selected_stage: number;
}

const fetcher = async (url: string, body: Record<string, unknown>) => {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error("Failed to fetch pipeline data");
	return res.json();
};

interface PipelineDebuggerProps {
	initialDate?: string;
}

import { useSearchParams } from "next/navigation";

// ...

export default function PipelineDebugger({
	initialDate,
}: PipelineDebuggerProps) {
	const searchParams = useSearchParams();
	const dateParam = searchParams.get("date");
	const today = new Date().toISOString().split("T")[0];
	const [date, setDate] = useState(dateParam || initialDate || today);
	const [selectedStage, setSelectedStage] = useState(1);
	// スナップショット有効化フラグ（パフォーマンス最適化のためデフォルトOFF）
	const [includeSnapshots, setIncludeSnapshots] = useState(false);
	// Track closed stages to exclude them from domain calculation
	const [closedStages, setClosedStages] = useState<Set<number>>(new Set());

	// Fetch pipeline data
	const { data, error, isLoading, mutate } = useSWR<PipelineData>(
		["/api/pipeline/preview", date, selectedStage, includeSnapshots],
		([url]) => fetcher(url, { date, stage: selectedStage, include_snapshots: includeSnapshots }),
		{
			revalidateOnFocus: false,
			keepPreviousData: true,
		},
	);

	const handleRefresh = useCallback(() => {
		mutate();
	}, [mutate]);

	const snapshots = useMemo(() => data?.snapshots || [], [data]);

	// Calculate global time domain for alignment (only for OPEN stages)
	const globalDomain = useMemo(() => {
		if (snapshots.length === 0) return { start: undefined, end: undefined };

		let minTime = Infinity;
		let maxTime = -Infinity;
		let hasOpenSnapshots = false;

		snapshots.forEach((snap, index) => {
			if (closedStages.has(index)) return;
			hasOpenSnapshots = true;
			snap.timeline.forEach((item) => {
				const start = new Date(item.timestamp).getTime();
				const end = start + item.duration * 1000;
				if (start < minTime) minTime = start;
				if (end > maxTime) maxTime = end;
			});
		});

		if (!hasOpenSnapshots || minTime === Infinity || maxTime === -Infinity)
			return { start: undefined, end: undefined };

		return { start: minTime, end: maxTime };
	}, [snapshots, closedStages]);

	const handleStageSelect = useCallback((index: number) => {
		setSelectedStage(index);
		const el = document.getElementById(`snapshot-${index}`);
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}, []);

	const handleCardToggle = useCallback((index: number, isOpen: boolean) => {
		setClosedStages((prev) => {
			const next = new Set(prev);
			if (isOpen) next.delete(index);
			else next.add(index);
			return next;
		});
	}, []);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div>
						<h1 className="text-xl font-bold text-base-content">
							Pipeline Debugger
						</h1>
						<p className="text-sm text-base-content/60">
							Visualize data transformation through processing stages
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3">
					{/* Date Picker */}
					<div className="flex items-center gap-2 bg-base-100 border border-base-content/20 rounded-lg px-3 py-2">
						<CalendarDays size={16} className="text-base-content/40" />
						<input
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							className="text-sm text-base-content bg-transparent border-none outline-none"
						/>
					</div>

					{/* Snapshots Toggle */}
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							className="toggle toggle-sm toggle-primary"
							checked={includeSnapshots}
							onChange={(e) => setIncludeSnapshots(e.target.checked)}
						/>
						<span className="text-sm text-base-content/70">Snapshots</span>
					</label>

					{/* Refresh Button */}
					<button
						type="button"
						onClick={handleRefresh}
						disabled={isLoading}
						className="flex items-center gap-2 px-3 py-2 bg-base-100 border border-base-content/20 rounded-lg text-sm text-base-content/70 hover:bg-base-200 transition-colors disabled:opacity-50"
					>
						<RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
						Refresh
					</button>
				</div>
			</div>

			{/* Error State */}
			{error && (
				<div className="bg-error/10 border border-error/20 rounded-xl p-4 text-error">
					Failed to load pipeline data: {error.message}
				</div>
			)}

			{/* Loading State for initial load */}
			{isLoading && !data && (
				<div className="flex items-center justify-center h-48 text-base-content/40">
					<Loader2 className="animate-spin mr-2" size={20} />
					Loading pipeline data...
				</div>
			)}

			{/* Pipeline Overview (Horizontal Steps) - REMOVED */}

			{/* Main Content: Vertical Stack of Snapshots */}
			<div className="space-y-4 pb-20">
				{snapshots.map((snapshot, index) => (
					<div
						key={snapshot.name}
						id={`snapshot-${index}`}
						className="flex flex-col items-center"
					>
						{/* Connector Arrow with Plugin Name */}
						{index > 0 && (
							<div className="h-12 w-px bg-base-content/20 my-1 relative">
								<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-base-200 px-2 py-0.5 rounded-full border border-base-content/10 text-base-content/60 text-xs flex items-center gap-1 shadow-xs whitespace-nowrap z-10">
									{snapshot.plugin && (
										<span className="font-mono text-[10px] text-primary font-medium">
											{snapshot.plugin}
										</span>
									)}
									<ArrowDown size={12} />
								</div>
							</div>
						)}

						<div className="w-full transition-all duration-500">
							<Card
								title={
									<span className="flex items-center gap-2">
										{index + 1}. {snapshot.name}
										<span className="text-xs font-normal text-base-content/40 bg-base-200/50 px-1.5 py-0.5 rounded">
											{snapshot.timeline?.length || 0} items
										</span>
									</span>
								}
								collapsible
								defaultOpen={true}
								onToggle={(isOpen) => handleCardToggle(index, isOpen)}
							>
								<SnapshotTimeline
									snapshot={snapshot}
									domainStart={globalDomain.start}
									domainEnd={globalDomain.end}
									height={300}
								/>
							</Card>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
