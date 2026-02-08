"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { setCustomCategoryColors } from "@/lib/colors";

export function ConfigInitializer() {
	const { data: config } = useSWR("/api/settings", fetcher);

	useEffect(() => {
		if (config?.settings?.category_colors) {
			setCustomCategoryColors(config.settings.category_colors);
		}
	}, [config]);

	return null;
}
