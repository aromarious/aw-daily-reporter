"use client";

import type { EChartsOption } from "echarts";
import { useChartTheme } from "@/hooks/useChartTheme";
import { getCategoryColor, getProjectColor } from "@/lib/colors";
import EChartsWrapper from "./EChartsWrapper";

interface TimelineItem {
	timestamp: string;
	duration: number;
	category?: string;
	project?: string;
}

interface DualLaneTimelineProps {
	data: TimelineItem[];
	height?: number;
	startTime?: string;
	endTime?: string;
}

function formatTime(date: Date): string {
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function DualLaneTimeline({
	data,
	height = 120,
	startTime: startTimeStr,
	endTime: endTimeStr,
}: DualLaneTimelineProps) {
	const theme = useChartTheme();

	if (data.length === 0) {
		return (
			<div className="flex items-center justify-center h-24 text-slate-400">
				No timeline data
			</div>
		);
	}

	// 時間範囲を取得
	const times = data.map((item) => new Date(item.timestamp).getTime());
	const durations = data.map((item) => item.duration * 1000);
	const startTime = Math.min(...times);
	const endTime = Math.max(...times.map((t, i) => t + durations[i]));

	// 2つのレーン: 0 = Project, 1 = Category
	const lanes = ["Project", "Category"];

	// データを2つのレーンに変換
	const seriesData: Array<{
		name: string;
		value: [number, number, number, number];
		itemStyle: { color: string };
		lane: string;
	}> = [];

	data.forEach((item) => {
		const start = new Date(item.timestamp).getTime();
		const end = start + item.duration * 1000;
		const duration = Math.round(item.duration / 60);

		// Project レーン
		const project = item.project || "Uncategorized";
		seriesData.push({
			name: project,
			value: [0, start, end, duration],
			itemStyle: {
				color: getProjectColor(project),
			},
			lane: "Project",
		});

		// Category レーン
		const category = item.category || "Other";
		seriesData.push({
			name: category,
			value: [1, start, end, duration],
			itemStyle: {
				color: getCategoryColor(category),
			},
			lane: "Category",
		});
	});

	const option: EChartsOption = {
		title: [
			{
				text: startTimeStr || "",
				left: "80px", // grid.left と同じ
				top: "0%",
				textStyle: {
					fontSize: 10,
					color: theme.subTextColor, // slate-400
					fontWeight: "normal",
				},
			},
			{
				text: endTimeStr || "",
				right: "20px", // grid.right と同じ
				top: "0%",
				textStyle: {
					fontSize: 10,
					color: theme.subTextColor, // slate-400
					fontWeight: "normal",
				},
			},
		],
		tooltip: {
			confine: true,
			position: "bottom",
			formatter: (params: unknown) => {
				const p = params as {
					data: {
						name: string;
						value: [number, number, number, number];
						lane: string;
					};
				};
				const startStr = formatTime(new Date(p.data.value[1]));
				const endStr = formatTime(new Date(p.data.value[2]));
				const duration = p.data.value[3];
				return `<strong>${p.data.name}</strong><br/>
					${startStr} - ${endStr}<br/>
					${duration} min`;
			},
			backgroundColor: theme.tooltipBackgroundColor,
			borderColor: theme.borderColor,
			borderWidth: 1,
			textStyle: { color: theme.tooltipTextColor },
			extraCssText:
				"box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px;",
		},
		grid: {
			left: "80px",
			right: "20px",
			top: "20px", // タイトル分のスペースを確保
			bottom: "10px",
		},
		xAxis: {
			type: "time",
			min: startTime,
			max: endTime,
			axisLabel: {
				formatter: (value: number) => formatTime(new Date(value)),
				color: theme.subTextColor,
				fontSize: 10,
			},
			axisLine: { lineStyle: { color: theme.lineColor } },
			splitLine: { show: true, lineStyle: { color: theme.splitLineColor } },
		},
		yAxis: {
			type: "category",
			data: lanes,
			axisLine: { show: false },
			axisLabel: { color: theme.subTextColor, fontSize: 11 },
			axisTick: { show: false },
		},
		series: [
			{
				type: "custom",
				renderItem: (
					_params: unknown,
					api: {
						value: (idx: number) => number;
						coord: (val: [number, number]) => [number, number];
						size: (val: [number, number]) => [number, number];
						style: () => Record<string, unknown>;
					},
				) => {
					const laneIdx = api.value(0);
					const start = api.coord([api.value(1), laneIdx]);
					const end = api.coord([api.value(2), laneIdx]);
					const barHeight = api.size([0, 1])[1] * 0.7;

					return {
						type: "rect",
						shape: {
							x: start[0],
							y: start[1] - barHeight / 2,
							width: Math.max(end[0] - start[0], 2),
							height: barHeight,
						},
						style: api.style(),
					};
				},
				encode: {
					x: [1, 2],
					y: 0,
				},
				itemStyle: {
					borderRadius: 3,
				},
				data: seriesData,
			},
		] as EChartsOption["series"],
	};

	return (
		<EChartsWrapper
			option={option}
			style={{ height: `${height}px`, width: "100%" }}
		/>
	);
}
