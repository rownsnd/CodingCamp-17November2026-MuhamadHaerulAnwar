# Design Document

## Overview

The To-Do Life Dashboard is a single-page web application delivered as three static files: `index.html`, `css/style.css`, and `js/app.js`. It has no build step, no server dependency, and no third-party runtime libraries. The page works when opened directly via the `file://` protocol in any modern browser.

The dashboard presents four functional widgets on a single viewport:

1. **Greeting Widget** — displays current time (HH:MM, updated every second), current date, and a time-of-day greeting optionally personalised with a user-configured display name.
2. **Focus Timer** — a Pomodoro countdown timer with start, stop, and reset controls, an audible completion alert, and a configurable session length.
3. **Task List** — a full CRUD to-do list with inline editing, completion toggling, and automatic persistence.
4. **Quick Links** — a launcher for user-defined shortcut buttons that open URLs in new tabs.

Supporting concerns include a light/dark theme toggle, a settings panel for display name and Pomodoro duration, and all persistence handled exclusively through `window.localStorage`.

The design follows a **module pattern**: each widget is an immediately-invoked function expression (IIFE) or a plain object literal that owns its DOM references and its slice of `localStorage`. A single top-level `app.js` file coordinates initialisation and wires modules together via direct function calls, keeping the code navigable without any framework overhead.

---

## Architecture

### File Structure

```
index.html          ← Single HTML document, all markup
css/
  style.css         ← All styles (plain CSS, no preprocessor)
js/
  app.js            ← All JavaScript (vanilla, single file)
```

No external scripts, no CDN links, no Web Workers, no ES module bundling. All JavaScript runs as a single classic script loaded at the end of `<body>`.

### Module Organisation Inside `app.js`

```
app.js
├── StorageService      ← thin wrapper around localStorage
├── GreetingModule      ← Req 1 & 2
├── TimerModule         ← Req 3 & 4
├── TaskModule          ← Req 5
├── QuickLinksModule    ← Req 6
├── ThemeModule         ← Req 7
├── SettingsModule      ← ties Req 2, 4, 7 together in a panel
└── init()              ← calls each module's init() in order
```

Each module exposes an `init()` function called once at DOMContentLoaded. Modules do not import or require each other; they communicate only through shared `StorageService` calls and DOM events on elements they both hold references to.

### Data Flow

```
User action
  → DOM event listener (inside module)
    → module logic (validate, transform)
      → StorageService.set(key, value)
      → module render / updateDOM function
```

No global mutable state outside each module's closure. The `StorageService` is the single source of truth for persisted data; each module re-reads from it on `init()`.

### Rendering Strategy

All DOM mutations are imperative updates to specific elements — no virtual DOM, no diffing. Each module holds references to the DOM nodes it manages (assigned at `init()` time) and updates `textContent`, `classList`, and `innerHTML` directly. Full list re-renders (tasks, links) rebuild the relevant `<ul>` contents from the module's in-memory array after every write.

---

## Components and Interfaces

### StorageService

Wraps `window.localStorage` to centralise error handling for the case where `localStorage` is unavailable (private browsing, storage quota exceeded, `file://` restrictions on some browsers).

```js
StorageService = {
  get(key)        → any | null        // JSON.parse; returns null on failure
  set(key, value) → boolean           // JSON.stringify; returns false on failure
  remove(key)     → void
}
```

Callers check the boolean return of `set()` to surface storage-unavailable errors (Req 2.5, Req 6.8).

**Storage keys:**

| Key                   | Type    | Used by          |
|-----------------------|---------|------------------|
| `tdl_displayName`     | string  | GreetingModule   |
| `tdl_pomoDuration`    | number  | TimerModule      |
| `tdl_tasks`           | Task[]  | TaskModule       |
| `tdl_links`           | Link[]  | QuickLinksModule |
| `tdl_theme`           | string  | ThemeModule      |

### GreetingModule

Manages the greeting widget DOM. On `init()` it starts a `setInterval` that fires every 1 000 ms and calls `updateTime()`.

```js
GreetingModule = {
  init()                        // wire DOM refs, start interval, render
  updateTime()                  // read Date(), update #greeting-time
  updateDate()                  // read Date(), update #greeting-date (called once on init)
  computeGreetingText(hour)     // pure fn: hour → "Good Morning" | … | "Good Night"
  render(displayName)           // compose full greeting string, update #greeting-text
}
```

`computeGreetingText` is a pure function (no side-effects, no DOM access) to keep it unit-testable.

### TimerModule

Manages a single countdown using `setInterval` at 1 000 ms ticks.

```js
TimerModule = {
  init()                        // read stored duration, render idle state
  start()                       // begin or resume interval
  stop()                        // pause interval, retain remaining seconds
  reset()                       // clear interval, restore to current pomoDuration
  applyNewDuration(minutes)     // called by SettingsModule; deferred if running/paused
  _tick()                       // decrement remaining, update DOM, check completion
  _formatTime(totalSeconds)     // pure fn: seconds → "MM:SS" string
  _playBeep()                   // Web Audio API tone ≥ 0.5 s
  _showCompletion()             // display completion message, hide until reset
}
```

State machine (internal):

```
IDLE ──start()──→ RUNNING ──stop()──→ PAUSED ──start()──→ RUNNING
     ←─reset()──          ←─reset()──         ←─reset()──
RUNNING ──00:00──→ DONE ──reset()──→ IDLE
```

`_formatTime` is pure and unit-testable.

### TaskModule

Maintains an in-memory `tasks` array mirrored to `localStorage` on every write.

```js
TaskModule = {
  init()                            // load tasks from storage, render list
  addTask(title)                    // validate, push Task, persist, re-render
  editTask(id, newTitle)            // validate, update Task, persist, re-render
  toggleTask(id)                    // flip completion, persist, re-render
  deleteTask(id)                    // filter out, persist, re-render
  _validate(title)                  // pure fn: title → { valid, error }
  _render()                         // rebuild #task-list <ul> from tasks array
  _createTaskElement(task)          // returns a <li> DOM node for one Task
}
```

### QuickLinksModule

Analogous structure to TaskModule.

```js
QuickLinksModule = {
  init()                            // load links from storage, render
  addLink(label, url)               // validate, push Link, persist, re-render
  deleteLink(id)                    // filter out, persist, re-render
  _validateLink(label, url)         // pure fn: → { valid, error }
  _render()                         // rebuild #quick-links container
  _createLinkElement(link)          // returns a DOM button for one Link
}
```

### ThemeModule

```js
ThemeModule = {
  init()                            // read stored theme, apply
  toggle()                          // flip between "light" and "dark", persist, apply
  _apply(theme)                     // set data-theme attribute on <html>
  _normalise(raw)                   // pure fn: raw → "light" | "dark" (default light)
}
```

Theme is applied via a `data-theme="light|dark"` attribute on `<html>`. CSS rules use `[data-theme="dark"]` selectors.

### SettingsModule

Owns the settings panel overlay.

```js
SettingsModule = {
  init()                            // wire open/close, populate fields
  open()                            // show panel
  close()                           // hide panel
  _saveDisplayName(value)           // validate, call StorageService, call GreetingModule.render()
  _savePomoDuration(value)          // validate (1–120 int), call TimerModule.applyNewDuration()
}
```

---

## Data Models

### Task

```js
{
  id:          string,   // crypto.randomUUID() or Date.now().toString() fallback
  title:       string,   // 1–200 characters, user-supplied
  completed:   boolean,  // false on creation
  createdAt:   number    // Date.now() timestamp (ms since epoch)
}
```

Stored as a JSON array under key `tdl_tasks`. Order in the array is insertion order (newest appended to end of array, rendered in insertion order).

### Link

```js
{
  id:    string,   // crypto.randomUUID() or Date.now().toString() fallback
  label: string,   // 1–100 characters
  url:   string    // must begin with "http://" or "https://"; max 2048 characters
}
```

Stored as a JSON array under key `tdl_links`.

### Settings (not a stored object — each setting is its own key)

| Setting          | StorageKey           | Type   | Constraints                    | Default |
|------------------|----------------------|--------|--------------------------------|---------|
| Display Name     | `tdl_displayName`    | string | 1–50 chars (empty = no suffix) | ""      |
| Pomodoro Duration| `tdl_pomoDuration`   | number | integer 1–120                  | 25      |
| Theme            | `tdl_theme`          | string | "light" \| "dark"              | "light" |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Greeting text covers all hours

*For any* integer hour in the range 0–23, `computeGreetingText(hour)` SHALL return exactly one of "Good Morning", "Good Afternoon", "Good Evening", or "Good Night", and the ranges SHALL be exhaustive and non-overlapping.

**Validates: Requirements 1.4, 1.5, 1.6, 1.7**

### Property 2: Timer format round-trip

*For any* integer `s` in the range 0–7200 (0 to 120 minutes in seconds), `_formatTime(s)` SHALL return a string matching the pattern `MM:SS` where the numeric value of `MM * 60 + SS` equals `s`.

**Validates: Requirements 3.1, 3.3, 4.1**

### Property 3: Task validation rejects whitespace-only and over-length titles

*For any* string composed entirely of whitespace characters, or any string whose length exceeds 200 characters, `TaskModule._validate(title)` SHALL return `{ valid: false }`, and the tasks array SHALL remain unchanged after an attempted add or edit with such a title.

**Validates: Requirements 5.2, 5.5**

### Property 4: Task addition persists and restores

*For any* valid task title, after `addTask(title)` completes, the JSON value stored under `tdl_tasks` in `localStorage` SHALL contain an entry whose `title` matches the input, and after a simulated reload (re-reading from `localStorage`), the Task SHALL appear in the restored task list with the same `title` and `completed: false`.

**Validates: Requirements 5.1, 5.10, 5.11**

### Property 5: Completion toggle is an involution

*For any* task, toggling the completion control twice SHALL leave the task's `completed` value unchanged (equal to its value before the first toggle).

**Validates: Requirements 5.7, 5.8**

### Property 6: Quick-link validation rejects invalid inputs

*For any* combination of label and url where the label is empty or whitespace-only, or the label exceeds 100 characters, or the url does not begin with "http://" or "https://", or the url exceeds 2048 characters, or either field is empty, `_validateLink(label, url)` SHALL return `{ valid: false }` and the links array SHALL remain unchanged.

**Validates: Requirements 6.3, 6.4**

### Property 7: Theme normalisation always produces a valid theme

*For any* string stored under `tdl_theme` in `localStorage` (including unrecognised or empty values), `ThemeModule._normalise(raw)` SHALL return exactly `"light"` or `"dark"`. An unrecognised value SHALL normalise to `"light"`.

**Validates: Requirements 7.3, 7.4**

### Property 8: Theme toggle is an involution

*For any* active theme state, calling `ThemeModule.toggle()` twice SHALL leave the active theme unchanged (equal to its value before the first toggle).

**Validates: Requirements 7.1**

### Property 9: Display name greeting composition

*For any* non-empty display name of 1–50 characters, the greeting string produced by `GreetingModule.render(displayName)` SHALL contain the greeting text as a prefix followed by ", " and the display name. For an empty or whitespace-only display name, the greeting string SHALL equal the bare greeting text with no suffix.

**Validates: Requirements 2.1, 2.3**

---

## Error Handling

### LocalStorage Unavailable

`StorageService.set()` wraps every `localStorage.setItem()` call in a try/catch. If the call throws (quota exceeded, storage disabled), `set()` returns `false`. Every caller that must surface an error to the user checks this return value:

- **SettingsModule._saveDisplayName**: displays an inline error in the settings panel; retains the previously displayed name in the greeting widget (Req 2.5).
- **QuickLinksModule.addLink / deleteLink**: displays a banner indicating changes will not be saved; continues to update the in-memory array so the UI reflects the user's action for the current session (Req 6.8).
- **TaskModule**: silently degrades (the app continues functioning; data loss on reload is acceptable per requirements, which only mandate explicit error messaging for Quick Links and Display Name).
- **ThemeModule**: silently degrades (theme reverts to light on next load, which is the documented default).

### Input Validation

Every user-facing input is validated before any state mutation. Validation errors are shown as inline `<span>` elements adjacent to the offending input field. Error messages are cleared when the user modifies the field again or dismisses the form. No `alert()` calls are used.

### Timer Edge Cases

- `start()` called when state is `DONE` (00:00): ignored (Req 3.9).
- `applyNewDuration()` called while `RUNNING` or `PAUSED`: stores the new value in `localStorage` and displays a deferred-change notice; applies on next `reset()` or after `DONE` (Req 4.6).
- `_playBeep()` uses the Web Audio API (`AudioContext`). If `AudioContext` is unavailable or suspended (browser autoplay policy), the method silently fails so the visual completion message still appears (Req 3.8 is still satisfied).

### ID Generation

Tasks and Links use `crypto.randomUUID()` where available. On environments that do not support it (older `file://` contexts without HTTPS), `Date.now().toString() + Math.random()` is used as a fallback, which is collision-resistant for typical personal-use volumes.

---

## Testing Strategy

This feature is built in vanilla JS with no build tooling. The recommended test setup uses a lightweight test runner (e.g., [Vitest](https://vitest.dev/) or [Jest](https://jestjs.io/)) configured to run `app.js` in a jsdom environment, or the pure functions can be extracted and tested in Node.js directly.

### Unit Tests

Unit tests cover specific examples, edge cases, and error conditions on the pure functions in each module:

- `computeGreetingText(hour)` — one example per time band, boundary values (5, 12, 18, 21, 0, 4).
- `_formatTime(seconds)` — spot checks: 0 → "00:00", 25*60 → "25:00", 59 → "00:59", 3600 → "60:00".
- `_validate(title)` — empty string, 200-char string (valid), 201-char string (invalid), whitespace-only.
- `_validateLink(label, url)` — missing protocol, ftp:// prefix, 101-char label, 2049-char URL, all-whitespace label.
- `_normalise(raw)` — "light", "dark", "", "LIGHT", null, undefined.

### Property-Based Tests

Property-based tests use a PBT library — [fast-check](https://fast-check.io/) is recommended as it runs in both Node.js and browser contexts with no native dependencies.

Each test runs a minimum of **100 iterations**. Tests are tagged with a comment referencing the design property they verify.

| Property | Generator | What is asserted |
|---|---|---|
| **Property 1** – Greeting exhaustive coverage | `fc.integer({ min: 0, max: 23 })` | Return value is one of four valid strings; total coverage is 24 hours |
| **Property 2** – Timer format round-trip | `fc.integer({ min: 0, max: 7200 })` | `parseInt(MM)*60 + parseInt(SS) === s` for all s |
| **Property 3** – Task validation rejects bad titles | `fc.oneof(fc.string().filter(s => s.trim() === ''), fc.string({ minLength: 201 }))` | `_validate(title).valid === false`; tasks array length unchanged |
| **Property 4** – Task add/persist/restore | `fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0)` | After `addTask`, `localStorage` contains the title; after simulated reload, task appears |
| **Property 5** – Toggle involution | `fc.record({ id: fc.string(), title: fc.string(), completed: fc.boolean(), createdAt: fc.integer() })` | `toggle(toggle(task)).completed === task.completed` |
| **Property 6** – Link validation rejects bad inputs | Generators for each invalid sub-case (bad protocol, empty label, oversized fields) | `_validateLink().valid === false`; links array unchanged |
| **Property 7** – Theme normalisation | `fc.string()` | Result is always `"light"` or `"dark"` |
| **Property 8** – Theme toggle involution | `fc.constantFrom("light", "dark")` | `toggle(toggle(theme)) === theme` |
| **Property 9** – Greeting composition | `fc.string({ minLength: 1, maxLength: 50 })` for name; `fc.integer({ min: 0, max: 23 })` for hour | Rendered string starts with the correct greeting and contains ", name" suffix |

Tag format for each property test:
```
// Feature: todo-life-dashboard, Property N: <property_text>
```

### Integration / Manual Tests

Because the app runs in a real browser with real `localStorage` and real DOM, the following are verified manually or with a Playwright/Puppeteer smoke test:

- Page loads in under 1 second (Req 9.1).
- No horizontal scroll at 320 px and 1920 px viewport widths (Req 9.2).
- Timer beep plays on completion (Req 3.7) — verified with audio output enabled.
- `file://` protocol loading in Chrome, Firefox, Edge, and Safari (Req 8.6).
- WCAG AA contrast ratios verified with a browser DevTools accessibility audit (Req 9.5).
- LocalStorage-unavailable path simulated via DevTools storage override.
