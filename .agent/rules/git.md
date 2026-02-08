---
trigger: model_decision
description: git operation rules
---

# Git Workflow Rules

This project follows the Gitflow workflow. Please adhere to the rules defined in [docs/git.md](../docs/git.md).

## Key Points

- **Branches**:
  - `main`: Production code (only from releases).
  - `develop`: Development code (Target for feature PRs).
  - `feature/*`: New features (Source for PRs to `develop`).
  - `release/*`: Release preparation.
  - `hotfix/*`: Urgent fixes on production.

- **Commits**: Use Conventional Commits (`feat`, `fix`, `docs`, etc.).
  - `wip` is allowed in `feature/*` but must be squashed before merge.
- **Husky**: Pre-commit hooks enforce commit message format.

Review the full documentation at `docs/git.md` before making repository changes.
