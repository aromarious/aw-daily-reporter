"use client";

import type { ECharts, EChartsOption } from "echarts";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(
	() =>
		Promise.all([
			import("echarts-for-react"),
			// @ts-expect-error: Theme module does not have type definitions
			import("echarts/theme/dark"),
		]).then(([mod]) => mod.default),
	{ ssr: false },
);

interface EChartsWrapperProps {
	option: EChartsOption;
	style?: React.CSSProperties;
	className?: string;
	onEvents?: Record<string, (params: unknown, instance: ECharts) => void>;
	theme?: string | object;
	onChartReady?: (instance: ECharts) => void;
}

export default function EChartsWrapper({
	option,
	style = { height: "300px", width: "100%" },
	className = "",
	onEvents,
	theme = "light",
	onChartReady,
}: EChartsWrapperProps) {
	return (
		<ReactECharts
			option={option}
			style={style}
			className={className}
			onEvents={onEvents}
			theme={theme}
			opts={{ renderer: "canvas" }}
			onChartReady={onChartReady}
		/>
	);
}
