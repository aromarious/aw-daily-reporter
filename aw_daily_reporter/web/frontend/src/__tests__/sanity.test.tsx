import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

describe("Environment Sanity", () => {
  /**
   * Target: Environment
   * Scenario: Simple HTML Rendering
   * Expected: Heading is visible
   */
  it("test_Environment_RenderSimpleHTML_HeadingIsVisible", () => {
    // Arrange
    const testMessage = "Hello Vitest"
    const content = <h1>{testMessage}</h1>

    // Act
    render(content)

    // Assert
    const heading = screen.getByRole("heading", { level: 1, name: testMessage })
    expect(heading).toBeInTheDocument()
  })
})
