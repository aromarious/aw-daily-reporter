import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { twMerge } from "tailwind-merge";

interface CardProps {
	title?: ReactNode;
	icon?: ReactNode;
	children: ReactNode;
	className?: string;
	collapsible?: boolean;
	defaultOpen?: boolean;
	isOpen?: boolean; // 外部から制御する場合（undefined の場合は内部 state を使用）
	onToggle?: (isOpen: boolean) => void;
}

export function Card({
	title,
	icon,
	children,
	className,
	collapsible = false,
	defaultOpen = true,
	isOpen: controlledIsOpen,
	onToggle,
}: CardProps) {
	const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);

	// 外部制御がある場合はそれを優先、なければ内部 state を使用
	const isOpen =
		controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

	const handleToggle = () => {
		if (!collapsible) return;
		const newState = !isOpen;
		if (controlledIsOpen === undefined) {
			setInternalIsOpen(newState);
		}
		onToggle?.(newState);
	};

	return (
		<div
			className={twMerge(
				clsx(
					"backdrop-blur border rounded-xl shadow-sm transition-all hover:shadow-md",
					"border-base-200/80 dark:border-base-content/10", // Lighter border in dark mode
					collapsible && !isOpen
						? "bg-base-100/50 hover:bg-base-200/80 dark:bg-base-200/30 dark:hover:bg-base-200/50 h-fit"
						: "bg-base-100/85 dark:bg-base-200/40", // More distinct background in dark mode
					className,
					collapsible ? "p-0" : "p-6",
				),
			)}
		>
			{title && (
				<button
					type="button"
					onClick={handleToggle}
					disabled={!collapsible}
					className={clsx(
						"w-full flex items-center justify-between text-lg font-semibold text-base-content",
						collapsible
							? isOpen
								? "p-6 text-left"
								: "px-6 py-3 text-left"
							: "mb-4 cursor-default",
					)}
				>
					<span className="flex items-center gap-2">
						{icon}
						{title}
					</span>
					{collapsible && (
						<ChevronDown
							className={clsx(
								"text-base-content/60 transition-transform duration-200",
								isOpen ? "rotate-180" : "",
							)}
						/>
					)}
				</button>
			)}

			<div
				className={clsx(
					"transition-all duration-300 ease-in-out overflow-hidden flex-1 flex flex-col",
					collapsible && (isOpen ? "opacity-100" : "max-h-0 opacity-0"),
				)}
				style={collapsible && isOpen ? { maxHeight: "2000px" } : {}}
			>
				<div
					className={clsx("flex-1 flex flex-col", collapsible && "px-6 pb-6")}
				>
					{children}
				</div>
			</div>
		</div>
	);
}
