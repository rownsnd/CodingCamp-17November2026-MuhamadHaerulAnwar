# Requirements Document

## Introduction

The To-Do List Life Dashboard is a single-page web application that serves as a personal daily homepage. It is built with vanilla HTML, CSS, and JavaScript, requires no backend or build step, and runs entirely in a modern browser. All user data persists via the browser's LocalStorage API. The dashboard presents four sections: a time-and-date greeting, a configurable Pomodoro focus timer, a task list, and a quick-links launcher. Optional enhancements include a light/dark mode toggle, a user-configurable display name, and a configurable Pomodoro duration.

## Glossary

- **Dashboard**: The single HTML page that hosts all four feature sections.
- **Greeting_Widget**: The section that displays the current time, current date, and a time-of-day greeting.
- **Timer**: The Pomodoro focus countdown timer widget.
- **Task_List**: The section that manages to-do tasks.
- **Task**: A single to-do item with a title, a completion state, and a creation timestamp.
- **Quick_Links**: The section that manages user-defined shortcut buttons to external URLs.
- **Link**: A single quick-link item with a display label and a URL.
- **LocalStorage**: The browser's `window.localStorage` API used for all client-side data persistence.
- **Theme**: The visual color scheme of the Dashboard, either light or dark.
- **Display_Name**: A user-configured name shown in the greeting text.
- **Pomodoro_Duration**: The configurable length of a single focus session in minutes.
- **Settings_Panel**: A UI element where the user configures Display_Name, Pomodoro_Duration, and Theme.

---

## Requirements

### Requirement 1: Time and Date Greeting

**User Story:** As a user, I want to see the current time, date, and a contextual greeting when I open the Dashboard, so that I am immediately oriented to the current moment.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Greeting_Widget SHALL display the current local time in HH:MM format.
2. WHILE the Dashboard is open, THE Greeting_Widget SHALL update the displayed time every 1 second.
3. WHEN the Dashboard loads, THE Greeting_Widget SHALL display the current local date in the format "DayName, DD MonthName YYYY" (e.g., "Monday, 18 November 2026").
4. IF the current local hour is between 05:00 and 11:59 inclusive, THEN THE Greeting_Widget SHALL display the greeting text "Good Morning".
5. IF the current local hour is between 12:00 and 17:59 inclusive, THEN THE Greeting_Widget SHALL display the greeting text "Good Afternoon".
6. IF the current local hour is between 18:00 and 20:59 inclusive, THEN THE Greeting_Widget SHALL display the greeting text "Good Evening".
7. IF the current local hour is between 21:00 and 23:59 inclusive, or between 00:00 and 04:59 inclusive, THEN THE Greeting_Widget SHALL display the greeting text "Good Night".

### Requirement 2: Custom Name in Greeting

**User Story:** As a user, I want to set my name so that the greeting addresses me personally.

#### Acceptance Criteria

1. WHERE a Display_Name has been saved, THE Greeting_Widget SHALL append the Display_Name (1–50 characters) to the greeting text, formatted as "[greeting], [Display_Name]".
2. WHEN the user saves a new Display_Name via the Settings_Panel, THE Greeting_Widget SHALL reflect the updated name within 1 second without a page reload.
3. WHEN the user clears the Display_Name field or enters a whitespace-only value and saves, THE Greeting_Widget SHALL display the greeting without a name suffix.
4. THE Dashboard SHALL persist the Display_Name to LocalStorage on save and restore it from LocalStorage on page load so that the Greeting_Widget displays the saved name after a reload.
5. IF LocalStorage is unavailable when the user saves a Display_Name, THEN THE Settings_Panel SHALL display an error message indicating the name could not be saved and SHALL retain the previously displayed name in the Greeting_Widget.

### Requirement 3: Focus Timer

**User Story:** As a user, I want a countdown timer I can start, stop, and reset, so that I can work in focused Pomodoro sessions.

#### Acceptance Criteria

1. WHEN the Dashboard loads and no Timer session is active, THE Timer SHALL display the default Pomodoro_Duration of 25 minutes in MM:SS format (e.g., "25:00").
2. WHEN the user activates the Start control, THE Timer SHALL begin counting down one second at a time.
3. WHILE the Timer is counting down, THE Timer SHALL update the displayed time every second.
4. WHEN the user activates the Stop control while the Timer is counting down, THE Timer SHALL pause the countdown and retain the remaining time.
5. WHEN the user activates the Start control after the Timer has been paused, THE Timer SHALL resume the countdown from the retained remaining time.
6. WHEN the user activates the Reset control in any state (counting down, paused, or completed), THE Timer SHALL stop any active countdown and restore the display to the default Pomodoro_Duration of 25 minutes (25:00).
7. WHEN the countdown reaches 00:00, THE Timer SHALL stop automatically and emit an audible beep of at least 0.5 seconds duration through the browser.
8. WHEN the countdown reaches 00:00, THE Timer SHALL display a visible completion message that persists until the user activates the Reset control.
9. IF the user activates the Start control while the Timer displays 00:00, THEN THE Timer SHALL ignore the input and retain the 00:00 display and completion message.

### Requirement 4: Configurable Pomodoro Duration

**User Story:** As a user, I want to set my own Pomodoro session length, so that I can adapt the timer to my preferred work rhythm.

#### Acceptance Criteria

1. THE Settings_Panel SHALL provide an input that accepts a Pomodoro_Duration between 1 and 120 minutes (whole numbers only).
2. WHEN the user saves a new Pomodoro_Duration via the Settings_Panel and the Timer is in a stopped or reset state, THE Timer SHALL reset to the new duration.
3. IF the user saves a Pomodoro_Duration outside the range of 1 to 120, THEN THE Settings_Panel SHALL display a validation error and SHALL NOT save the value.
4. WHEN the user saves a new Pomodoro_Duration via the Settings_Panel, THE Settings_Panel SHALL persist the Pomodoro_Duration to LocalStorage.
5. WHEN the Dashboard loads, THE Timer SHALL initialise with the Pomodoro_Duration stored in LocalStorage, or 25 minutes if no stored value exists or the stored value is not a whole number between 1 and 120.
6. IF the user saves a new Pomodoro_Duration via the Settings_Panel while the Timer is in a running or paused state, THEN THE Timer SHALL apply the new duration only after the current session ends, and THE Settings_Panel SHALL display a message indicating the change will take effect after the current session.

### Requirement 5: To-Do List

**User Story:** As a user, I want to manage a list of tasks I can add, edit, complete, and delete, so that I can track what I need to do during the day.

#### Acceptance Criteria

1. WHEN the user submits a non-empty task title of 1 to 200 characters via the add-task input, THE Task_List SHALL add a new Task with that title, a completion state of false, and the current timestamp.
2. IF the user attempts to submit an empty task title or a title exceeding 200 characters, THEN THE Task_List SHALL NOT add a Task and SHALL display an inline validation message indicating the title must be between 1 and 200 characters.
3. WHEN the user activates the edit control on a Task, THE Task_List SHALL display an inline editable field pre-filled with the Task's current title.
4. WHEN the user confirms an edit with a non-empty title of 1 to 200 characters, THE Task_List SHALL update the Task's title and exit edit mode.
5. IF the user confirms an edit with an empty title or a title exceeding 200 characters, THEN THE Task_List SHALL NOT update the Task and SHALL display an inline validation message indicating the title must be between 1 and 200 characters.
6. WHEN the user activates the cancel control during edit mode, THE Task_List SHALL discard all changes to the Task's title and exit edit mode without modifying the Task.
7. WHEN the user toggles the completion control on a Task whose completion state is false, THE Task_List SHALL set the Task's completion state to true and apply a visual strikethrough style to the Task's title.
8. WHEN the user toggles the completion control on a Task whose completion state is true, THE Task_List SHALL set the Task's completion state to false and remove the visual strikethrough style from the Task's title.
9. WHEN the user activates the delete control on a Task, THE Task_List SHALL remove the Task from the list immediately.
10. WHEN the user performs any add, edit, complete-toggle, or delete operation, THE Dashboard SHALL persist the full Task list to LocalStorage so that the list survives a page reload.
11. WHEN the Dashboard loads, THE Task_List SHALL restore all Tasks from LocalStorage in their saved order and completion states.

### Requirement 6: Quick Links

**User Story:** As a user, I want to save and launch shortcuts to my favourite websites, so that I can reach them in one click from my Dashboard.

#### Acceptance Criteria

1. WHEN the user submits a valid URL and label via the add-link form, THE Quick_Links SHALL add a new Link button displaying the label.
2. WHEN the user activates a Link button, THE Quick_Links SHALL open the associated URL in a new browser tab.
3. IF the user submits an add-link form where the URL does not begin with "http://" or "https://", THEN THE Quick_Links SHALL display a validation error and SHALL NOT add the Link.
4. IF the user submits an add-link form where the label field is empty or contains only whitespace characters, or where the URL field is empty or contains only whitespace characters, or where the label exceeds 100 characters, or where the URL exceeds 2048 characters, THEN THE Quick_Links SHALL display a validation error and SHALL NOT add the Link.
5. WHEN the user activates the delete control on a Link, THE Quick_Links SHALL remove the Link immediately.
6. WHEN the user successfully adds or deletes a Link, THE Dashboard SHALL persist the updated full Link list to LocalStorage.
7. WHEN the Dashboard loads, THE Quick_Links SHALL restore all Links from LocalStorage.
8. IF LocalStorage is unavailable when the Dashboard loads or when a Link is added or deleted, THEN THE Dashboard SHALL continue to display and update the Link list for the current session without persisting changes, and SHALL display an error message indicating that changes will not be saved.

### Requirement 7: Light / Dark Mode Toggle

**User Story:** As a user, I want to switch between a light and a dark colour scheme, so that the Dashboard is comfortable to use in different lighting conditions.

#### Acceptance Criteria

1. WHEN the user activates the Theme toggle control, THE Dashboard SHALL switch the active Theme to dark if the current Theme is light, or to light if the current Theme is dark.
2. THE Dashboard SHALL persist the selected Theme to LocalStorage so that it survives a page reload.
3. WHEN the Dashboard loads, THE Dashboard SHALL apply the Theme stored in LocalStorage, or the light Theme if no stored value exists.
4. IF the value stored in LocalStorage for the Theme is not a recognised Theme identifier (i.e., neither "light" nor "dark"), THEN THE Dashboard SHALL apply the light Theme as the default.
5. WHILE the dark Theme is active, THE Dashboard SHALL apply a dark background colour and light foreground text to all visible sections.
6. WHILE the light Theme is active, THE Dashboard SHALL apply a light background colour and dark foreground text to all visible sections.
7. WHILE a Theme is active, THE Dashboard SHALL display the Theme toggle control in a visual state that indicates the currently active Theme.

### Requirement 8: Technical Constraints

**User Story:** As a developer, I want the Dashboard to be built with vanilla web technologies and no server dependency, so that it deploys as a static site with no build tooling.

#### Acceptance Criteria

1. THE Dashboard SHALL be implemented in a single `index.html` file, one CSS file at `css/style.css`, and one JavaScript file at `js/app.js`, with no additional JavaScript or CSS files.
2. THE Dashboard SHALL use no JavaScript frameworks, libraries, or external runtime dependencies (no React, Vue, Angular, jQuery, etc.), including no assets loaded from external CDNs such as icon libraries or web font services.
3. THE Dashboard SHALL use no CSS preprocessors or build steps; the CSS file SHALL be plain CSS.
4. THE Dashboard SHALL use the browser LocalStorage API as the sole mechanism for data persistence; there SHALL be no network requests for data storage or retrieval.
5. THE Dashboard SHALL load and function correctly in the latest stable releases of Chrome, Firefox, Edge, and Safari at the time of testing.
6. THE Dashboard SHALL be fully usable when opened directly from the file system (via `file://` protocol) without a web server.

### Requirement 9: Performance and Usability

**User Story:** As a user, I want the Dashboard to feel fast and readable, so that it does not slow me down or strain my eyes.

#### Acceptance Criteria

1. THE Dashboard SHALL complete its initial render, defined as all visible elements painted with their final content and styles applied, within 1 second on a modern mid-range desktop machine (manufactured within the last 5 years) with no network throttling.
2. THE Dashboard SHALL apply layout and typography such that, at any viewport width from 320 px to 1920 px, no horizontal scrollbar appears and no text is clipped or overflows its containing element.
3. THE Dashboard SHALL use font sizes no smaller than 14 px for body text and 11 px for supplementary labels.
4. WHEN the user interacts with any control (button, input, toggle), THE Dashboard SHALL reflect the interaction visually within 100 ms.
5. THE Dashboard SHALL provide sufficient colour contrast between text and background to meet WCAG 2.1 AA contrast ratio minimums (4.5:1 for normal text, 3:1 for large text) in both light and dark themes.
