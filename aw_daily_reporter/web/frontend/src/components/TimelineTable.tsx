"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/contexts/I18nContext";

interface TimelineItem {
	timestamp: string;
	duration: number;
	app: string;
	title: string;
	url?: string;
	category?: string;
	project?: string;
	metadata?: {
		client?: string;
		matched_rule?: {
			keyword: string;
			target: string;
		};
	};
}

interface TimelineTableProps {
	data: TimelineItem[];
	clients?: Record<string, { name: string }>;
	height?: string;
	onCreateRule?: (item: TimelineItem) => void;
}

export default function TimelineTable({
	data = [],
	clients = {},
	height = "600px",
	onCreateRule,
}: TimelineTableProps) {
	const { t } = useTranslation();
	// Context Menu State
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		item: TimelineItem;
	} | null>(null);

	const menuRef = useRef<HTMLDivElement>(null);

	// Close menu on click outside
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setContextMenu(null);
			}
		};
		window.addEventListener("click", handleClick);
		return () => window.removeEventListener("click", handleClick);
	}, []);

	const handleContextMenu = (e: React.MouseEvent, item: TimelineItem) => {
		e.preventDefault();

		// Calculate position to keep within viewport
		let x = e.clientX;
		let y = e.clientY;

		// Simple boundary check (assuming menu approx size)
		if (typeof window !== "undefined") {
			const menuWidth = 180;
			const menuHeight = 100;
			if (x + menuWidth > window.innerWidth) x -= menuWidth;
			if (y + menuHeight > window.innerHeight) y -= menuHeight;
		}

		setContextMenu({
			x,
			y,
			item,
		});
	};

	return (
		<div
			className="w-full overflow-auto border border-base-200 rounded-xl bg-base-100/50 backdrop-blur-sm relative"
			style={{ maxHeight: height }}
		>
			<table className="w-full text-sm text-left">
				<thead className="bg-base-200/90 backdrop-blur sticky top-0 z-10 border-b border-base-300 text-base-content/70 font-medium">
					<tr>
						<th className="px-4 py-3 whitespace-nowrap">{t("Time")}</th>
						<th className="px-4 py-3 whitespace-nowrap">{t("Dur (s)")}</th>
						<th className="px-4 py-3 whitespace-nowrap">{t("App")}</th>
						<th className="px-4 py-3 whitespace-nowrap w-2/3">{t("Title")}</th>
						<th className="px-4 py-3 whitespace-nowrap w-1/3">{t("URL")}</th>
						<th className="px-4 py-3 whitespace-nowrap">{t("Category")}</th>
						<th className="px-4 py-3 whitespace-nowrap">{t("Project")}</th>
						<th className="px-4 py-3 whitespace-nowrap">{t("Client")}</th>
						<th className="px-4 py-3 whitespace-nowrap">{t("Rule")}</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-base-200">
					{data.map((item, index) => {
						const start = new Date(item.timestamp);
						let ruleInfo = null;
						if (item.metadata?.matched_rule) {
							ruleInfo = `${item.metadata.matched_rule.keyword} (${
								item.metadata.matched_rule.target || "all"
							})`;
						}
						const clientId = item.metadata?.client;
						// Resolve client name
						const clientName =
							clientId && clients[clientId] ? clients[clientId].name : clientId;

						return (
							<tr
								key={`${item.timestamp}-${item.app}-${index}`}
								className="hover:bg-base-200/50 transition-colors cursor-context-menu"
								onContextMenu={(e) => handleContextMenu(e, item)}
							>
								<td className="px-4 py-2 whitespace-nowrap text-base-content/60 font-mono text-xs">
									{start.toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</td>
								<td className="px-4 py-2 whitespace-nowrap text-right text-base-content/60">
									{item.duration.toFixed(0)}
								</td>
								<td className="px-4 py-2 whitespace-nowrap font-medium text-base-content">
									{item.app}
								</td>
								<td
									className="px-4 py-2 text-base-content/80 max-w-75 truncate"
									title={item.title}
								>
									{item.title}
								</td>
								<td className="px-4 py-2 text-base-content/80 max-w-64 truncate">
									{item.url ? (
										<a
											href={item.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-primary hover:underline"
											title={item.url}
											onClick={(e) => e.stopPropagation()}
										>
											{item.url}
										</a>
									) : (
										<span className="text-base-content/30">-</span>
									)}
								</td>
								<td className="px-4 py-2 whitespace-nowrap">
									{item.category && item.category !== "Other" ? (
										<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
											{item.category}
										</span>
									) : (
										<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-base-200 text-base-content/70">
											{item.category || "Uncategorized"}
										</span>
									)}
								</td>
								<td className="px-4 py-2 whitespace-nowrap">
									{item.project && item.project !== "Uncategorized" ? (
										<span className="text-base-content/90">{item.project}</span>
									) : (
										<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-base-200 text-base-content/70">
											{item.project || "Uncategorized"}
										</span>
									)}
								</td>
								<td className="px-4 py-2 whitespace-nowrap">
									{clientName ? (
										<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
											{clientName}
										</span>
									) : (
										<span className="text-base-content/30">-</span>
									)}
								</td>
								<td className="px-4 py-2 whitespace-nowrap">
									{ruleInfo ? (
										<span
											className="inline-flex px-2 py-0.5 text-xs font-semibold text-white bg-slate-500 rounded-full truncate max-w-30"
											title={ruleInfo}
										>
											{ruleInfo}
										</span>
									) : (
										""
									)}
								</td>
							</tr>
						);
					})}
					{data.length === 0 && (
						<tr>
							<td
								colSpan={9}
								className="px-4 py-8 text-center text-base-content/50"
							>
								{t("No data available")}
							</td>
						</tr>
					)}
				</tbody>
			</table>

			{/* Context Menu - Rendered in Portal to avoid clipping or relative positioning issues */}
			{contextMenu &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						ref={menuRef}
						className="fixed bg-base-100 rounded-lg shadow-xl border border-base-200 py-1 min-w-40 animate-in fade-in zoom-in-95 duration-100"
						style={{ top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
					>
						<div className="px-3 py-1.5 border-b border-base-200 mb-1">
							<p className="text-xs font-semibold text-base-content/70 truncate max-w-48">
								{contextMenu.item.app}
							</p>
							<p className="text-[10px] text-base-content/50 truncate max-w-48">
								{contextMenu.item.title}
							</p>
						</div>
						<button
							type="button"
							className="w-full text-left px-3 py-2 text-sm text-base-content hover:bg-base-200 hover:text-primary transition-colors flex items-center gap-2"
							onClick={() => {
								if (onCreateRule) onCreateRule(contextMenu.item);
								setContextMenu(null);
							}}
						>
							<span className="text-primary">+</span> {t("Create Rule")}
						</button>
					</div>,
					document.body,
				)}
		</div>
	);
}
