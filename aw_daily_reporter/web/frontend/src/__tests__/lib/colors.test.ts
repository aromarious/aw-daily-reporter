import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  CATEGORY_COLORS,
  getCategoryColor,
  getColorByName,
  getProjectColor,
  isUncategorized,
  loadConstants,
  PROJECT_COLORS,
  resetConstantsLoaded,
  setCustomCategoryColors,
  UNCATEGORIZED_COLOR,
} from "@/lib/colors"

// Mock fetch for loadConstants
global.fetch = vi.fn()

describe("lib/colors", () => {
  describe("isUncategorized", () => {
    /**
     * Target: isUncategorized
     * Scenario: Null or Undefined check (Boundary: Off/Invalid)
     * Expected: Returns true
     */
    it("test_isUncategorized_NullOrUndefined_ReturnsTrue", () => {
      // Arrange
      const inputNull = null
      const inputUndefined = undefined

      // Act
      const resultNull = isUncategorized(inputNull)
      const resultUndefined = isUncategorized(inputUndefined)

      // Assert
      expect(resultNull).toBe(true)
      expect(resultUndefined).toBe(true)
    })

    /**
     * Target: isUncategorized
     * Scenario: Empty string (Boundary: On/Edge)
     * Expected: Returns true
     */
    it("test_isUncategorized_EmptyString_ReturnsTrue", () => {
      // Arrange
      const input = ""

      // Act
      const result = isUncategorized(input)

      // Assert
      expect(result).toBe(true)
    })

    /**
     * Target: isUncategorized
     * Scenario: Known uncategorized keywords (Equivalence: Valid)
     * Expected: Returns true
     */
    it("test_isUncategorized_KnownKeywords_ReturnsTrue", () => {
      // Arrange
      const keywords = [
        "unknown",
        "uncategorized",
        "unclassified",
        "other",
        "未分類",
      ]

      // Act & Assert
      keywords.forEach((keyword) => {
        expect(isUncategorized(keyword)).toBe(true)
        expect(isUncategorized(keyword.toUpperCase())).toBe(true) // Case insensitive
      })
    })

    /**
     * Target: isUncategorized
     * Scenario: Normal category name (Equivalence: Invalid for Uncategorized)
     * Expected: Returns false
     */
    it("test_isUncategorized_NormalCategory_ReturnsFalse", () => {
      // Arrange
      const input = "Development"

      // Act
      const result = isUncategorized(input)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe("getColorByName", () => {
    /**
     * Target: getColorByName
     * Scenario: Same name produces same color (Determinism)
     * Expected: Returns identical color string
     */
    it("test_getColorByName_SameInput_ReturnsSameColor", () => {
      // Arrange
      const name = "ProjectA"
      const palette = ["#000000", "#ffffff"]

      // Act
      const color1 = getColorByName(name, palette)
      const color2 = getColorByName(name, palette)

      // Assert
      expect(color1).toBe(color2)
      expect(palette).toContain(color1)
    })
  })

  describe("getCategoryColor", () => {
    beforeEach(() => {
      setCustomCategoryColors({})
    })

    /**
     * Target: getCategoryColor
     * Scenario: Uncategorized category
     * Expected: Returns UNCATEGORIZED_COLOR
     */
    it("test_getCategoryColor_Uncategorized_ReturnsGray", () => {
      // Arrange
      const category = "unknown"

      // Act
      const color = getCategoryColor(category)

      // Assert
      expect(color).toBe(UNCATEGORIZED_COLOR)
    })

    /**
     * Target: getCategoryColor
     * Scenario: Custom color defined
     * Expected: Returns custom color
     */
    it("test_getCategoryColor_CustomColorDefined_ReturnsCustomColor", () => {
      // Arrange
      const category = "Work"
      setCustomCategoryColors({ Work: "#ff0000" })

      // Act
      const color = getCategoryColor(category)

      // Assert
      expect(color).toBe("#ff0000")
    })

    /**
     * Target: getCategoryColor
     * Scenario: Normal category, no custom color
     * Expected: Returns hash-based color from CATEGORY_COLORS
     */
    it("test_getCategoryColor_NormalCategory_ReturnsHashedColor", () => {
      // Arrange
      const category = "Development"

      // Act
      const color = getCategoryColor(category)

      // Assert
      expect(CATEGORY_COLORS).toContain(color)
    })
  })

  describe("getProjectColor", () => {
    /**
     * Target: getProjectColor
     * Scenario: Uncategorized project
     * Expected: Returns UNCATEGORIZED_COLOR
     */
    it("test_getProjectColor_Uncategorized_ReturnsGray", () => {
      // Arrange
      const project = "unknown"

      // Act
      const color = getProjectColor(project)

      // Assert
      expect(color).toBe(UNCATEGORIZED_COLOR)
    })

    /**
     * Target: getProjectColor
     * Scenario: Normal project
     * Expected: Returns hash-based color from PROJECT_COLORS
     */
    it("test_getProjectColor_NormalProject_ReturnsHashedColor", () => {
      // Arrange
      const project = "Project X"

      // Act
      const color = getProjectColor(project)

      // Assert
      expect(PROJECT_COLORS).toContain(color)
    })
  })

  describe("loadConstants", () => {
    beforeEach(() => {
      resetConstantsLoaded()
    })

    /**
     * Target: loadConstants
     * Scenario: API returns keywords
     * Expected: uncategorizedKeywords is updated (verified via isUncategorized)
     */
    it("test_loadConstants_ApiSuccess_UpdatesKeywords", async () => {
      // Arrange
      const mockKeywords = ["custom-ignore"]
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ uncategorized_keywords: mockKeywords }),
      })

      // Act
      await loadConstants()

      // Assert
      expect(isUncategorized("custom-ignore")).toBe(true)
    })

    /**
     * Target: loadConstants
     * Scenario: API failure
     * Expected: Graceful failure, console warn called
     */
    it("test_loadConstants_ApiFailure_LogsWarning", async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"))

      // Act
      await loadConstants()

      // Assert
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
