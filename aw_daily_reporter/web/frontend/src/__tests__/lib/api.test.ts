import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetcher } from "@/lib/api";

// Hoist mocks to be available in vi.mock
const mocks = vi.hoisted(() => ({
	get: vi.fn(),
	post: vi.fn(),
}));

// Mock axios
vi.mock("axios", () => {
	return {
		default: {
			create: vi.fn(() => ({
				get: mocks.get,
				post: mocks.post,
				interceptors: {
					request: { use: vi.fn(), eject: vi.fn() },
					response: { use: vi.fn(), eject: vi.fn() },
				},
			})),
		},
	};
});

describe("lib/api", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("fetcher", () => {
		/**
		 * Target: fetcher
		 * Scenario: Successful Request
		 * Expected: Returns data from response
		 */
		it("test_fetcher_Success_ReturnsData", async () => {
			// Arrange
			const mockData = { id: 1, name: "test" };
			const mockResponse = { data: mockData };
			const url = "/test/url";

			mocks.get.mockResolvedValue(mockResponse);

			// Act
			const result = await fetcher(url);

			// Assert
			expect(mocks.get).toHaveBeenCalledWith(url);
			expect(result).toEqual(mockData);
		});

		/**
		 * Target: fetcher
		 * Scenario: Failed Request
		 * Expected: Throws error
		 */
		it("test_fetcher_Failure_ThrowsError", async () => {
			// Arrange
			const mockError = new Error("Network Error");
			const url = "/test/error";

			mocks.get.mockRejectedValue(mockError);

			// Act & Assert
			await expect(fetcher(url)).rejects.toThrow("Network Error");
		});
	});
});
