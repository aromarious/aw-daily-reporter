import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import RuleModal from "@/components/rules/RuleModal"

// Mock useTranslation
vi.mock("@/contexts/I18nContext", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe("RuleModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    initialRule: null,
  }

  /**
   * Target: RuleModal
   * Scenario: Render Closed
   * Expected: Does not render anything
   */
  it("test_RuleModal_RenderClosed_ReturnsNull", () => {
    render(<RuleModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText("Add New Rule")).not.toBeInTheDocument()
  })

  /**
   * Target: RuleModal
   * Scenario: Render Open (New Rule)
   * Expected: Renders form with empty/default values
   */
  it("test_RuleModal_RenderOpen_DisplaysForm", () => {
    render(<RuleModal {...defaultProps} />)
    expect(screen.getByText("Add New Rule")).toBeInTheDocument()
    expect(screen.getByText("Match Conditions")).toBeInTheDocument()
    // Check for "Save Rule" button
    expect(
      screen.getByRole("button", { name: "Save Rule" }),
    ).toBeInTheDocument()
  })

  /**
   * Target: RuleModal
   * Scenario: Enter Keyword
   * Expected: Adds keyword to list
   */
  it("test_RuleModal_AddKeyword_AddsToList", async () => {
    const user = userEvent.setup()
    render(<RuleModal {...defaultProps} />)

    const input = screen.getByPlaceholderText("Regex pattern...")
    // Removed unused button selection to avoid "multiple elements" error
    // We are using {enter} to submit in this test
    // const addButton = screen.getByRole('button', { name: '' })

    await user.type(input, "test-pattern{enter}")

    expect(screen.getByText("test-pattern")).toBeInTheDocument()
    expect(input).toHaveValue("")
  })

  /**
   * Target: RuleModal
   * Scenario: Invalid Keyword
   * Expected: Shows error and does not add
   */
  it("test_RuleModal_InvalidKeyword_ShowsError", async () => {
    const user = userEvent.setup()
    render(<RuleModal {...defaultProps} />)

    const input = screen.getByPlaceholderText("Regex pattern...")

    // Invalid regex: single backslash or open parenthesis without close
    // user-event treats [ as start of special key, so we must escape it as [[
    await user.type(input, "[[")

    expect(screen.getByText("Invalid regex pattern")).toBeInTheDocument()

    // Try to enter
    await user.type(input, "{enter}")

    // Should not be added
    expect(
      screen.queryByText("[", { selector: "span" }),
    ).not.toBeInTheDocument()
    // The input should still have the value
    expect(input).toHaveValue("[")
  })

  /**
   * Target: RuleModal
   * Scenario: Submit Form
   * Expected: Calls onSave with correct data
   */
  it("test_RuleModal_SubmitForm_CallsOnSave", async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<RuleModal {...defaultProps} onSave={onSave} />)

    // Add a keyword
    const keywordInput = screen.getByPlaceholderText("Regex pattern...")
    await user.type(keywordInput, "my-keyword{enter}")

    // Fill other fields
    // Target defaults to 'title'
    // App Filter
    const appInput = screen.getByPlaceholderText("(Optional)")
    await user.type(appInput, "Chrome")

    // Project
    const projectInput = screen.getByPlaceholderText("e.g., Project A")
    await user.type(projectInput, "Work")

    // Category (Combobox)
    const categoryInput = screen.getByPlaceholderText(
      "Select or create category",
    )
    await user.type(categoryInput, "Dev")

    // Submit
    const saveButton = screen.getByRole("button", { name: "Save Rule" })
    await user.click(saveButton)

    expect(onSave).toHaveBeenCalledWith({
      keyword: ["my-keyword"],
      app: "Chrome",
      project: "Work",
      category: "Dev",
      target: "title",
    })
  })

  /**
   * Target: RuleModal
   * Scenario: Submit without Keywords
   * Expected: Button is disabled and shows tooltip
   */
  it("test_RuleModal_SubmitNoKeywords_ButtonDisabled", () => {
    const onSave = vi.fn()
    render(<RuleModal {...defaultProps} onSave={onSave} />)

    const saveButton = screen.getByRole("button", { name: "Save Rule" })
    expect(saveButton).toBeDisabled()
    expect(saveButton).toHaveAttribute(
      "title",
      "Please add at least one keyword",
    )
  })

  /**
   * Target: RuleModal
   * Scenario: Edit Existing Rule
   * Expected: Populates form with existing data
   */
  it("test_RuleModal_EditRule_PopulatesForm", () => {
    const initialRule = {
      keyword: ["existing"],
      category: "Old Cat",
      project: "Old Proj",
      target: "url",
      app: "Old App",
    }
    render(<RuleModal {...defaultProps} initialRule={initialRule} />)

    expect(screen.getByText("existing")).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText("Select or create category"),
    ).toHaveValue("Old Cat")
    expect(screen.getByPlaceholderText("e.g., Project A")).toHaveValue(
      "Old Proj",
    )
    expect(screen.getByPlaceholderText("(Optional)")).toHaveValue("Old App")
    // Target select is harder to query by display value, but we can check value
    // Assuming we can find the select by label or id.
    // It has id="target-select" in the code.
    // However, react-testing-library encourages strict access.
    // Let's rely on label if possible. Label is 'Target'.
    expect(screen.getByLabelText("Target")).toHaveValue("url")
  })
})
