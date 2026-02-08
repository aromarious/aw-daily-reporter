import { render, waitFor } from "@testing-library/react"
import useSWR from "swr"
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest"
import { ConfigInitializer } from "@/components/ConfigInitializer"
import { setCustomCategoryColors } from "@/lib/colors"

// Mock dependencies
vi.mock("swr")
vi.mock("@/lib/colors", () => ({
  setCustomCategoryColors: vi.fn(),
}))

describe("ConfigInitializer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Target: ConfigInitializer
   * Scenario: Config Loaded with Colors
   * Expected: Calls setCustomCategoryColors
   */
  it("test_ConfigInitializer_ConfigWithColors_CallsSetColors", async () => {
    // Arrange
    const mockConfig = {
      settings: {
        category_colors: { Category1: "#ffffff" },
      },
    }

    const useSWRMock = useSWR as unknown as Mock
    useSWRMock.mockReturnValue({
      data: mockConfig,
      error: undefined,
      isLoading: false,
    })

    // Act
    render(<ConfigInitializer />)

    // Assert
    await waitFor(() => {
      expect(setCustomCategoryColors).toHaveBeenCalledWith(
        mockConfig.settings.category_colors,
      )
    })
  })

  /**
   * Target: ConfigInitializer
   * Scenario: Config Loading or Empty
   * Expected: Does not call setCustomCategoryColors
   */
  it("test_ConfigInitializer_NoConfig_DoesNotCallSetColors", async () => {
    // Arrange
    const useSWRMock = useSWR as unknown as Mock
    useSWRMock.mockReturnValue({
      data: undefined, // Loading or error
      error: undefined,
      isLoading: true,
    })

    // Act
    render(<ConfigInitializer />)

    // Assert
    // Wait a tick to ensure useEffect would have run
    await waitFor(() => {})
    expect(setCustomCategoryColors).not.toHaveBeenCalled()
  })

  /**
   * Target: ConfigInitializer
   * Scenario: Config Loaded but missing category_colors
   * Expected: Does not call setCustomCategoryColors
   */
  it("test_ConfigInitializer_ConfigWithoutColors_DoesNotCallSetColors", async () => {
    // Arrange
    const mockConfig = {
      settings: {
        // category_colors missing
        theme: "dark",
      },
    }

    const useSWRMock = useSWR as unknown as Mock
    useSWRMock.mockReturnValue({
      data: mockConfig,
      error: undefined,
      isLoading: false,
    })

    // Act
    render(<ConfigInitializer />)

    // Assert
    await waitFor(() => {})
    expect(setCustomCategoryColors).not.toHaveBeenCalled()
  })
})
