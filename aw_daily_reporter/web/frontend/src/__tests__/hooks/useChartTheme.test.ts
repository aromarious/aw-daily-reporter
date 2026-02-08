import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChartTheme } from "@/hooks/useChartTheme";

// Mock next-themes
const mockSetTheme = vi.fn();
let mockTheme = "light";
let mockSystemTheme = "light";

vi.mock("next-themes", () => ({
	useTheme: () => ({
		theme: mockTheme,
		systemTheme: mockSystemTheme,
		setTheme: mockSetTheme,
	}),
}));

describe("useChartTheme", () => {
	beforeEach(() => {
		mockTheme = "light";
		mockSystemTheme = "light";
		vi.clearAllMocks();
	});

	/**
	 * Target: useChartTheme
	 * Scenario: Initial Render (Light Mode)
	 * Expected: Returns light theme configuration (isDark: false)
	 */
	it("test_useChartTheme_LightMode_ReturnsLightConfig", async () => {
		// Arrange
		mockTheme = "light";

		// Act
		const { result } = renderHook(() => useChartTheme());

		// Assert
		// Initially validation might fail if mounted logic delays it, but hook sets mounted=true in useEffect
		await waitFor(() => {
			expect(result.current.isDark).toBe(false);
			expect(result.current.backgroundColor).toBe("transparent");
			expect(result.current.textColor).toBe("#334155"); // slate-700
		});
	});

	/**
	 * Target: useChartTheme
	 * Scenario: Dark Mode
	 * Expected: Returns dark theme configuration (isDark: true)
	 */
	it("test_useChartTheme_DarkMode_ReturnsDarkConfig", async () => {
		// Arrange
		mockTheme = "dark";

		// Act
		const { result } = renderHook(() => useChartTheme());

		// Assert
		await waitFor(() => {
			expect(result.current.isDark).toBe(true);
			expect(result.current.textColor).toBe("#cbd5e1"); // slate-300
		});
	});

	/**
	 * Target: useChartTheme
	 * Scenario: System Mode (Dark)
	 * Expected: Returns dark theme configuration
	 */
	it("test_useChartTheme_SystemDark_ReturnsDarkConfig", async () => {
		// Arrange
		mockTheme = "system";
		mockSystemTheme = "dark";

		// Act
		const { result } = renderHook(() => useChartTheme());

		// Assert
		await waitFor(() => {
			expect(result.current.isDark).toBe(true);
		});
	});
});
