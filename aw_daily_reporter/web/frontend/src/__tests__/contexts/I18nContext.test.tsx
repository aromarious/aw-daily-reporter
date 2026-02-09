import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { I18nProvider, useTranslation } from "@/contexts/I18nContext"

// Mock locale data
vi.mock("@/locales/ja.json", () => ({
  default: {
    Hello: "こんにちは",
  },
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
)

describe("I18nContext", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  /**
   * Target: useTranslation
   * Scenario: Used outside provider
   * Expected: Throws error
   */
  it("test_useTranslation_OutsideProvider_ThrowsError", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => renderHook(() => useTranslation())).toThrow(
      "useTranslation must be used within an I18nProvider",
    )
    consoleSpy.mockRestore()
  })

  /**
   * Target: I18nContext
   * Scenario: Default Language
   * Expected: Defaults to 'ja' if no storage
   */
  it("test_I18nContext_DefaultLanguage_IsJapanese", () => {
    const { result } = renderHook(() => useTranslation(), { wrapper })
    expect(result.current.language).toBe("ja")
  })

  /**
   * Target: I18nContext
   * Scenario: Initialize from Storage
   * Expected: Uses stored language
   */
  it("test_I18nContext_InitFromStorage_UsesStoredLanguage", () => {
    localStorage.setItem("aw-daily-reporter-lang", "en")
    const { result } = renderHook(() => useTranslation(), { wrapper })
    expect(result.current.language).toBe("en")
  })

  /**
   * Target: I18nContext
   * Scenario: Change Language
   * Expected: Updates state and storage
   */
  it("test_I18nContext_ChangeLanguage_UpdatesStateAndStorage", () => {
    const { result } = renderHook(() => useTranslation(), { wrapper })

    act(() => {
      result.current.setLanguage("en")
    })

    expect(result.current.language).toBe("en")
    expect(localStorage.getItem("aw-daily-reporter-lang")).toBe("en")
  })

  /**
   * Target: I18nContext
   * Scenario: Translate (English)
   * Expected: Returns key
   */
  it("test_I18nContext_TranslateEn_ReturnsKey", () => {
    localStorage.setItem("aw-daily-reporter-lang", "en")
    const { result } = renderHook(() => useTranslation(), { wrapper })

    expect(result.current.t("Hello")).toBe("Hello")
  })

  /**
   * Target: I18nContext
   * Scenario: Translate (Japanese)
   * Expected: Returns mapped value
   */
  it("test_I18nContext_TranslateJa_ReturnsValue", () => {
    // Default is ja
    const { result } = renderHook(() => useTranslation(), { wrapper })

    expect(result.current.t("Hello")).toBe("こんにちは")
  })

  /**
   * Target: I18nContext
   * Scenario: Translate (Japanese - Missing Key)
   * Expected: Returns key
   */
  it("test_I18nContext_TranslateJaMissingKey_ReturnsKey", () => {
    const { result } = renderHook(() => useTranslation(), { wrapper })

    expect(result.current.t("Missing")).toBe("Missing")
  })
})
