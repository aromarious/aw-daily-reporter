import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROJECT_ROOT = path.resolve(__dirname, "../../")
const COMPONENTS_DIR = path.join(PROJECT_ROOT, "src/components")
const SRC_DIR = path.join(PROJECT_ROOT, "src")

// Configuration
const STATE_HOOK_LIMIT = 5

// Helpers
function getFiles(dir, ext = []) {
  let files = []
  const items = fs.readdirSync(dir, { withFileTypes: true })
  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory()) {
      files = [...files, ...getFiles(fullPath, ext)]
    } else {
      if (ext.length === 0 || ext.some((e) => item.name.endsWith(e))) {
        files.push(fullPath)
      }
    }
  }
  return files
}

function countImports(targetFile, allFiles) {
  const targetName = path.basename(targetFile, path.extname(targetFile))
  // Simple regex to match import of component name
  // Note: This is an approximation. It might match similarly named things.
  // Ideally use AST, but regex is faster for a quick audit script.
  const importRegex = new RegExp(`from\\s+['"].*${targetName}['"]`, "g")
  const namedImportRegex = new RegExp(
    `import\\s+{.*\\b${targetName}\\b.*}\\s+from`,
    "g",
  )

  let count = 0
  for (const file of allFiles) {
    if (file === targetFile) continue

    const content = fs.readFileSync(file, "utf-8")
    if (importRegex.test(content) || namedImportRegex.test(content)) {
      count++
    }
  }
  return count
}

function checkStateUsage(file) {
  const content = fs.readFileSync(file, "utf-8")
  const stateHooks = (content.match(/\b(useState|useReducer)\b/g) || []).length
  return stateHooks
}

async function main() {
  console.log("🔍 Starting React Rules Audit...\n")

  const allSrcFiles = getFiles(SRC_DIR, [".tsx", ".ts"])
  const componentFiles = fs.existsSync(COMPONENTS_DIR)
    ? getFiles(COMPONENTS_DIR, [".tsx"])
    : []

  let issues = 0

  // 1. Check for Premature Abstraction (YAGNI)
  console.log(
    "--- Checking for Premature Abstraction (Single-use Shared Components) ---",
  )
  if (componentFiles.length > 0) {
    for (const file of componentFiles) {
      // Skip index.ts files or similar if necessary, but component files usually are Named.tsx or index.tsx inside a folder
      const usageCount = countImports(file, allSrcFiles)
      if (usageCount <= 1) {
        // Check if it is a directory-based component (index.tsx)
        if (path.basename(file) === "index.tsx") {
          // Check parent dir name
          const _parentDir = path.dirname(file)
          // Re-check import usage for parent dir name?
          // Simplified: just warn for now if it seems unused.
        }

        // Only warn if strictly 1 usage (which is likely the import in the consuming page)
        // If 0, it's dead code.
        if (usageCount === 1) {
          console.warn(
            `⚠️  [YAGNI] ${path.relative(PROJECT_ROOT, file)} is used only once.`,
          )
          console.warn(
            `    Suggestion: Move this component to the directory of the page where it is used (Colocation).\n`,
          )
          issues++
        }
      }
    }
  } else {
    console.log("No shared component directory found or empty.")
  }

  // 2. Check for State Overload
  console.log("\n--- Checking for State Overload (>5 hooks) ---")
  for (const file of allSrcFiles) {
    const hooksCount = checkStateUsage(file)
    if (hooksCount > STATE_HOOK_LIMIT) {
      console.warn(
        `⚠️  [STATE] ${path.relative(PROJECT_ROOT, file)} has ${hooksCount} state hooks.`,
      )
      console.warn(
        `    Suggestion: Split this component or extract logic to a custom hook.\n`,
      )
      issues++
    }
  }

  // 3. Check for File Length (Heuristic for Component Length)
  console.log("\n--- Checking for File Length (Heuristic) ---")
  const FILE_LENGTH_LIMIT = 300 // If file > 300 lines, likely too big
  for (const file of allSrcFiles) {
    const content = fs.readFileSync(file, "utf-8")
    const lines = content.split("\n").length
    if (lines > FILE_LENGTH_LIMIT) {
      console.warn(
        `⚠️  [SIZE] ${path.relative(PROJECT_ROOT, file)} is ${lines} lines long.`,
      )
      console.warn(
        `    Rule: "Component should be around 150 lines." (File length > 300 suggests complex component or too many components)\n`,
      )
      issues++
    }
  }

  if (issues === 0) {
    console.log("\n✅ No custom rule violations found.")
  } else {
    console.log(`\nfound ${issues} issues.`)
    // Exit with code 1 if issues found, so CI fails
    process.exit(1)
  }
}

main().catch(console.error)
