# Implementation Plan: To-Do Life Dashboard

## Overview

Build a single-page daily dashboard in three static files (`index.html`, `css/style.css`, `js/app.js`). Each coding step is self-contained and integrates into the growing codebase. The order follows the module organisation defined in the design: scaffolding → StorageService → GreetingModule → TimerModule → TaskModule → QuickLinksModule → ThemeModule → SettingsModule → wiring and styling.

## Tasks

- [x] 1. Scaffold static file structure
  - Create `index.html` with standard HTML5 boilerplate; link `css/style.css` in `<head>` and `js/app.js` at the end of `<body>` as a classic `<script>` tag.
  - Create `css/style.css` as an empty plain-CSS file.
  - Create `js/app.js` with a top-level `DOMContentLoaded` listener that calls a placeholder `init()` function.
  - _Requirements: 8.1, 8.2, 8.3, 8.6_

- [x] 2. Implement StorageService
  - [x] 2.1 Write `StorageService` object in `app.js` with `get(key)`, `set(key, value)`, and `remove(key)` methods
    - `get` calls `JSON.parse(localStorage.getItem(key))`; returns `null` on any error.
    - `set` calls `JSON.stringify` then `localStorage.setItem`; returns `true` on success, `false` if an exception is thrown.
    - `remove` calls `localStorage.removeItem(key)`; silently swallows errors.
    - Use the storage keys table from the design: `tdl_displayName`, `tdl_pomoDuration`, `tdl_tasks`, `tdl_links`, `tdl_theme`.
    - _Requirements: 2.4, 2.5, 4.4, 5.10, 6.6, 7.2, 8.4_

  - [ ]* 2.2 Write unit tests for `StorageService`
    - Test `get` returns `null` when key is absent.
    - Test `set` / `get` round-trip for string, number, and array values.
    - Test `set` returns `false` when `localStorage.setItem` throws (mock `localStorage`).
    - _Requirements: 2.4, 2.5, 8.4_

- [x] 3. Implement GreetingModule
  - [ ] 3.1 Write `computeGreetingText(hour)` pure function
    - Returns "Good Morning" for hours 5–11, "Good Afternoon" for 12–17, "Good Evening" for 18–20, "Good Night" for 21–23 and 0–4.
    - _Requirements: 1.4, 1.5, 1.6, 1.7_

  - [ ]* 3.2 Write property test for `computeGreetingText` — Property 1
    - **Property 1: Greeting text covers all hours**
    - Use `fc.integer({ min: 0, max: 23 })` to generate hours; assert result is one of the four valid strings and all 24 hours are covered without overlap.
    - **Validates: Requirements 1.4, 1.5, 1.6, 1.7**

  - [x] 3.3 Add greeting markup to `index.html` and implement `GreetingModule.init()`, `updateTime()`, `updateDate()`, and `render(displayName)`
    - Add `<section id="greeting">` with child elements `#greeting-time`, `#greeting-date`, `#greeting-text`.
    - `init()` caches DOM references, reads `tdl_displayName` from `StorageService`, calls `updateTime()`, `updateDate()`, and `render()`, then starts a `setInterval` of 1 000 ms that calls `updateTime()`.
    - `updateTime()` reads `new Date()`, formats HH:MM, writes to `#greeting-time`.
    - `updateDate()` formats "DayName, DD MonthName YYYY" and writes to `#greeting-date`.
    - `render(displayName)` calls `computeGreetingText` with the current hour, then composes the full greeting (with or without name suffix) and writes to `#greeting-text`.
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

  - [ ]* 3.4 Write property test for `render(displayName)` — Property 9
    - **Property 9: Display name greeting composition**
    - Use `fc.string({ minLength: 1, maxLength: 50 })` for name and `fc.integer({ min: 0, max: 23 })` for hour; assert the rendered string starts with the correct greeting and contains ", name" suffix for non-empty names, and no suffix for empty/whitespace-only names.
    - **Validates: Requirements 2.1, 2.3**

- [x] 4. Implement TimerModule
  - [ ] 4.1 Write `_formatTime(totalSeconds)` pure function
    - Converts an integer number of seconds to a "MM:SS" string (e.g., 1500 → "25:00", 59 → "00:59").
    - _Requirements: 3.1, 3.3_

  - [ ]* 4.2 Write property test for `_formatTime` — Property 2
    - **Property 2: Timer format round-trip**
    - Use `fc.integer({ min: 0, max: 7200 })`; assert `parseInt(MM) * 60 + parseInt(SS) === s` for every generated value.
    - **Validates: Requirements 3.1, 3.3, 4.1**

  - [x] 4.3 Add timer markup to `index.html` and implement `TimerModule.init()`, `start()`, `stop()`, `reset()`, `_tick()`, `_playBeep()`, and `_showCompletion()`
    - Add `<section id="timer">` with `#timer-display`, Start/Stop/Reset buttons, and a `#timer-completion` message element.
    - `init()` reads `tdl_pomoDuration` from `StorageService` (default 25, validated 1–120 int), sets remaining seconds, renders IDLE state.
    - `start()` is a no-op when state is `DONE`. Begins/resumes `setInterval` at 1 000 ms.
    - `stop()` clears the interval, retains remaining seconds, transitions to `PAUSED`.
    - `reset()` clears interval, restores remaining to current `pomoDuration`, hides completion message, transitions to `IDLE`.
    - `_tick()` decrements remaining; updates `#timer-display`; on 0 transitions to `DONE`, calls `_playBeep()` and `_showCompletion()`.
    - `_playBeep()` creates a Web Audio API `OscillatorNode`, plays for ≥ 0.5 s, silently swallows `AudioContext` errors.
    - `_showCompletion()` shows `#timer-completion` message.
    - Implement `applyNewDuration(minutes)`: if RUNNING or PAUSED, persist and show deferred-change notice; if IDLE/DONE, persist and call `reset()`.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.2, 4.5, 4.6_

  - [ ]* 4.4 Write unit tests for `TimerModule` state transitions
    - Test: `start()` when state is `DONE` does not start countdown.
    - Test: `stop()` preserves remaining seconds.
    - Test: `reset()` restores to current `pomoDuration`.
    - Test: `applyNewDuration()` defers when `RUNNING`, applies immediately when `IDLE`.
    - _Requirements: 3.4, 3.5, 3.6, 3.9, 4.2, 4.6_

- [x] 5. Implement TaskModule
  - [ ] 5.1 Write `TaskModule._validate(title)` pure function
    - Returns `{ valid: true }` for strings with `trim().length` between 1 and 200.
    - Returns `{ valid: false, error: "..." }` for empty, whitespace-only, or over-200-character titles.
    - _Requirements: 5.2, 5.5_

  - [ ]* 5.2 Write property test for `_validate` — Property 3
    - **Property 3: Task validation rejects whitespace-only and over-length titles**
    - Use `fc.oneof(fc.string().filter(s => s.trim() === ''), fc.string({ minLength: 201 }))` to generate invalid titles; assert `_validate(title).valid === false`.
    - **Validates: Requirements 5.2, 5.5**

  - [x] 5.3 Add task-list markup to `index.html` and implement `TaskModule.init()`, `addTask()`, `editTask()`, `toggleTask()`, `deleteTask()`, `_render()`, and `_createTaskElement()`
    - Add `<section id="tasks">` with an add-task `<input>`, submit button, inline validation `<span>`, and `<ul id="task-list">`.
    - `init()` loads `tdl_tasks` from `StorageService` (default `[]`), assigns to in-memory `tasks` array, calls `_render()`.
    - `addTask(title)` validates, creates a Task object (`id` via `crypto.randomUUID()` or fallback, `completed: false`, `createdAt: Date.now()`), pushes to array, persists, re-renders.
    - `editTask(id, newTitle)` validates, updates matching task's title, persists, re-renders.
    - `toggleTask(id)` flips the `completed` boolean on the matching task, persists, re-renders.
    - `deleteTask(id)` filters the task out, persists, re-renders.
    - `_render()` rebuilds `#task-list` `<ul>` contents from `tasks` array using `_createTaskElement`.
    - `_createTaskElement(task)` returns a `<li>` with a completion toggle checkbox, title span (strikethrough when `completed`), edit button, and delete button.
    - Inline edit mode: clicking edit replaces the title span with an `<input>` pre-filled with the current title, plus confirm and cancel controls.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11_

  - [ ]* 5.4 Write property test for task add/persist/restore — Property 4
    - **Property 4: Task addition persists and restores**
    - Use `fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0)`; after `addTask(title)`, assert `StorageService.get('tdl_tasks')` contains an entry with the matching title; simulate reload (re-call `init()`) and assert the task appears with `completed: false`.
    - **Validates: Requirements 5.1, 5.10, 5.11**

  - [ ]* 5.5 Write property test for completion toggle involution — Property 5
    - **Property 5: Completion toggle is an involution**
    - Use `fc.record({ id: fc.uuid(), title: fc.string(), completed: fc.boolean(), createdAt: fc.integer() })`; seed module with that task, call `toggleTask` twice, assert `completed` equals its original value.
    - **Validates: Requirements 5.7, 5.8**

- [x] 6. Checkpoint — verify core modules before continuing
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement QuickLinksModule
  - [ ] 7.1 Write `QuickLinksModule._validateLink(label, url)` pure function
    - Returns `{ valid: false }` when: label is empty or whitespace-only, label exceeds 100 characters, url does not start with `http://` or `https://`, url exceeds 2 048 characters, or either field is empty.
    - _Requirements: 6.3, 6.4_

  - [ ]* 7.2 Write property test for `_validateLink` — Property 6
    - **Property 6: Quick-link validation rejects invalid inputs**
    - Generate each invalid sub-case with `fc.oneof(...)`: bad protocol, empty label, 101-char label, 2 049-char URL, whitespace-only label; assert `_validateLink().valid === false` and that the links array remains unchanged.
    - **Validates: Requirements 6.3, 6.4**

  - [x] 7.3 Add quick-links markup to `index.html` and implement `QuickLinksModule.init()`, `addLink()`, `deleteLink()`, `_render()`, and `_createLinkElement()`
    - Add `<section id="quick-links">` with label input, URL input, add button, inline validation `<span>`, a `#quick-links-error` banner for LocalStorage errors, and a `<div id="links-container">`.
    - `init()` loads `tdl_links` from `StorageService` (default `[]`), assigns to in-memory `links` array, calls `_render()`.
    - `addLink(label, url)` validates, creates a Link object (id via `crypto.randomUUID()` fallback), pushes to array; calls `StorageService.set()`; if `set()` returns `false`, shows `#quick-links-error` banner but still updates in-memory array and re-renders.
    - `deleteLink(id)` filters out the link, persists (same error-banner logic), re-renders.
    - `_render()` rebuilds `#links-container` from `links` array.
    - `_createLinkElement(link)` returns a `<button>` that opens `link.url` in a new tab on click, plus a delete button.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 8. Implement ThemeModule
  - [ ] 8.1 Write `ThemeModule._normalise(raw)` pure function
    - Returns `"dark"` only when `raw === "dark"`, otherwise returns `"light"`.
    - _Requirements: 7.3, 7.4_

  - [ ]* 8.2 Write property test for `_normalise` — Property 7
    - **Property 7: Theme normalisation always produces a valid theme**
    - Use `fc.string()` to generate arbitrary strings; assert result is always `"light"` or `"dark"`, and any value other than `"dark"` normalises to `"light"`.
    - **Validates: Requirements 7.3, 7.4**

  - [x] 8.3 Add theme toggle markup to `index.html` and implement `ThemeModule.init()`, `toggle()`, and `_apply(theme)`
    - Add a theme toggle `<button id="theme-toggle">` in the page header.
    - `init()` reads `tdl_theme` from `StorageService`, normalises, calls `_apply()`.
    - `_apply(theme)` sets `data-theme` attribute on `<html>` and updates the visual state of `#theme-toggle` to reflect the active theme.
    - `toggle()` flips between `"light"` and `"dark"`, calls `StorageService.set('tdl_theme', newTheme)`, calls `_apply()`.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.7_

  - [ ]* 8.4 Write property test for theme toggle involution — Property 8
    - **Property 8: Theme toggle is an involution**
    - Use `fc.constantFrom("light", "dark")` as starting state; seed module, call `toggle()` twice, assert `_normalise(StorageService.get('tdl_theme'))` equals the original state.
    - **Validates: Requirements 7.1**

- [x] 9. Implement SettingsModule
  - [x] 9.1 Add settings panel markup to `index.html` and implement `SettingsModule.init()`, `open()`, `close()`, `_saveDisplayName()`, and `_savePomoDuration()`
    - Add a settings open `<button id="settings-open">` in the page header.
    - Add a `<div id="settings-panel">` overlay containing: Display Name `<input>` with inline error `<span>`, Pomodoro Duration `<input>` with inline error `<span>` and deferred-change notice `<span>`, save and close buttons.
    - `init()` caches DOM references, populates fields from `StorageService`, wires open/close/save events.
    - `_saveDisplayName(value)` trims the value; if empty/whitespace persists `""` and calls `GreetingModule.render("")`; if `StorageService.set()` returns `false`, shows inline storage error; otherwise calls `GreetingModule.render(trimmed)`.
    - `_savePomoDuration(value)` parses as integer; if outside 1–120 or not a whole number, shows inline validation error without saving; otherwise calls `StorageService.set()` and `TimerModule.applyNewDuration(parsed)`.
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.6_

- [x] 10. Apply CSS styling
  - [x] 10.1 Write base layout and typography styles in `css/style.css`
    - CSS custom properties for colour tokens (light theme defaults at `:root`, dark theme overrides at `[data-theme="dark"]`).
    - Responsive single-column layout using CSS Grid or Flexbox; no horizontal scroll from 320 px to 1920 px.
    - Base font size ≥ 14 px for body text, ≥ 11 px for supplementary labels.
    - _Requirements: 7.5, 7.6, 8.3, 9.2, 9.3_

  - [x] 10.2 Write widget-specific and interactive styles
    - Section cards for greeting, timer, tasks, quick-links.
    - Focus timer: prominent `#timer-display`, visible completion message styles.
    - Task list: strikethrough for completed tasks, inline edit field styles, inline validation message styles.
    - Quick-links: button grid layout, error banner styles.
    - Settings panel: overlay/modal styles, field + error layout.
    - Theme toggle and settings open buttons in a fixed/sticky header.
    - Hover/focus/active states for all interactive controls; transitions ≤ 100 ms.
    - WCAG 2.1 AA contrast ratios (4.5:1 normal text, 3:1 large text) in both themes.
    - _Requirements: 5.7, 7.5, 7.6, 7.7, 9.4, 9.5_

- [x] 11. Wire everything together in `init()`
  - [x] 11.1 Write the top-level `init()` function in `app.js`
    - Call `StorageService` (no init needed), then `ThemeModule.init()`, `GreetingModule.init()`, `TimerModule.init()`, `TaskModule.init()`, `QuickLinksModule.init()`, `SettingsModule.init()` in order inside the `DOMContentLoaded` listener.
    - Ensure the page completes initial render within 1 second (all modules initialised synchronously on load).
    - _Requirements: 8.1, 8.2, 9.1_

  - [ ]* 11.2 Write integration tests for cross-module interactions
    - Test: Saving a new Display Name in SettingsModule updates `#greeting-text` within the same tick.
    - Test: Saving a new Pomodoro Duration while timer is IDLE resets `#timer-display`.
    - Test: Saving a new Pomodoro Duration while timer is RUNNING shows deferred-change notice.
    - Test: LocalStorage unavailable — `addLink` still updates in-memory list and shows error banner.
    - _Requirements: 2.2, 4.2, 4.6, 6.8_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements for traceability.
- Property tests use [fast-check](https://fast-check.io/) and are tagged with `// Feature: todo-life-dashboard, Property N: ...`; run with Vitest (`vitest --run`) or Jest in a jsdom environment.
- Pure functions (`computeGreetingText`, `_formatTime`, `_validate`, `_validateLink`, `_normalise`) are the primary targets for property-based tests; they have no DOM or storage side-effects.
- The three output files (`index.html`, `css/style.css`, `js/app.js`) must remain the only files in the deliverable; no build step, no external dependencies.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 3, "tasks": ["3.4", "4.2", "4.3", "5.1"] },
    { "id": 4, "tasks": ["4.4", "5.2", "5.3", "7.1"] },
    { "id": 5, "tasks": ["5.4", "5.5", "7.2", "7.3", "8.1"] },
    { "id": 6, "tasks": ["7.2", "8.2", "8.3", "9.1"] },
    { "id": 7, "tasks": ["8.4", "10.1"] },
    { "id": 8, "tasks": ["10.2", "11.1"] },
    { "id": 9, "tasks": ["11.2"] }
  ]
}
```
