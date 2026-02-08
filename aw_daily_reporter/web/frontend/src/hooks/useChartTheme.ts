import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export interface ChartTheme {
	textColor: string;
	subTextColor: string;
	backgroundColor: string;
	borderColor: string;
	lineColor: string;
	splitLineColor: string;
	tooltipBackgroundColor: string;
	tooltipTextColor: string;
	graphicFill: string;
	graphicSubFill: string;
	isDark: boolean;
}

export function useChartTheme(): ChartTheme {
	const { theme, systemTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const currentTheme = theme === "system" ? systemTheme : theme;
	const isDark = mounted && currentTheme === "dark";

	if (isDark) {
		return {
			textColor: "#cbd5e1", // slate-300
			subTextColor: "#94a3b8", // slate-400
			backgroundColor: "transparent",
			borderColor: "#334155", // slate-700
			lineColor: "#334155", // slate-700
			splitLineColor: "#334155", // slate-700
			tooltipBackgroundColor: "rgba(30, 41, 59, 0.95)", // slate-800
			tooltipTextColor: "#f8fafc", // slate-50
			graphicFill: "#cbd5e1", // slate-300
			graphicSubFill: "#94a3b8", // slate-400
			isDark: true,
		};
	}

	return {
		textColor: "#334155", // slate-700
		subTextColor: "#64748b", // slate-500
		backgroundColor: "transparent",
		borderColor: "#e2e8f0", // slate-200
		lineColor: "#e2e8f0", // slate-200
		splitLineColor: "#f1f5f9", // slate-100
		tooltipBackgroundColor: "rgba(255, 255, 255, 0.95)",
		tooltipTextColor: "#334155",
		graphicFill: "#334155",
		graphicSubFill: "#94a3b8",
		isDark: false,
	};
}
