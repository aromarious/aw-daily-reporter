import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ToastProvider, useToast } from "@/contexts/ToastContext"

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
)

describe("ToastContext", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Target: useToast
   * Scenario: Used outside provider
   * Expected: Throws error
   */
  it("test_useToast_OutsideProvider_ThrowsError", () => {
    // Assert
    // React's error boundary might catch this in console, but renderHook catches exceptions.
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    expect(() => renderHook(() => useToast())).toThrow(
      "useToast must be used within a ToastProvider",
    )

    consoleSpy.mockRestore()
  })

  /**
   * Target: ToastContext
   * Scenario: Show Toast
   * Expected: Adds toast to state
   */
  it("test_ToastContext_ShowToast_AddsToast", () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.showToast("Test Message", "success")
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe("Test Message")
    expect(result.current.toasts[0].type).toBe("success")
  })

  /**
   * Target: ToastContext
   * Scenario: Remove Toast
   * Expected: Removes toast from state
   */
  it("test_ToastContext_RemoveToast_RemovesToast", () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.showToast("Test Message")
    })

    const id = result.current.toasts[0].id

    act(() => {
      result.current.removeToast(id)
    })

    expect(result.current.toasts).toHaveLength(0)
  })

  /**
   * Target: ToastContext
   * Scenario: Auto Dismiss
   * Expected: Removes toast after timeout
   */
  it("test_ToastContext_AutoDismiss_RemovesToastAfterTimeout", async () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.showToast("Test Message")
    })

    expect(result.current.toasts).toHaveLength(1)

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(5500)
    })

    // State update needs to be processed
    expect(result.current.toasts).toHaveLength(0)
  })
})
