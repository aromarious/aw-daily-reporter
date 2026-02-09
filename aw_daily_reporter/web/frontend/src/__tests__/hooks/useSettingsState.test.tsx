import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useSettingsState } from "@/hooks/useSettingsState"

// Mock dependencies
const mockShowToast = vi.fn()
vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

const mockSetLanguage = vi.fn()
vi.mock("@/contexts/I18nContext", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    setLanguage: mockSetLanguage,
  }),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock SWR
const mockMutate = vi.fn()
vi.mock("swr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("swr")>()
  return {
    ...actual,
    mutate: (...args: any[]) => mockMutate(...args),
    default: vi.fn(),
  }
})

import useSWR from "swr"

describe("useSettingsState", () => {
  const mockConfig = {
    system: { language: "en" },
    rules: [{ keyword: "test", category: "Test", project: "TestProj" }],
    project_map: { "Old Project": "New Project" },
    client_map: { "New Project": "Client A" },
    settings: {
      project_extraction_patterns: ["^test"],
      category_list: ["Category A"],
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useSWR as any).mockReturnValue({
      data: mockConfig,
      error: undefined,
      isLoading: false,
    })
  })

  it("initializes state from config", async () => {
    const { result } = renderHook(() => useSettingsState())

    expect(result.current.localRules).toEqual(mockConfig.rules)
    expect(result.current.localProjectMap).toEqual(mockConfig.project_map)
    expect(result.current.localClientMap).toEqual(mockConfig.client_map)
    expect(result.current.localExtractionPatterns).toEqual(
      mockConfig.settings.project_extraction_patterns,
    )
    expect(result.current.localCategoryList).toEqual(
      mockConfig.settings.category_list,
    )
  })

  it("updates local state", () => {
    const { result } = renderHook(() => useSettingsState())

    const newRules = [
      { keyword: "new", category: "New", project: "NewProj", app: "App" },
    ]
    act(() => {
      result.current.setLocalRules(newRules)
    })
    expect(result.current.localRules).toEqual(newRules)
  })

  it("syncs language from config", () => {
    renderHook(() => useSettingsState())
    expect(mockSetLanguage).toHaveBeenCalledWith("en")
  })

  it("handles save success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    const { result } = renderHook(() => useSettingsState())

    const newConfig = { ...mockConfig, system: { language: "ja" } }

    await act(async () => {
      const success = await result.current.handleSaveConfig(
        newConfig as any,
        true,
        true,
      ) // immediate=true
      expect(success).toBe(true)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(newConfig),
      }),
    )
    expect(mockMutate).toHaveBeenCalledWith("/api/settings")
    expect(mockShowToast).toHaveBeenCalledWith("Configuration saved!")
  })

  it("handles save failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"))
    const { result } = renderHook(() => useSettingsState())

    await act(async () => {
      const success = await result.current.handleSaveConfig(
        mockConfig as any,
        true,
        true,
      )
      expect(success).toBe(false)
    })

    expect(mockShowToast).toHaveBeenCalledWith(
      "Failed to save settings",
      "error",
    )
  })

  it("saves local state when no config passed", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    const { result } = renderHook(() => useSettingsState())

    // Update local state
    const newRules = [{ keyword: "updated", category: "Up", project: "Up" }]
    act(() => {
      result.current.setLocalRules(newRules)
    })

    await act(async () => {
      await result.current.handleSaveConfig(null, false, true)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({
        body: expect.stringContaining('"keyword":"updated"'),
      }),
    )
  })
})
