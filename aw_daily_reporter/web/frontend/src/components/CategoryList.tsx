"use client";

import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/contexts/I18nContext";
import { CATEGORY_COLORS, getCategoryColor } from "@/lib/colors";

interface Rule {
	keyword: string | string[];
	category: string;
	project: string;
	target?: string;
	app?: string;
	enabled?: boolean;
}

interface CategoryListProps {
	categories: string[];
	rules?: Rule[];
	onChange: (
		categories: string[],
		colors: Record<string, string>,
		breakCategories: string[],
	) => void;
	placeholder?: string;
	className?: string;
	initialColors?: Record<string, string>;
	initialBreakCategories?: string[];
}

export default function CategoryList({
	categories = [],
	rules = [],
	onChange,
	placeholder,
	className,
	initialColors = {},
	initialBreakCategories = [],
}: CategoryListProps) {
	const { t } = useTranslation();
	const finalPlaceholder = placeholder || t("Add a category...");
	const [input, setInput] = useState("");

	const handleAdd = () => {
		const trimmed = input.trim();
		if (trimmed && !categories.includes(trimmed)) {
			onChange([...categories, trimmed], initialColors, initialBreakCategories);
			setInput("");
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.nativeEvent.isComposing) return;
		if (e.key === "Enter") {
			e.preventDefault();
			handleAdd();
		}
	};

	const handleRemove = (categoryToRemove: string) => {
		if (!confirm(t("Are you sure you want to delete this category?"))) return;

		const newCategories = categories.filter((c) => c !== categoryToRemove);
		const newColors = { ...initialColors };
		delete newColors[categoryToRemove];
		const newBreaks = initialBreakCategories.filter(
			(c) => c !== categoryToRemove,
		);

		onChange(newCategories, newColors, newBreaks);
	};

	const handleColorChange = (category: string, color: string) => {
		const newColors = { ...initialColors, [category]: color };
		onChange(categories, newColors, initialBreakCategories);
		// Close dropdown (managed by CSS focus/hover usually, or we let it close on blur)
		// For DaisyUI dropdown, clicking inside might not close it automatically if we don't blur the trigger.
		// We can blur the active element.
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	};

	const handleTypeChange = (category: string, isBreak: boolean) => {
		let newBreaks = [...initialBreakCategories];
		if (isBreak) {
			if (!newBreaks.includes(category)) {
				newBreaks.push(category);
			}
		} else {
			newBreaks = newBreaks.filter((c) => c !== category);
		}
		onChange(categories, initialColors, newBreaks);
	};

	return (
		<div className={className}>
			<div className="flex gap-2 mb-4">
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={finalPlaceholder}
					className="flex-1 px-3 py-2 border border-base-content/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
				/>
				<button
					type="button"
					onClick={handleAdd}
					className="btn btn-sm btn-primary h-auto px-4"
					disabled={!input.trim() || categories.includes(input.trim())}
				>
					<Plus size={18} /> {t("Add")}
				</button>
			</div>

			<div className="border border-base-content/10 rounded-lg">
				<table className="table w-full text-sm">
					<thead>
						<tr className="bg-base-200 text-base-content/70">
							<th className="w-20 text-center">{t("Color")}</th>
							<th>{t("Category Name")}</th>
							<th className="w-32 text-center">{t("Type")}</th>
							<th className="w-20 text-center">{t("Actions")}</th>
						</tr>
					</thead>
					<tbody>
						{categories.length === 0 && (
							<tr>
								<td
									colSpan={4}
									className="text-center py-8 text-base-content/40 italic"
								>
									{t("No categories defined")}
								</td>
							</tr>
						)}
						{categories.map((category) => {
							const currentColor =
								initialColors[category] || getCategoryColor(category);
							const isBreak = initialBreakCategories.includes(category);
							const matchingRules = rules.filter(
								(r) => r.category === category,
							);

							return (
								<tr key={category} className="hover:bg-base-200/50 group/row">
									<td className="text-center overflow-visible">
										<div className="dropdown dropdown-right dropdown-end">
											<div
												tabIndex={0}
												role="button"
												className="w-6 h-6 rounded-full border border-base-content/20 shadow-sm cursor-pointer hover:scale-110 transition-transform mx-auto"
												style={{ backgroundColor: currentColor }}
												title={t("Change Color")}
											/>
											<div
												tabIndex={0}
												role="menu"
												className="dropdown-content z-50 card card-compact w-48 p-2 shadow-xl bg-base-100 border border-base-content/10"
											>
												<div className="grid grid-cols-5 gap-2">
													{CATEGORY_COLORS.map((color) => (
														<button
															key={color}
															type="button"
															className={clsx(
																"w-6 h-6 rounded-full border border-base-content/10 hover:scale-125 transition-transform",
																currentColor === color &&
																	"ring-2 ring-offset-1 ring-primary",
															)}
															style={{ backgroundColor: color }}
															onClick={() => handleColorChange(category, color)}
														/>
													))}
												</div>
											</div>
										</div>
									</td>
									<td className="font-medium relative">
										<div className="flex items-center gap-2">
											<span>{category}</span>
											{matchingRules.length > 0 && (
												<div
													className="tooltip tooltip-right z-40"
													data-tip={matchingRules
														.map((r) => {
															const k = Array.isArray(r.keyword)
																? r.keyword.join(", ")
																: r.keyword;
															return `${k} (${r.target || "title"})`;
														})
														.join("\n")}
												>
													<span className="badge badge-sm badge-ghost gap-1 cursor-help">
														{matchingRules.length}
													</span>
												</div>
											)}
										</div>
									</td>
									<td className="text-center">
										<div className="join">
											<button
												type="button"
												onClick={() => handleTypeChange(category, false)}
												className={`join-item btn btn-xs ${
													!isBreak
														? "btn-active font-bold"
														: "btn-ghost text-base-content/40"
												}`}
												title={t("Work")}
											>
												{t("Work")}
											</button>
											<button
												type="button"
												onClick={() => handleTypeChange(category, true)}
												className={`join-item btn btn-xs ${
													isBreak
														? "btn-active font-bold"
														: "btn-ghost text-base-content/40"
												}`}
												title={t("Break")}
											>
												{t("Break")}
											</button>
										</div>
									</td>
									<td className="text-center">
										<button
											type="button"
											onClick={() => handleRemove(category)}
											className="btn btn-ghost btn-xs text-error hover:bg-error/10"
											title={t("Delete Category")}
										>
											<Trash2 size={16} />
										</button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
