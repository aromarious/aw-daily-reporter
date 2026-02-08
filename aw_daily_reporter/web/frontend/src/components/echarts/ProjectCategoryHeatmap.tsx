"use client";

import type { EChartsOption } from "echarts";
import { useChartTheme } from "@/hooks/useChartTheme";
import { isUncategorized } from "../../lib/colors";
import EChartsWrapper from "./EChartsWrapper";

interface ProjectCategoryData {
	projects: string[];
	categories: string[];
	matrix: number[][]; // [project][category] = seconds
}

interface ProjectCategoryHeatmapProps {
	data: ProjectCategoryData;
	onCellClick?: (project: string, category: string) => void;
	onProjectClick?: (project: string) => void;
	onCategoryClick?: (category: string) => void;
}

function formatDuration(seconds: number): string {
	if (seconds < 60) {
		return `${Math.round(seconds)}s`;
	}
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) {
		return `${h}h ${m}m`;
	}
	return `${m}m`;
}

export default function ProjectCategoryHeatmap({
	data,
	onCellClick,
	onProjectClick,
	onCategoryClick,
}: ProjectCategoryHeatmapProps) {
	const theme = useChartTheme();

	if (!data.projects.length || !data.categories.length) {
		return (
			<div className="flex items-center justify-center h-32 text-slate-400">
				No data for heatmap
			</div>
		);
	}

	// Helper to check for unclassified items
	// isUncategorized is imported from lib/colors

	// Calculate max first
	let max = 0;
	data.matrix.forEach((row) => {
		row.forEach((val) => {
			if (val > max) max = val;
		});
	});

	// Use object structure for data to allow individual styling
	type SeriesDataItem = {
		value: [number, number, number];
		label?: {
			color?: string;
		};
	};

	const normalData: SeriesDataItem[] = [];
	const unclassifiedData: SeriesDataItem[] = [];

	for (let i = 0; i < data.projects.length; i++) {
		for (let j = 0; j < data.categories.length; j++) {
			const value = data.matrix[i]?.[j] || 0;
			const project = data.projects[i];
			const category = data.categories[j];

			// Decide text color based on background intensity
			// Dark mode: background is usually dark, so text should be light if value is low (transparent/light bg) or high (dark bg)?
			// Actually heatmaps use color scale. If scale goes to dark blue, white text is good.
			// Let's stick to simple logic: if value is high, background is strong color.
			// In dark mode, low value = dark bg, high value = bright/light color?
			// The color scale below is: ["#f1f5f9", "#a5b4fc", "#6366f1", "#4338ca"] (Light -> Dark Blue)
			// Wait, #4338ca is dark blue. #f1f5f9 is light gray.
			// So high value = dark background = white text.
			// Low value = light background = dark text.
			// This logic works for Light Mode.

			// For Dark Mode, we should invert the color scale or ensure compatibility.
			// Let's adjust visualMap colors based on theme.

			const isDarkBackground = max > 0 && value > max * 0.5;
			// Default label color logic (mostly for high contrast against the cell color)
			const labelColor = isDarkBackground ? "#ffffff" : theme.textColor;

			const entry: SeriesDataItem = {
				value: [j, i, value],
				label: { color: labelColor },
			};

			if (isUncategorized(project) || isUncategorized(category)) {
				unclassifiedData.push(entry);
			} else {
				normalData.push(entry);
			}
		}
	}

	const commonTooltipFormatter = (params: unknown) => {
		const p = params as { data: SeriesDataItem };
		const [catIdx, projIdx, value] = p.data.value;
		const project = data.projects[projIdx] || "Unknown";
		const category = data.categories[catIdx] || "Unknown";
		return `<strong>${project}</strong> × ${category}<br/>${formatDuration(value)}`;
	};

	const commonLabelOption = {
		show: true,
		formatter: (params: unknown) => {
			const p = params as { data: SeriesDataItem };
			const value = p.data.value[2];
			if (value < 60) return "";
			return formatDuration(value);
		},
		fontSize: 9,
		color: theme.textColor,
	};

	const option: EChartsOption = {
		tooltip: {
			position: "top",
			formatter: commonTooltipFormatter,
			backgroundColor: theme.tooltipBackgroundColor,
			borderColor: theme.borderColor,
			borderWidth: 1,
			textStyle: {
				color: theme.tooltipTextColor,
			},
			extraCssText:
				"box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px;",
		},
		grid: {
			top: "10%",
			left: "15%",
			right: "15%",
			bottom: "15%",
		},
		xAxis: {
			type: "category",
			data: data.categories,
			position: "top",
			axisLine: { show: false },
			axisLabel: {
				color: theme.subTextColor,
				fontSize: 10,
				rotate: 45,
				triggerEvent: true,
			},
			axisTick: { show: false },
			splitArea: {
				show: true,
				areaStyle: {
					color: [
						theme.isDark ? "rgba(255,255,255,0.02)" : "rgba(250,250,250,0.3)",
						theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(200,200,200,0.1)",
					],
				},
			}, // Subtle Zebra stripe
		} as EChartsOption["xAxis"],
		yAxis: {
			type: "category",
			data: data.projects,
			inverse: true,
			axisLine: { show: false },
			axisLabel: {
				color: theme.subTextColor,
				fontSize: 10,
				triggerEvent: true,
			},
			axisTick: { show: false },
			splitArea: {
				show: true,
				areaStyle: {
					color: [
						theme.isDark ? "rgba(255,255,255,0.02)" : "rgba(250,250,250,0.3)",
						theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(200,200,200,0.1)",
					],
				},
			},
		} as EChartsOption["yAxis"],
		visualMap: [
			{
				type: "continuous",
				seriesIndex: 0, // For normal data (Blue)
				min: 0,
				max: Math.max(max, 1),
				calculable: true,
				orient: "vertical",
				right: "2%",
				top: "center",
				inRange: {
					// Use different scale for dark mode if needed, or keeping it same as it is blue which works on dark
					// Light: ["#f1f5f9", "#a5b4fc", "#6366f1", "#4338ca"]
					// Dark: Maybe start darker? #1e293b is bg.
					color: theme.isDark
						? ["#334155", "#6366f1", "#818cf8", "#c7d2fe"] // Dark slate -> Indigo -> Light Indigo
						: ["#f1f5f9", "#a5b4fc", "#6366f1", "#4338ca"],
				},
				formatter: (value: number | string) =>
					formatDuration(typeof value === "number" ? value : 0),
				textStyle: { color: theme.subTextColor, fontSize: 10 },
			},
			{
				type: "continuous",
				seriesIndex: 1, // For unclassified data (Grayscale)
				min: 0,
				max: Math.max(max, 1),
				calculable: false, // Hide handle/text for secondary visualMap to avoid clutter
				show: false, // Completely hide the visualMap controller for unclassified
				inRange: {
					// Darker grayscale for better visibility
					color: theme.isDark
						? ["#404040", "#525252", "#737373", "#a3a3a3"] // Neutral 700 -> 400 (True Grayscale)
						: ["#e5e5e5", "#d4d4d4", "#a3a3a3", "#737373"], // Neutral 200 -> 500
				},
			},
		] as EChartsOption["visualMap"],
		series: [
			{
				name: "Normal Time",
				type: "heatmap",
				data: normalData,
				label: commonLabelOption,
				emphasis: {
					itemStyle: {
						shadowBlur: 10,
						shadowColor: "rgba(0, 0, 0, 0.5)",
					},
				},
				itemStyle: {
					borderRadius: 4,
					borderColor: theme.isDark ? "#1e293b" : "#fff",
					borderWidth: 2,
				},
			},
			{
				name: "Unclassified Time",
				type: "heatmap",
				data: unclassifiedData,
				label: commonLabelOption,
				emphasis: {
					itemStyle: {
						shadowBlur: 10,
						shadowColor: "rgba(0, 0, 0, 0.5)",
					},
				},
				itemStyle: {
					borderRadius: 4,
					borderColor: theme.isDark ? "#1e293b" : "#fff",
					borderWidth: 2,
				},
			},
		] as EChartsOption["series"],
	};

	const handleEvents = {
		click: (params: unknown) => {
			const p = params as {
				componentType?: string;
				data?: SeriesDataItem;
				value?: string;
			};
			// Axis label click (project or category)
			if (p.componentType === "yAxis" && p.value) {
				onProjectClick?.(p.value);
				return;
			}
			if (p.componentType === "xAxis" && p.value) {
				onCategoryClick?.(p.value);
				return;
			}
			// Cell click
			if (p.data) {
				const [catIdx, projIdx] = p.data.value;
				const project = data.projects[projIdx];
				const category = data.categories[catIdx];
				if (project && category) {
					onCellClick?.(project, category);
				}
			}
		},
	};

	return (
		<EChartsWrapper
			option={option}
			style={{
				height: `${Math.max(200, data.projects.length * 40 + 100)}px`,
				width: "100%",
			}}
			onEvents={handleEvents}
		/>
	);
}
