"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	// Prevent hydration mismatch by rendering only after mount
	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return <div className="w-8 h-8" />; // Placeholder to avoid layout shift
	}

	const toggleTheme = () => {
		setTheme(theme === "dark" ? "light" : "dark");
	};

	return (
		<button
			onClick={toggleTheme}
			className="btn btn-ghost btn-circle btn-sm"
			aria-label="Toggle theme"
		>
			{theme === "dark" ? (
				<Sun className="h-5 w-5" />
			) : (
				<Moon className="h-5 w-5" />
			)}
		</button>
	);
}
