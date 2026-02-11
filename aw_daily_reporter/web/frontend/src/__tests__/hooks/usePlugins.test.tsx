import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type {
  Plugin,
  PluginsApiResponse,
} from "@/app/settings/hooks/usePlugins"
import { usePlugins } from "@/app/settings/hooks/usePlugins"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("usePlugins", () => {
  const mockPlugins: Plugin[] = [
    {
      plugin_id: "processor-rule-matching",
      name: "Rule Matching",
      type: "processor",
      description: "Applies categorization rules",
      source: "Built-in",
      enabled: true,
      required_settings: ["rules"],
    },
    {
      plugin_id: "processor-project-mapping",
      name: "Project Mapping",
      type: "processor",
      description: "Maps projects to clients",
      source: "Built-in",
      enabled: true,
      required_settings: ["project_map", "client_map", "clients"],
    },
    {
      plugin_id: "processor-afk",
      name: "AFK Processor",
      type: "processor",
      description: "Processes AFK time",
      source: "Built-in",
      enabled: false,
      required_settings: ["apps"],
    },
  ]

  const mockApiResponse: PluginsApiResponse = {
    plugins: mockPlugins,
    active_required_settings: ["rules", "project_map", "client_map", "clients"],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Arrange: 新しいレスポンス形式（オブジェクト）を返すモックを設定
  it("should fetch plugins and active_required_settings from API (new format)", async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce({
      json: async () => mockApiResponse,
    })

    // Act
    const { result } = renderHook(() => usePlugins())

    // Assert
    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.plugins).toEqual(mockPlugins)
    expect(result.current.activeRequiredSettings).toEqual([
      "rules",
      "project_map",
      "client_map",
      "clients",
    ])
  })

  // Arrange: 旧形式のレスポンス（配列）を返すモックを設定
  it("should support legacy API format (array)", async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce({
      json: async () => mockPlugins,
    })

    // Act
    const { result } = renderHook(() => usePlugins())

    // Assert
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.plugins).toEqual(mockPlugins)
    expect(result.current.activeRequiredSettings).toEqual([])
  })

  // Arrange: 有効なプラグインと無効なプラグインを含むモックを設定
  it("should correctly check if a plugin is enabled", async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce({
      json: async () => mockApiResponse,
    })

    // Act
    const { result } = renderHook(() => usePlugins())

    // Assert
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // 有効なプラグイン
    expect(result.current.isPluginEnabled("processor-rule-matching")).toBe(true)
    expect(result.current.isPluginEnabled("processor-project-mapping")).toBe(
      true,
    )

    // 無効なプラグイン
    expect(result.current.isPluginEnabled("processor-afk")).toBe(false)

    // 存在しないプラグイン
    expect(result.current.isPluginEnabled("non-existent")).toBe(false)
  })

  // Arrange: active_required_settings を含むモックを設定
  it("should correctly check if a setting is required", async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce({
      json: async () => mockApiResponse,
    })

    // Act
    const { result } = renderHook(() => usePlugins())

    // Assert
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // 必要な設定キー
    expect(result.current.isSettingRequired("rules")).toBe(true)
    expect(result.current.isSettingRequired("project_map")).toBe(true)
    expect(result.current.isSettingRequired("client_map")).toBe(true)
    expect(result.current.isSettingRequired("clients")).toBe(true)

    // 必要でない設定キー（無効なプラグインのもの）
    expect(result.current.isSettingRequired("apps")).toBe(false)

    // 存在しない設定キー
    expect(result.current.isSettingRequired("non-existent")).toBe(false)
  })

  // Arrange: エラーを返すモックを設定
  it("should handle fetch errors gracefully", async () => {
    // Arrange
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})
    mockFetch.mockRejectedValueOnce(new Error("Network error"))

    // Act
    const { result } = renderHook(() => usePlugins())

    // Assert
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.plugins).toEqual([])
    expect(result.current.activeRequiredSettings).toEqual([])
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to fetch plugins:",
      expect.any(Error),
    )

    consoleErrorSpy.mockRestore()
  })
})
