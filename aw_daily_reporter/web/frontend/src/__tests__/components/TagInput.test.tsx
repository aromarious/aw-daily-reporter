import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import TagInput from "@/components/rules/TagInput"

describe("TagInput", () => {
  /**
   * Target: TagInput
   * Scenario: Render with existing tags
   * Expected: Displays all tags and input
   */
  it("test_TagInput_RenderWithTags_DisplaysTags", () => {
    // Arrange
    const tags = ["tag1", "tag2"]
    const onChange = vi.fn()

    // Act
    render(<TagInput tags={tags} onChange={onChange} />)

    // Assert
    expect(screen.getByText("tag1")).toBeInTheDocument()
    expect(screen.getByText("tag2")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Add a tag...")).toBeInTheDocument()
  })

  /**
   * Target: TagInput
   * Scenario: Render empty
   * Expected: Displays "No items defined" message
   */
  it("test_TagInput_RenderEmpty_DisplaysNoItemsMessage", () => {
    // Arrange
    const tags: string[] = []
    const onChange = vi.fn()

    // Act
    render(<TagInput tags={tags} onChange={onChange} />)

    // Assert
    expect(screen.getByText("No items defined")).toBeInTheDocument()
  })

  /**
   * Target: TagInput
   * Scenario: Add Tag via Enter
   * Expected: Calls onChange with new tag
   */
  it("test_TagInput_AddTagEnter_CallsOnChange", async () => {
    // Arrange
    const tags = ["tag1"]
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<TagInput tags={tags} onChange={onChange} />)
    const input = screen.getByPlaceholderText("Add a tag...")

    // Act
    await user.type(input, "newTag{enter}")

    // Assert
    expect(onChange).toHaveBeenCalledWith(["tag1", "newTag"])
    // Note: Since it's a controlled component for 'tags', the UI won't update successfully in this unit test
    // unless we re-render with new props, but checking the callback is sufficient for logic testing.
    // The internal input state should be cleared, we can check that if we want, but checking the callback is most important.
    expect(input).toHaveValue("")
  })

  /**
   * Target: TagInput
   * Scenario: Add Tag via Button
   * Expected: Calls onChange with new tag
   */
  it("test_TagInput_AddTagButton_CallsOnChange", async () => {
    // Arrange
    const tags = ["tag1"]
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<TagInput tags={tags} onChange={onChange} />)
    const input = screen.getByPlaceholderText("Add a tag...")
    // The button has a Plus icon, usually we find by role or nearby identifier.
    // Component structure: <input /> <button><Plus /></button>
    // We can find button by role 'button' that is NOT the remove button.
    // Or cleaner: check the rendered HTML structure in main file.
    // It has a generic styling. Let's rely on finding the button next to input.
    // Actually, since there are remove buttons, specific identification is safer.
    // The add button is the first button in the document order (top input area), or we can look for the Plus icon if we mocked lucide.
    // But simpler: screen.getAllByRole('button')[0] is risky.
    // Let's rely on the container structure or add a test id if needed.
    // Looking at code: The add button is adjacent to input.
    // Let's use `screen.getByRole('button', { name: '' })` might be empty as it only contains an icon.
    // Let's try finding the button that contains the SVG provided by Lucide.
    // Or just clicking the first button since remove buttons are in the list below.

    // Act
    await user.type(input, "newTag")
    // Using fireEvent for simplicity on the button click if query is hard, but userEvent is better.
    // The add button is actually distinct because it's not inside the tags list.
    // We can use a test-id in the component, but let's try to avoid changing code if possible.
    // The valid tags have buttons inside them. The add button is outside.
    // Let's construct a query.

    // Since we can't easily select by text (icon only), let's assume it's the first button.
    const buttons = screen.getAllByRole("button")
    const addButton = buttons[0] // Valid assumption given the DOM order in TagInput.tsx

    await user.click(addButton)

    // Assert
    expect(onChange).toHaveBeenCalledWith(["tag1", "newTag"])
    expect(input).toHaveValue("")
  })

  /**
   * Target: TagInput
   * Scenario: Validation (Empty)
   * Expected: Does not call onChange
   */
  it("test_TagInput_AddEmpty_DoesNotCallOnChange", async () => {
    // Arrange
    const tags = ["tag1"]
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<TagInput tags={tags} onChange={onChange} />)
    const input = screen.getByPlaceholderText("Add a tag...")

    // Act
    await user.type(input, "   {enter}") // Whitespace only

    // Assert
    expect(onChange).not.toHaveBeenCalled()
  })

  /**
   * Target: TagInput
   * Scenario: Validation (Duplicate)
   * Expected: Does not call onChange
   */
  it("test_TagInput_AddDuplicate_DoesNotCallOnChange", async () => {
    // Arrange
    const tags = ["tag1"]
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<TagInput tags={tags} onChange={onChange} />)
    const input = screen.getByPlaceholderText("Add a tag...")

    // Act
    await user.type(input, "tag1{enter}")

    // Assert
    expect(onChange).not.toHaveBeenCalled()
  })

  /**
   * Target: TagInput
   * Scenario: Remove Tag
   * Expected: Calls onChange with tag removed
   */
  it("test_TagInput_RemoveTag_CallsOnChange", async () => {
    // Arrange
    const tags = ["tag1", "tag2"]
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<TagInput tags={tags} onChange={onChange} />)

    // Act
    // Find the removal button for 'tag1'.
    // The tag is rendered as: <span>tag1 <button><X/></button></span>
    // We can find the tag text, then find the button within it.
    const _tag1 = screen.getByText("tag1")
    // The button is a sibling or child. In TagInput.tsx:
    // <span ...> {tag} <button ...>...</span>
    // So the button is a child of the span that contains 'tag1'.
    // However getByText('tag1') might match the text node.
    // Let's find the button within the container of that text.
    // Testing library `within` is useful here.
    // But actually, the structure is `span > [text node "tag1", button]`.
    // We can click the button directly if we can identify it.
    // Since we have multiple remove buttons, using getAllByRole('button') is ambiguous.
    // Best way: check hierarchy.

    // Workaround: The button is the NEXT sibling of the text node "tag1" effectively?
    // Let's use closest/container or simple index if we know order.
    // 'tag1' is first, 'tag2' is second.
    // Buttons: [Add, Remove(tag1), Remove(tag2)]
    const buttons = screen.getAllByRole("button")
    // index 1 should be remove tag1
    const removeTag1Button = buttons[1]

    await user.click(removeTag1Button)

    // Assert
    expect(onChange).toHaveBeenCalledWith(["tag2"])
  })
})
