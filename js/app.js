// To-Do Life Dashboard

// ---------------------------------------------------------------------------
// StorageService
// Thin wrapper around localStorage. All reads/writes are centralised here so
// that quota errors and unavailability are handled in one place.
//
// Storage keys used across the app:
//   tdl_displayName  — string  (GreetingModule / SettingsModule)
//   tdl_pomoDuration — number  (TimerModule / SettingsModule)
//   tdl_tasks        — Task[]  (TaskModule)
//   tdl_links        — Link[]  (QuickLinksModule)
//   tdl_theme        — string  (ThemeModule)
// ---------------------------------------------------------------------------
var StorageService = {
  /**
   * get(key) → any | null
   * Reads and JSON-parses the value stored under `key`.
   * Returns null if the key is absent or if any error occurs (e.g. storage
   * disabled in private-browsing mode, or malformed JSON).
   */
  get: function (key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  /**
   * set(key, value) → boolean
   * JSON-stringifies `value` and writes it under `key`.
   * Returns true on success, false if localStorage is unavailable or the
   * storage quota is exceeded.
   */
  set: function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * remove(key) → void
   * Removes the item stored under `key`. Silently swallows errors.
   */
  remove: function (key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // silently ignore
    }
  }
};

// ---------------------------------------------------------------------------
// GreetingModule
// Displays a time-of-day greeting, the current time, and the current date.
//
// DOM targets (must exist in index.html):
//   #greeting-time  — HH:MM clock, updated every second
//   #greeting-date  — full date string, e.g. "Monday, 18 November 2026"
//   #greeting-text  — greeting phrase, e.g. "Good Morning, Alice"
// ---------------------------------------------------------------------------
var GreetingModule = {
  _timeEl: null,
  _dateEl: null,
  _textEl: null,
  _displayName: '',

  /**
   * computeGreetingText(hour) → string
   * Pure function. Maps a 24-hour integer (0–23) to a greeting phrase.
   *   5–11  → "Good Morning"
   *  12–17  → "Good Afternoon"
   *  18–20  → "Good Evening"
   *  21–23, 0–4 → "Good Night"
   */
  computeGreetingText: function (hour) {
    if (hour >= 5 && hour <= 11) return 'Good Morning';
    if (hour >= 12 && hour <= 17) return 'Good Afternoon';
    if (hour >= 18 && hour <= 20) return 'Good Evening';
    return 'Good Night';
  },

  /**
   * init() → void
   * Caches DOM references, reads the stored display name, populates all
   * greeting elements immediately, then starts a 1-second interval to keep
   * the clock current.
   */
  init: function () {
    this._timeEl = document.getElementById('greeting-time');
    this._dateEl = document.getElementById('greeting-date');
    this._textEl = document.getElementById('greeting-text');

    this._displayName = StorageService.get('tdl_displayName') || '';

    this.updateTime();
    this.updateDate();
    this.render(this._displayName);

    var self = this;
    setInterval(function () {
      self.updateTime();
    }, 1000);
  },

  /**
   * updateTime() → void
   * Reads the current time and writes a zero-padded HH:MM string to
   * #greeting-time.
   */
  updateTime: function () {
    if (!this._timeEl) return;
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    this._timeEl.textContent = hh + ':' + mm;
  },

  /**
   * updateDate() → void
   * Writes the current date as "DayName, DD MonthName YYYY" to
   * #greeting-date.
   */
  updateDate: function () {
    if (!this._dateEl) return;
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    var now = new Date();
    var dayName = days[now.getDay()];
    var dd = String(now.getDate()).padStart(2, '0');
    var monthName = months[now.getMonth()];
    var yyyy = now.getFullYear();
    this._dateEl.textContent = dayName + ', ' + dd + ' ' + monthName + ' ' + yyyy;
  },

  /**
   * render(displayName) → void
   * Composes the greeting phrase from the current hour and an optional
   * display name, then writes it to #greeting-text.
   * If displayName is non-empty and non-whitespace, appends ", displayName".
   */
  render: function (displayName) {
    if (!this._textEl) return;
    var hour = new Date().getHours();
    var greeting = this.computeGreetingText(hour);
    if (displayName && displayName.trim().length > 0) {
      greeting = greeting + ', ' + displayName;
    }
    this._textEl.textContent = greeting;
  }
};

// ---------------------------------------------------------------------------
// TimerModule
// Pomodoro-style countdown timer.
//
// DOM targets (must exist in index.html):
//   #timer-display          — shows the MM:SS countdown
//   #timer-completion       — shown when the session finishes
//   #timer-deferred-notice  — shown when duration is changed mid-session
//
// Storage keys used:
//   tdl_pomoDuration — number (minutes, 1–120, default 25)
//
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.2, 4.5, 4.6
// ---------------------------------------------------------------------------
var TimerModule = {
  // internal state
  _state: 'IDLE',       // 'IDLE' | 'RUNNING' | 'PAUSED' | 'DONE'
  _remaining: 0,
  _pomoDuration: 25,
  _interval: null,
  // DOM refs (assigned in init)
  _display: null,
  _completionEl: null,
  _deferredNotice: null,

  /**
   * init() → void
   * Reads tdl_pomoDuration from StorageService; validates it is a whole
   * number between 1–120 (defaults to 25 otherwise); sets _pomoDuration and
   * _remaining; caches DOM refs; updates the display; wires button handlers.
   */
  init: function () {
    var stored = StorageService.get('tdl_pomoDuration');
    var duration = 25;
    if (
      stored !== null &&
      typeof stored === 'number' &&
      Number.isInteger(stored) &&
      stored >= 1 &&
      stored <= 120
    ) {
      duration = stored;
    }
    this._pomoDuration = duration;
    this._remaining = duration * 60;

    this._display = document.getElementById('timer-display');
    this._completionEl = document.getElementById('timer-completion');
    this._deferredNotice = document.getElementById('timer-deferred-notice');

    if (this._display) {
      this._display.textContent = this._formatTime(this._remaining);
    }

    var self = this;
    var startBtn = document.getElementById('timer-start');
    var stopBtn = document.getElementById('timer-stop');
    var resetBtn = document.getElementById('timer-reset');
    if (startBtn) startBtn.addEventListener('click', function () { self.start(); });
    if (stopBtn)  stopBtn.addEventListener('click',  function () { self.stop(); });
    if (resetBtn) resetBtn.addEventListener('click', function () { self.reset(); });
  },

  /**
   * start() → void
   * No-op when _state is 'DONE'. Otherwise sets state to 'RUNNING' and
   * begins the 1-second tick interval.
   */
  start: function () {
    if (this._state === 'DONE') return;
    this._state = 'RUNNING';
    var self = this;
    this._interval = setInterval(function () { self._tick(); }, 1000);
  },

  /**
   * stop() → void
   * Clears the interval and sets _state to 'PAUSED', retaining _remaining.
   */
  stop: function () {
    clearInterval(this._interval);
    this._interval = null;
    this._state = 'PAUSED';
  },

  /**
   * reset() → void
   * Clears the interval, restores _remaining to the full duration, hides
   * the completion and deferred-notice banners, updates the display, and
   * sets _state to 'IDLE'.
   */
  reset: function () {
    clearInterval(this._interval);
    this._interval = null;
    this._remaining = this._pomoDuration * 60;
    if (this._completionEl)   this._completionEl.style.display = 'none';
    if (this._deferredNotice) this._deferredNotice.style.display = 'none';
    if (this._display) {
      this._display.textContent = this._formatTime(this._remaining);
    }
    this._state = 'IDLE';
  },

  /**
   * applyNewDuration(minutes) → void
   * If RUNNING or PAUSED: saves the new duration and shows the deferred
   * notice (the change takes effect after the current session ends).
   * If IDLE or DONE: saves the new duration and calls reset() so the
   * display updates immediately.
   */
  applyNewDuration: function (minutes) {
    if (this._state === 'RUNNING' || this._state === 'PAUSED') {
      StorageService.set('tdl_pomoDuration', minutes);
      this._pomoDuration = minutes;
      if (this._deferredNotice) this._deferredNotice.style.display = 'block';
    } else {
      // IDLE or DONE
      StorageService.set('tdl_pomoDuration', minutes);
      this._pomoDuration = minutes;
      this.reset();
    }
  },

  /**
   * _tick() → void
   * Called every second while RUNNING. Decrements _remaining and updates
   * the display. When _remaining reaches 0, clears the interval, marks
   * state as 'DONE', plays the completion beep, and shows the completion
   * banner.
   */
  _tick: function () {
    this._remaining -= 1;
    if (this._display) {
      this._display.textContent = this._formatTime(this._remaining);
    }
    if (this._remaining <= 0) {
      clearInterval(this._interval);
      this._interval = null;
      this._state = 'DONE';
      this._playBeep();
      this._showCompletion();
    }
  },

  /**
   * _formatTime(totalSeconds) → string
   * Pure function. Converts a non-negative integer number of seconds into a
   * zero-padded "MM:SS" string.
   *   1500 → "25:00"
   *     59 → "00:59"
   *      0 → "00:00"
   *   3600 → "60:00"
   * Requirements: 3.1, 3.3
   */
  _formatTime: function (totalSeconds) {
    var mm = Math.floor(totalSeconds / 60);
    var ss = totalSeconds % 60;
    return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  },

  /**
   * _playBeep() → void
   * Creates a short 440 Hz sine-wave beep via the Web Audio API.
   * All errors are silently swallowed so a missing AudioContext never
   * breaks the timer.
   */
  _playBeep: function () {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var ctx = new AudioCtx();
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 440;
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      // silently swallow
    }
  },

  /**
   * _showCompletion() → void
   * Makes the #timer-completion banner visible.
   */
  _showCompletion: function () {
    if (this._completionEl) {
      this._completionEl.style.display = 'block';
    }
  }
};

// ---------------------------------------------------------------------------
// TaskModule
// Manages a persistent to-do list with add, inline-edit, complete-toggle,
// and delete operations.
//
// DOM targets (must exist in index.html):
//   #task-input    — text input for new task titles
//   #task-add-btn  — button that triggers addTask
//   #task-error    — inline validation message span
//   #task-list     — <ul> that holds task <li> elements
//
// Storage key used:
//   tdl_tasks — Task[] (array of Task objects)
//
// Task shape:
//   { id: string, title: string, completed: boolean, createdAt: number }
//
// Requirements: 5.1–5.11
// ---------------------------------------------------------------------------
var TaskModule = {
  _tasks: [],
  _inputEl: null,
  _addBtnEl: null,
  _errorEl: null,
  _listEl: null,

  /**
   * _validate(title) → { valid: true } | { valid: false, error: string }
   * Pure function. Returns valid for strings whose trimmed length is 1–200.
   * Returns invalid for empty strings, whitespace-only strings, or strings
   * whose trimmed length exceeds 200 characters.
   * Requirements: 5.2, 5.5
   */
  _validate: function (title) {
    if (typeof title !== 'string') {
      return { valid: false, error: 'Title must be a string.' };
    }
    var trimmed = title.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Title must be between 1 and 200 characters.' };
    }
    if (trimmed.length > 200) {
      return { valid: false, error: 'Title must be between 1 and 200 characters.' };
    }
    return { valid: true };
  },

  /**
   * init() → void
   * Loads persisted tasks from StorageService, caches DOM references,
   * renders the list, and wires input event listeners.
   */
  init: function () {
    this._inputEl  = document.getElementById('task-input');
    this._addBtnEl = document.getElementById('task-add-btn');
    this._errorEl  = document.getElementById('task-error');
    this._listEl   = document.getElementById('task-list');

    var stored = StorageService.get('tdl_tasks');
    this._tasks = Array.isArray(stored) ? stored : [];

    this._render();

    var self = this;

    if (this._addBtnEl) {
      this._addBtnEl.addEventListener('click', function () {
        var value = self._inputEl ? self._inputEl.value : '';
        var added = self.addTask(value);
        if (added && self._inputEl) {
          self._inputEl.value = '';
        }
      });
    }

    if (this._inputEl) {
      this._inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var value = self._inputEl.value;
          var added = self.addTask(value);
          if (added) {
            self._inputEl.value = '';
          }
        }
      });

      // Clear the error message when the user starts typing again
      this._inputEl.addEventListener('input', function () {
        if (self._errorEl) {
          self._errorEl.style.display = 'none';
          self._errorEl.textContent = '';
        }
      });
    }
  },

  /**
   * addTask(title) → boolean
   * Validates, creates a Task object, persists, and re-renders.
   * Returns true on success, false on validation failure.
   * Requirements: 5.1, 5.2, 5.10
   */
  addTask: function (title) {
    var result = this._validate(title);
    if (!result.valid) {
      if (this._errorEl) {
        this._errorEl.textContent = result.error;
        this._errorEl.style.display = 'inline';
      }
      return false;
    }

    if (this._errorEl) {
      this._errorEl.style.display = 'none';
      this._errorEl.textContent = '';
    }

    var id;
    try {
      id = crypto.randomUUID();
    } catch (e) {
      id = Date.now().toString() + Math.random();
    }

    var task = {
      id: id,
      title: title.trim(),
      completed: false,
      createdAt: Date.now()
    };

    this._tasks.push(task);
    StorageService.set('tdl_tasks', this._tasks);
    this._render();
    return true;
  },

  /**
   * editTask(id, newTitle) → boolean
   * Validates newTitle, finds the matching task, updates its title,
   * persists, and re-renders. Returns true on success, false if invalid.
   * Requirements: 5.3, 5.4, 5.5, 5.10
   */
  editTask: function (id, newTitle) {
    var result = this._validate(newTitle);
    if (!result.valid) {
      return false;
    }
    for (var i = 0; i < this._tasks.length; i++) {
      if (this._tasks[i].id === id) {
        this._tasks[i].title = newTitle.trim();
        StorageService.set('tdl_tasks', this._tasks);
        this._render();
        return true;
      }
    }
    return false;
  },

  /**
   * toggleTask(id) → void
   * Flips the completed boolean on the matching task, persists, re-renders.
   * Requirements: 5.7, 5.8, 5.10
   */
  toggleTask: function (id) {
    for (var i = 0; i < this._tasks.length; i++) {
      if (this._tasks[i].id === id) {
        this._tasks[i].completed = !this._tasks[i].completed;
        StorageService.set('tdl_tasks', this._tasks);
        this._render();
        return;
      }
    }
  },

  /**
   * deleteTask(id) → void
   * Removes the task with the matching id, persists, re-renders.
   * Requirements: 5.9, 5.10
   */
  deleteTask: function (id) {
    this._tasks = this._tasks.filter(function (t) { return t.id !== id; });
    StorageService.set('tdl_tasks', this._tasks);
    this._render();
  },

  /**
   * _render() → void
   * Rebuilds #task-list contents from the in-memory tasks array.
   * Requirements: 5.11
   */
  _render: function () {
    if (!this._listEl) return;
    this._listEl.innerHTML = '';

    if (this._tasks.length === 0) {
      var placeholder = document.createElement('li');
      placeholder.id = 'task-empty';
      placeholder.textContent = 'No tasks yet.';
      this._listEl.appendChild(placeholder);
      return;
    }

    for (var i = 0; i < this._tasks.length; i++) {
      this._listEl.appendChild(this._createTaskElement(this._tasks[i]));
    }
  },

  /**
   * _createTaskElement(task) → HTMLLIElement
   * Builds and returns a <li> for a single task with checkbox, title,
   * edit button (with inline-edit mode), and delete button.
   * Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9
   */
  _createTaskElement: function (task) {
    var self = this;
    var li = document.createElement('li');
    li.className = 'task-item';
    li.dataset.id = task.id;

    // --- Checkbox ---
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', function () {
      self.toggleTask(task.id);
    });

    // --- Title span ---
    var titleSpan = document.createElement('span');
    titleSpan.className = 'task-title' + (task.completed ? ' completed' : '');
    titleSpan.textContent = task.title;

    // --- Edit button ---
    var editBtn = document.createElement('button');
    editBtn.className = 'task-edit-btn';
    editBtn.textContent = 'Edit';

    // --- Delete button ---
    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'task-delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', function () {
      self.deleteTask(task.id);
    });

    // --- Inline edit controls (hidden by default) ---
    var editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'task-edit-input';
    editInput.value = task.title;
    editInput.style.display = 'none';

    var editError = document.createElement('span');
    editError.className = 'task-edit-error';
    editError.style.display = 'none';

    var confirmBtn = document.createElement('button');
    confirmBtn.className = 'task-confirm-btn';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.style.display = 'none';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'task-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.display = 'none';

    // Enter edit mode
    editBtn.addEventListener('click', function () {
      titleSpan.style.display = 'none';
      editBtn.style.display = 'none';
      deleteBtn.style.display = 'none';
      editInput.value = task.title;
      editInput.style.display = 'inline';
      editError.style.display = 'none';
      confirmBtn.style.display = 'inline';
      cancelBtn.style.display = 'inline';
      editInput.focus();
    });

    // Exit edit mode (cancel)
    cancelBtn.addEventListener('click', function () {
      editInput.style.display = 'none';
      editError.style.display = 'none';
      confirmBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      titleSpan.style.display = 'inline';
      editBtn.style.display = 'inline';
      deleteBtn.style.display = 'inline';
    });

    // Confirm edit
    var doConfirm = function () {
      var newTitle = editInput.value;
      var ok = self.editTask(task.id, newTitle);
      if (!ok) {
        // Show inline error without leaving edit mode
        var validationResult = self._validate(newTitle);
        editError.textContent = validationResult.error || 'Invalid title.';
        editError.style.display = 'inline';
      }
      // If ok, _render() has already rebuilt the list; nothing more to do here.
    };

    confirmBtn.addEventListener('click', doConfirm);

    editInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doConfirm();
      if (e.key === 'Escape') cancelBtn.click();
    });

    // Clear inline error while user edits
    editInput.addEventListener('input', function () {
      editError.style.display = 'none';
      editError.textContent = '';
    });

    li.appendChild(checkbox);
    li.appendChild(titleSpan);
    li.appendChild(editInput);
    li.appendChild(editError);
    li.appendChild(editBtn);
    li.appendChild(confirmBtn);
    li.appendChild(cancelBtn);
    li.appendChild(deleteBtn);

    return li;
  }
};

// ---------------------------------------------------------------------------
// QuickLinksModule
// Manages a persistent list of named URL shortcuts.
//
// DOM targets (must exist in index.html):
//   #link-label-input    — text input for the link's display name
//   #link-url-input      — text input for the link's URL
//   #link-add-btn        — button that triggers addLink
//   #link-validation     — inline validation error <span>
//   #quick-links-error   — storage error banner <div> (hidden by default)
//   #links-container     — <div> where link buttons are rendered
//
// Storage key used:
//   tdl_links — Link[] (array of Link objects)
//
// Link shape:
//   { id: string, label: string, url: string }
//
// Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
// ---------------------------------------------------------------------------
var QuickLinksModule = {
  _links: [],
  _labelInputEl: null,
  _urlInputEl: null,
  _addBtnEl: null,
  _validationEl: null,
  _errorBannerEl: null,
  _containerEl: null,

  /**
   * _validateLink(label, url) → { valid: true } | { valid: false }
   * Pure function. Returns { valid: false } when ANY of the following is true:
   *   - label is empty or whitespace-only
   *   - url is empty or whitespace-only
   *   - label exceeds 100 characters
   *   - url does not start with "http://" or "https://"
   *   - url exceeds 2048 characters
   * Returns { valid: true } when all conditions pass.
   * Requirements: 6.3, 6.4
   */
  _validateLink: function (label, url) {
    if (typeof label !== 'string' || label.trim().length === 0) {
      return { valid: false };
    }
    if (typeof url !== 'string' || url.trim().length === 0) {
      return { valid: false };
    }
    if (label.trim().length > 100) {
      return { valid: false };
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { valid: false };
    }
    if (url.length > 2048) {
      return { valid: false };
    }
    return { valid: true };
  },

  /**
   * init() → void
   * Loads persisted links from StorageService, caches DOM references,
   * renders the list, and wires input event listeners.
   * Requirements: 6.1, 6.2
   */
  init: function () {
    this._labelInputEl  = document.getElementById('link-label-input');
    this._urlInputEl    = document.getElementById('link-url-input');
    this._addBtnEl      = document.getElementById('link-add-btn');
    this._validationEl  = document.getElementById('link-validation');
    this._errorBannerEl = document.getElementById('quick-links-error');
    this._containerEl   = document.getElementById('links-container');

    var stored = StorageService.get('tdl_links');
    this._links = Array.isArray(stored) ? stored : [];

    this._render();

    var self = this;

    if (this._addBtnEl) {
      this._addBtnEl.addEventListener('click', function () {
        var label = self._labelInputEl ? self._labelInputEl.value : '';
        var url   = self._urlInputEl   ? self._urlInputEl.value   : '';
        var added = self.addLink(label, url);
        if (added) {
          if (self._labelInputEl) self._labelInputEl.value = '';
          if (self._urlInputEl)   self._urlInputEl.value   = '';
        }
      });
    }

    // Clear validation error while user edits either input
    var clearValidation = function () {
      if (self._validationEl) {
        self._validationEl.style.display = 'none';
        self._validationEl.textContent = '';
      }
    };
    if (this._labelInputEl) this._labelInputEl.addEventListener('input', clearValidation);
    if (this._urlInputEl)   this._urlInputEl.addEventListener('input', clearValidation);
  },

  /**
   * addLink(label, url) → boolean
   * Validates, creates a Link object, persists, and re-renders.
   * Shows the validation span on failure; shows the error banner if
   * StorageService.set returns false. Returns true on success.
   * Requirements: 6.3, 6.4, 6.5, 6.6, 6.7
   */
  addLink: function (label, url) {
    var result = this._validateLink(label, url);
    if (!result.valid) {
      if (this._validationEl) {
        this._validationEl.textContent = 'Please enter a valid label (max 100 chars) and a URL starting with http:// or https:// (max 2048 chars).';
        this._validationEl.style.display = 'inline';
      }
      return false;
    }

    if (this._validationEl) {
      this._validationEl.style.display = 'none';
      this._validationEl.textContent = '';
    }

    var id;
    try {
      id = crypto.randomUUID();
    } catch (e) {
      id = Date.now().toString() + Math.random();
    }

    var link = { id: id, label: label.trim(), url: url.trim() };
    this._links.push(link);

    var ok = StorageService.set('tdl_links', this._links);
    if (!ok) {
      this._showErrorBanner();
    }

    this._render();
    return true;
  },

  /**
   * deleteLink(id) → void
   * Removes the link with the matching id, persists, and re-renders.
   * Shows the error banner if StorageService.set returns false.
   * Requirements: 6.5, 6.6, 6.8
   */
  deleteLink: function (id) {
    this._links = this._links.filter(function (l) { return l.id !== id; });

    var ok = StorageService.set('tdl_links', this._links);
    if (!ok) {
      this._showErrorBanner();
    }

    this._render();
  },

  /**
   * _render() → void
   * Rebuilds #links-container contents from the in-memory links array.
   * Requirements: 6.1, 6.2
   */
  _render: function () {
    if (!this._containerEl) return;
    this._containerEl.innerHTML = '';

    if (this._links.length === 0) {
      var placeholder = document.createElement('p');
      placeholder.id = 'links-empty';
      placeholder.textContent = 'No links yet.';
      this._containerEl.appendChild(placeholder);
      return;
    }

    for (var i = 0; i < this._links.length; i++) {
      this._containerEl.appendChild(this._createLinkElement(this._links[i]));
    }
  },

  /**
   * _createLinkElement(link) → HTMLDivElement
   * Returns a wrapper <div> containing an open button and a delete button.
   * Requirements: 6.5, 6.6, 6.8
   */
  _createLinkElement: function (link) {
    var self = this;

    var wrapper = document.createElement('div');
    wrapper.className = 'link-item';
    wrapper.dataset.id = link.id;

    var openBtn = document.createElement('button');
    openBtn.className = 'link-open-btn';
    openBtn.textContent = link.label;
    openBtn.addEventListener('click', function () {
      window.open(link.url, '_blank');
    });

    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'link-delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', function () {
      self.deleteLink(link.id);
    });

    wrapper.appendChild(openBtn);
    wrapper.appendChild(deleteBtn);

    return wrapper;
  },

  /**
   * _showErrorBanner() → void
   * Makes the #quick-links-error banner visible.
   */
  _showErrorBanner: function () {
    if (this._errorBannerEl) {
      this._errorBannerEl.style.display = 'block';
    }
  }
};

// ---------------------------------------------------------------------------
// ThemeModule
// Manages light / dark theme selection, persisted to localStorage.
//
// DOM targets (must exist in index.html):
//   #theme-toggle — button that toggles between light and dark
//
// Storage key used:
//   tdl_theme — "light" | "dark"
//
// Theme is applied by setting the `data-theme` attribute on <html>.
// CSS uses [data-theme="dark"] selectors for dark-mode overrides.
//
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.7
// ---------------------------------------------------------------------------
var ThemeModule = {
  _toggleEl: null,

  /**
   * _normalise(raw) → "light" | "dark"
   * Pure function. Returns "dark" only when raw === "dark"; any other value
   * (including undefined, null, or an unrecognised string) returns "light".
   * Requirements: 7.3, 7.4
   */
  _normalise: function (raw) {
    return raw === 'dark' ? 'dark' : 'light';
  },

  /**
   * init() → void
   * Reads the persisted theme from StorageService, normalises it, and
   * applies it. Caches the toggle button DOM reference and wires its
   * click handler.
   * Requirements: 7.2, 7.3
   */
  init: function () {
    this._toggleEl = document.getElementById('theme-toggle');

    var stored = StorageService.get('tdl_theme');
    var theme = this._normalise(stored);
    this._apply(theme);

    var self = this;
    if (this._toggleEl) {
      this._toggleEl.addEventListener('click', function () {
        self.toggle();
      });
    }
  },

  /**
   * toggle() → void
   * Reads the current data-theme attribute, flips it, persists the new
   * value, and applies it.
   * Requirements: 7.1, 7.4
   */
  toggle: function () {
    var current = this._normalise(document.documentElement.getAttribute('data-theme'));
    var next = current === 'dark' ? 'light' : 'dark';
    StorageService.set('tdl_theme', next);
    this._apply(next);
  },

  /**
   * _apply(theme) → void
   * Sets the data-theme attribute on <html> and updates the toggle button
   * label to reflect the active theme.
   * Requirements: 7.7
   */
  _apply: function (theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (this._toggleEl) {
      this._toggleEl.textContent = theme === 'dark' ? '☀ Light Mode' : '🌙 Dark Mode';
      this._toggleEl.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }
};

// ---------------------------------------------------------------------------
// SettingsModule
// Owns the settings panel overlay. Provides inputs for the Display Name and
// the Pomodoro Duration, persisting both via StorageService and delegating
// the timer duration change to TimerModule.
//
// DOM targets (must exist in index.html):
//   #settings-open             — header button that opens the panel
//   #settings-panel             — the overlay <div> (hidden by default)
//   #settings-display-name      — text input for the Display Name
//   #settings-name-error        — inline error <span> for the Display Name
//   #settings-pomo-duration     — number input for the Pomodoro Duration
//   #settings-duration-error    — inline validation error <span> for duration
//   #settings-duration-deferred — inline notice <span> shown when a duration
//                                  change is deferred (timer running/paused)
//   #settings-save              — Save button
//   #settings-close             — Close button
//
// Storage keys used:
//   tdl_displayName  — string  (GreetingModule / SettingsModule)
//   tdl_pomoDuration — number  (TimerModule / SettingsModule)
//
// Requirements: 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.6
// ---------------------------------------------------------------------------
var SettingsModule = {
  _openBtnEl: null,
  _panelEl: null,
  _nameInputEl: null,
  _nameErrorEl: null,
  _durationInputEl: null,
  _durationErrorEl: null,
  _durationDeferredEl: null,
  _saveBtnEl: null,
  _closeBtnEl: null,

  /**
   * _readStoredDuration() → number
   * Pure helper. Reads tdl_pomoDuration from StorageService and validates it
   * is a whole number between 1 and 120. Returns the stored value when
   * valid, otherwise returns the default of 25.
   * Requirements: 4.5
   */
  _readStoredDuration: function () {
    var stored = StorageService.get('tdl_pomoDuration');
    if (
      stored !== null &&
      typeof stored === 'number' &&
      Number.isInteger(stored) &&
      stored >= 1 &&
      stored <= 120
    ) {
      return stored;
    }
    return 25;
  },

  /**
   * init() → void
   * Caches DOM references, populates the fields from StorageService, and
   * wires the open/close/save event handlers. Inline error/notice spans are
   * cleared when the user edits the corresponding input.
   * Requirements: 2.4, 4.4
   */
  init: function () {
    this._openBtnEl          = document.getElementById('settings-open');
    this._panelEl            = document.getElementById('settings-panel');
    this._nameInputEl        = document.getElementById('settings-display-name');
    this._nameErrorEl        = document.getElementById('settings-name-error');
    this._durationInputEl    = document.getElementById('settings-pomo-duration');
    this._durationErrorEl    = document.getElementById('settings-duration-error');
    this._durationDeferredEl = document.getElementById('settings-duration-deferred');
    this._saveBtnEl          = document.getElementById('settings-save');
    this._closeBtnEl         = document.getElementById('settings-close');

    // Populate fields with the current saved state.
    if (this._nameInputEl) {
      this._nameInputEl.value = StorageService.get('tdl_displayName') || '';
    }
    if (this._durationInputEl) {
      this._durationInputEl.value = this._readStoredDuration();
    }

    var self = this;

    if (this._openBtnEl) {
      this._openBtnEl.addEventListener('click', function () { self.open(); });
    }
    if (this._closeBtnEl) {
      this._closeBtnEl.addEventListener('click', function () { self.close(); });
    }
    if (this._saveBtnEl) {
      this._saveBtnEl.addEventListener('click', function () {
        var name = self._nameInputEl ? self._nameInputEl.value : '';
        var duration = self._durationInputEl ? self._durationInputEl.value : '';
        self._saveDisplayName(name);
        self._savePomoDuration(duration);
      });
    }

    // Clear inline errors (and the deferred notice) while the user edits.
    if (this._nameInputEl) {
      this._nameInputEl.addEventListener('input', function () {
        if (self._nameErrorEl) {
          self._nameErrorEl.style.display = 'none';
          self._nameErrorEl.textContent = '';
        }
      });
    }
    if (this._durationInputEl) {
      this._durationInputEl.addEventListener('input', function () {
        if (self._durationErrorEl) {
          self._durationErrorEl.style.display = 'none';
          self._durationErrorEl.textContent = '';
        }
        if (self._durationDeferredEl) {
          self._durationDeferredEl.style.display = 'none';
          self._durationDeferredEl.textContent = '';
        }
      });
    }
  },

  /**
   * open() → void
   * Shows the panel and refreshes the field values from StorageService so the
   * panel reflects the current saved state. Clears any stale inline messages.
   * Requirements: 2.2, 4.1
   */
  open: function () {
    if (this._nameInputEl) {
      this._nameInputEl.value = StorageService.get('tdl_displayName') || '';
    }
    if (this._durationInputEl) {
      this._durationInputEl.value = this._readStoredDuration();
    }
    this._clearMessages();
    if (this._panelEl) {
      this._panelEl.style.display = 'block';
    }
  },

  /**
   * close() → void
   * Hides the panel and clears any inline error messages.
   */
  close: function () {
    if (this._panelEl) {
      this._panelEl.style.display = 'none';
    }
    this._clearMessages();
  },

  /**
   * _clearMessages() → void
   * Hides and empties the inline error spans and the deferred notice.
   */
  _clearMessages: function () {
    if (this._nameErrorEl) {
      this._nameErrorEl.style.display = 'none';
      this._nameErrorEl.textContent = '';
    }
    if (this._durationErrorEl) {
      this._durationErrorEl.style.display = 'none';
      this._durationErrorEl.textContent = '';
    }
    if (this._durationDeferredEl) {
      this._durationDeferredEl.style.display = 'none';
      this._durationDeferredEl.textContent = '';
    }
  },

  /**
   * _saveDisplayName(value) → void
   * Trims the value. An empty/whitespace-only value persists "" and renders
   * the greeting with no name suffix. A non-empty value persists the trimmed
   * name and renders it. If StorageService.set returns false (storage
   * unavailable), shows an inline storage error and retains the previously
   * displayed name in the greeting widget (does not call render).
   * Requirements: 2.2, 2.3, 2.4, 2.5
   */
  _saveDisplayName: function (value) {
    var trimmed = (typeof value === 'string') ? value.trim() : '';
    var ok = StorageService.set('tdl_displayName', trimmed);
    if (!ok) {
      if (this._nameErrorEl) {
        this._nameErrorEl.textContent = 'Could not save the name — storage may be full or unavailable.';
        this._nameErrorEl.style.display = 'inline';
      }
      // Retain the previously displayed name; do not call GreetingModule.render.
      return;
    }
    if (this._nameErrorEl) {
      this._nameErrorEl.style.display = 'none';
      this._nameErrorEl.textContent = '';
    }
    GreetingModule.render(trimmed);
  },

  /**
   * _savePomoDuration(value) → void
   * Parses the value as a number. If it is not a whole number or is outside
   * 1–120, shows an inline validation error and returns without saving.
   * Otherwise clears the error, persists the value via StorageService, and
   * delegates the duration change to TimerModule.applyNewDuration. When the
   * timer is running or paused the change is deferred; a notice is surfaced
   * in the panel to mirror TimerModule's #timer-deferred-notice banner.
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6
   */
  _savePomoDuration: function (value) {
    var num = Number(value);
    if (
      value === '' ||
      !Number.isFinite(num) ||
      !Number.isInteger(num) ||
      num < 1 ||
      num > 120
    ) {
      if (this._durationErrorEl) {
        this._durationErrorEl.textContent = 'Pomodoro duration must be a whole number between 1 and 120.';
        this._durationErrorEl.style.display = 'inline';
      }
      return;
    }

    if (this._durationErrorEl) {
      this._durationErrorEl.style.display = 'none';
      this._durationErrorEl.textContent = '';
    }

    // Determine whether the change is deferred before delegating, since
    // applyNewDuration may call reset() (transitioning IDLE/DONE → IDLE).
    var deferred = TimerModule._state === 'RUNNING' || TimerModule._state === 'PAUSED';

    StorageService.set('tdl_pomoDuration', num);
    TimerModule.applyNewDuration(num);

    if (this._durationDeferredEl) {
      if (deferred) {
        this._durationDeferredEl.textContent = 'Duration change will apply after the current session ends.';
        this._durationDeferredEl.style.display = 'inline';
      } else {
        this._durationDeferredEl.style.display = 'none';
        this._durationDeferredEl.textContent = '';
      }
    }
  }
};

// ---------------------------------------------------------------------------

function init() {
  ThemeModule.init();
  GreetingModule.init();
  TimerModule.init();
  TaskModule.init();
  QuickLinksModule.init();
  SettingsModule.init();
}

document.addEventListener('DOMContentLoaded', init);
