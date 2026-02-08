---
trigger: glob
globs: *.ts, *.tsx
---

# TypeScript/React Project Rules

## Framework & Structure
- **Next.js**: Use Next.js App Router structure.
- **Component Location**: Place components in `src/app` (pages/layouts) or `src/components` (reusable UI).

## Styling
- **Tailwind CSS + DaisyUI**: Use utility classes and DaisyUI components.
- **Semantics**: Prefer semantic class names (e.g., `btn btn-primary`) over long chains of raw utility classes when possible.

## User Notifications
- **Toasts**: Use Toast notifications for all user-facing messages.
- **Appropriate Levels**: Ensure the correct severity level (info, success, warning, error) is used for each message.

## Console Output
- **No Console Logs**: Remove `console.log` before committing code.
- **Error Handling**: Use `console.error` only for actionable runtime errors that cannot be handled by UI notifications (Toasts).

## Strict Mode
- **No Implicit Any**: Ensure all variables and function parameters have explicit types. Avoid `any` unless absolutely necessary.

## Internationalization (i18n)
- **Use `useTranslation`**: Import `useTranslation` from `@/contexts/I18nContext`.
- **Wrap Strings**: Wrap all user-facing strings in `t('English Text')`. Use the English text as the key.
- **Add Translations**: When adding new strings, you MUST add the Japanese translation to `src/locales/ja.json`.

## General
- **Language**: All comments and documentation must be in Japanese.
