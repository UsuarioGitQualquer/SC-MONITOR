SC MONITOR - VERSION 5.0
========================================================================

       Local audience, chat, tips, goals, and moderation dashboard

                              for Stripchat
========================================================================

SC Monitor is a Chromium browser extension that monitors activity in
Stripchat rooms in real time. Data is processed and stored locally in the
browser. Version 5.0 improves data stability during long broadcasts and
expands analysis with heatmaps, audience efficiency, league engagement, and
a combined goals-and-shows timeline.


------------------------------------------------------------------------
📌 VERSION 5.0 HIGHLIGHTS AND FEATURES
------------------------------------------------------------------------

WEEKDAY COMPARISONS AND TRANSPARENT METRICS

   - Period reports compare average tokens, average viewers, and peak viewers
     by weekday, counting only days with saved history.

   - Average audience shows how many samples were collected during monitoring;
     audience categories may overlap.

   - Show token values are estimates based on the player state and configured
     rates; they are not payment confirmations.

   - The suspected-user list considers the current visit observed in the user
     list and excludes messages and tokens from before that visit. When
     monitoring of an offline room ends, open visits are finalized.

   - Menu and roulette events are read from events and messages displayed in
     chat. Monitoring does not read iframe parameters.


1. ACCUMULATING ROOM-GOAL HISTORY

   - Protection against DOM re-renders and chat-tab changes.

   - A smart merge accumulator preserves session goal history even when goals
     leave the visible chat area or the room enters ticket/offline mode.

   - Goal statuses (Pending, Completed, Interrupted) are preserved, and
     completed goals are automatically added to the to-do list.


2. TO-DO LIST AND QUICK COPY

   - Requests are automatically added from the Tip Menu, plugin/roulette
     results, Fan Club, and completed goals.

   - The panel displays each item with its time [HH:MM:SS], user, and source.

   - The new "📋 Copy Pending" button copies only unfinished tasks to the
     clipboard in a clean, chained format:

     description (@username) -> description (@anotheruser).


3. SHOW ACCOUNTING (PRIVATE, EXCLUSIVE, GROUP, AND TICKET)

   - Charges and records are created immediately when a show starts, followed
     by accurate cycles for every 60 active seconds.

   - Group Show amounts are calculated dynamically from the per-minute rate
     and the number of participants watching.

   - Ticket Shows are classified using DOM data, the advertised price, and
     confirmation that the user entered.


4. SUSPECTED VIEWER / BOT DETECTION

   - Behavioral analysis combines time spent without interaction, league and
     level (with a focus on Gray accounts at level 9 or below), numeric or
     generic username patterns, and synchronized departures/returns during
     restricted shows.


5. ANALYTICS DASHBOARDS (ACTIVE SESSION AND DAILY SUMMARY)

   - 📊 Active Session Analytics provides real-time viewer peaks and
     averages, effective activity, tokens, and retention.

   - Today's Retention shows new and returning users and the return
     percentage. Users whose first-visit date is unknown are classified as
     returning; they are not assumed to be new.

   - Effective activity is net live-broadcast time divided by total monitored
     time. Pace estimates tokens per net hour of the session.

   - 📅 Daily Summary (Today) combines all broadcasts from the day, including
     tokens, the highest viewer peak, and user and league statistics.

   - Token Flow can use 5-, 10-, or 30-minute blocks, or 1-hour blocks.
     Differences between the daily total and per-minute records are included
     in the current block; the tooltip identifies tokens with no recorded
     timestamp. Day reports show untimed tokens separately rather than
     artificially distributing them across intervals.
     The session dashboard also shows the average flow of listed users in
     2-minute blocks, updated every 2 minutes.

   - The Users tab shows separate areas for each league and a line for total
     listed users, in 2-minute blocks. The room's viewer peak remains in the
     header; viewers without a visible username are not included in the listed
     user count.


6. EVENTS AND SUMMARIES BY SESSION OR DAY

   - The Events table and summary cards can switch between current-session
     data and data accumulated for the day.

   - The Session/Day selector updates the event list, consolidated
     per-item summary, earnings-by-type chart, and user ranking together.

   - All, Tips, Menu, and Goals/Shows filters remain available. Menu limits
     the list to menu/request events; Goals/Shows includes epic goals, shows,
     and tickets.

   - Events are separated by local date (Brasilia time), preventing records
     from a previous day from appearing in today's summary.


7. AUTOMATIC MODERATION AND MUTED-USER TRACKING

   - Prohibited keywords can be dynamically registered for each model as tags.

   - The extension can attempt to mute a user through a confirmation dialog
     and keeps a complete history (PENDING, SUCCESS, or FAILURE).

   - Muted users are robustly detected in chat (.user-muted-message), with
     the author, moderator, and most recently captured message recorded.


8. TIME TRACKING AND FLOATING INTERFACE

   - Independent timers track total elapsed time and net active time.

   - In Monitor Room mode, an offline-room indication waits for 2 minutes and
     is extended by new messages before monitoring ends.

   - The panel can be dragged by its header or inner bottom bar, which shows
     the date and logo. Its size can be adjusted from all four corners. The
     panel can be pinned and offers automatic collection by switching between
     the chat and users tabs.

   - The extension icon displays the model's avatar while monitoring is active.


9. EXPORTS AND LOCAL HISTORY

   - Export complete user, visit, time, and token reports in CSV format.

   - Detailed reports are available on a dedicated extension page, opened from
     the popup or panel. Period reports also show daily changes in new and
     returning users when that data was saved. The current room king for each
     day is also recorded and shown in daily and period summaries.

   - Chart intervals are selected automatically based on the recorded
     duration:
     up to 9 min: 1 min; 10–29 min: 2 min; 30–59 min: 5 min; 1h–1h39: 10 min;
     1h40–2h59: 20 min; 3h–4h59: 30 min; 5h or more: 1 hour.

   - Period reports also include a day/hour heatmap, activity and moderation
     timeline, user engagement, audience efficiency, league contributions,
     and a combined goals-and-shows history.

   HOW TO READ THE REPORT CHARTS

   - The page offers three views: Day, Session, and Period. Choose a model/room
     and the available data. For a period report, set the date range and group
     results by day, week, or month. You can also compare two periods.

   - In Day and Session reports, the combined chart shows tokens per interval
     alongside audience changes. The daily report marks recorded shows. Flow
     charts break down tokens and listed users; choose a block size or use Auto
     to adjust it to the recorded duration. Tokens without a timestamp are
     shown separately and are not artificially assigned to blocks.

   - The daily report's audience charts and metrics show retention, user
     peaks/averages, and league distribution. Earnings composition groups
     tokens by category. Performance charts compare duration and tokens across
     the day's live sessions. Rankings show top individual tips, menu options,
     and recorded roulette results. Tables also show sessions, tippers,
     suspected users, and muted users when data is available.

   - The Session report's combined chart shows audience and earnings over the
     selected live's intervals. It also includes token and listed-user flow,
     earnings by category, and a table of key differences when another session
     is selected for comparison.

   - In Period reports, "Earnings by date/week/month" sums tokens in each
     grouping. "Tokens by hour" combines records from the same hour across the
     period; "Average tokens by hour" divides that total by active days. Pace
     charts use tokens per net live hour (tk/h). "Largest tip" shows the
     maximum tip in each grouping, not the sum of tips.

   - Audience charts include daily viewer peaks and averages, hourly averages,
     and averages of listed users and users with tokens by hour, date, and
     weekday. Hourly audience and user averages are weighted by recorded
     samples; date and weekday averages use days with data. The hourly peak of
     users with tokens is the highest count observed in that hour, not an
     average.

   - Live charts show active-day frequency, gross and net duration, tokens,
     and pace per live. New/returning-user and tipper charts show changes by
     grouping; in tipper series, the same person may appear on multiple days.
     Period comparisons show average tokens and, when available, average
     viewers.

   - The heatmap organizes tokens by weekday and hour; color intensity
     represents tokens, and its tooltip also shows events and average viewers.
     The timeline separates events from moderation by hour. Engagement,
     league, tipper, and room-king tables complement the charts with
     individual or aggregate metrics.

   - Suspected-bot and muted-user charts count distinct users in each interval;
     they are not a cumulative count of unique people across the entire
     period. A bot suspicion is heuristic, not confirmation. Charts may be
     empty when no records were saved; missing values do not necessarily mean
     there was zero activity.

   - Each goal or show in the period timeline can be deleted individually.
     The action requires confirmation, removes the record from history, and
     does not recalculate aggregate metrics. Monitoring for that model must
     be paused before deletion.

   - Daily and period reports show the conversion of new and returning users
     into tippers when complete data is available. In period reports,
     returning users are counted by day, so the same person may appear on
     multiple days.

   - To validate the room-king total, the site value is retained until it
     matches the sum of tips captured in chat; after confirmation, the report
     follows the chat total. If the threshold for becoming king appears
     before the name, the system identifies the person who reached it. This
     history starts with this version and stores only the most recently
     observed king for each day.

   - Full or model-specific JSON backups are available in the panel and on
     the reports page, with validation, preview, confirmation, and a 25 MiB
     limit. A model-specific restore replaces that model's data and preserves
     the others, including in shared history. Older backups are still
     recognized as full backups; a limited backup cannot be used as a full
     restore.

   - History is stored in the extension's IndexedDB, which is better suited
     to larger data volumes than the browser's key/value storage.

   - IndexedDB usage shown on the History tab is an estimate of the serialized
     data size; the actual space used by the browser may differ.

   - Restore checks all open Stripchat tabs; pause monitoring before
     importing. A full restore replaces SC Monitor's local data, so export a
     current backup before restoring another file. Keep exported files
     outside the browser to avoid losing them if the extension is uninstalled.

   - Context is automatically isolated when navigating between rooms (SPA).


------------------------------------------------------------------------
📖 PANEL TABS AND CONTROLS
------------------------------------------------------------------------

TABS

   - 📊 General: shows the room and monitoring status, session and daily
     tokens, total and net time, viewers, and Fan Club/show rate settings.
     Show values are estimates.

   - 👥 Users: shows audience counts, new and returning users, leagues, the
     listed-user chart, and the user list with tokens, tips, and messages.
     Filters show everyone, new users, or returning users. It also shows
     suspected viewers according to heuristic criteria; this does not confirm
     that an account is a bot.

   - 💰 Events: brings together captured events such as tips, content
     purchases, menu items, goals, and shows. Filters separate all events,
     tips, menu, and goals/shows. It includes to-do items generated from
     requests and room goals; click a task to mark it complete.

   - 🛡️ Moderation: lets you register prohibited words and phrases and review
     moderated messages and muted users. The extension can attempt to mute
     identified messages; check the history to see the result.

   - 🗂️ History: lists rooms/models and saved daily data, with actions for
     those records. It also supports full or model-specific backup export and
     import. Pause monitoring in every open tab before restoring.

   - 📑 Report: compares session, daily, or period data. Select the room and
     dates to view charts and metrics; use "Page" to open detailed reports.
     "Copy Summary" and "CSV" export data from the selected report.


PANEL CONTROLS

   - Language: choose Português (Brasil), Español, or English in the panel
     header or on the reports page. The preference is applied to open
     interfaces.

   - Monitor / Pause Monitor: manually starts or ends collection for the
     current session. Pausing ends and saves the session; it does not delete
     daily history.

   - Automatic Collection: while monitoring is active, switches between the
     chat and users tabs about every 12 seconds to update events and the user
     list, then returns to chat. It does not start monitoring on its own.

   - Monitor Room (OFF ⇄ ON): automatically follows the open room. Collection
     starts when a live broadcast is detected and ends after 2 minutes
     offline without new chat messages. Messages extend the wait; returning
     live cancels the stop. Navigating to another room ends collection for the
     monitored room. Turning this option off disables automation but does not
     pause a session that is already being monitored; use "Pause Monitor".

   - Pin: keeps the panel open when clicking outside it. Use "Close" to close
     the panel.

   - Move and resize: drag the panel by its header or bottom bar. Resize it by
     dragging any of the four corners.

   - Refresh: requests a new read of data available on the page. Save stores
     local data at that moment. CSV exports spreadsheet data; "Clear Session"
     resets the current session's data.


------------------------------------------------------------------------
📂 PROJECT STRUCTURE
------------------------------------------------------------------------

```text
site_monitor/

├── manifest.json            # Chromium Manifest V3 extension configuration (v5.0)
├── README.txt               # Official project documentation
├── README.en.md             # English documentation
├── README.es.md             # Spanish documentation
├── reports.html             # Dedicated reports page
├── reports.css              # Reports page styles
├── popup/
│   ├── popup.html           # Simplified browser-toolbar popup
│   ├── popup.css            # Popup styles
│   └── popup.js             # Connects the popup to the active tab
├── src/
│   ├── content.js           # Monitoring, session, and SPA navigation orchestration
│   ├── background.js        # Service worker, IndexedDB, backups, and per-tab icon
│   ├── core/
│   │   ├── state.js         # In-memory global state and metrics
│   │   ├── persistence.js   # Saving, consolidation, and daily history
│   │   ├── configuration.js # Startup defaults and temporary-option cleanup
│   │   ├── backup.js        # JSON backup validation and format
│   │   ├── room-king.js     # Reconciles current king with site and chat values
│   │   ├── storage.js       # Storage interface through the service worker
│   │   └── ui-refresh.js    # UI updates decoupled from domain modules
│   ├── modules/
│   │   ├── auto-collector.js # Tab switching and automatic collection cycle
│   │   ├── events.js        # Reads messages, tips, plugins, and shows
│   │   ├── moderation.js    # Keyword checking and filtering engine
│   │   └── parsers.js       # DOM extractors for goals, king, users, and leagues
│   ├── ui/
│   │   ├── panel.js         # Panel navigation, state, and orchestration
│   │   ├── panel-events-controller.js # Events tab summaries, filters, and data
│   │   ├── panel-report-controller.js # Report tab state and integration
│   │   ├── panel-report-workspace.js # Loads and renders reports in the panel
│   │   ├── panel-report-controls.js # Report tab controls and selectors
│   │   ├── panel-template.js # Panel HTML markup
│   │   ├── panel-resize.js  # Four-corner resize calculations
│   │   ├── open-reports.js  # Opens the dedicated reports page
│   │   ├── chart-data.js    # Time-series normalization and aggregation
│   │   ├── reports-page.js  # Report controls and loading
│   │   ├── reports-view.js  # Detailed report rendering
│   │   ├── report-charts.js # Charts and report granularity controls
│   │   ├── report-data.js   # Time aggregation and report metrics
│   │   ├── history/
│   │   │   └── history-table.js # History table rendering
│   │   ├── users/
│   │   │   └── users-table.js # User table rendering and filters
│   │   ├── todos/
│   │   │   └── todo-list.js # Task rendering and formatting
│   │   ├── moderation/
│   │   │   └── moderation-view.js # Moderation list rendering
│   │   ├── dashboard/
│   │   │   ├── basic-charts.js # Dashboard SVG charts
│   │   │   ├── daily-stats.js # Daily summary markers
│   │   │   └── event-summary.js # Event summary rendering
│   │   └── export/
│   │       └── csv-export.js # CSV report generation and download
│   └── utils/
│       └── helpers.js       # Utilities (string sanitizers, formatters)
└── tests/                   # Regression tests using the native Node.js runner
```


REGRESSION TESTS

   - Requires Node.js 18 or later. Run `npm test` from the project root.
   - Tests use the native Node.js runner and add no third-party dependencies.
   - The suite covers storage and backups, persistence, reports, event
     collection, room-king history, and panel resizing.


------------------------------------------------------------------------
⚙️ INSTALLING / UPDATING IN GOOGLE CHROME / BRAVE / EDGE
------------------------------------------------------------------------

NOTICE: The extension has not been tested with a model account. We recommend
using Stripchat with a regular viewer account.

The extension can be used while logged out, but it may not read Ticket Show
events correctly. When logged out, the ticket price may appear in dollars
instead of tokens.

Download the source from GitHub:

   Repository: `https://github.com/UsuarioGitQualquer/SC-MONITOR`

   - GitHub CLI:
     `gh repo clone UsuarioGitQualquer/SC-MONITOR`

   - Git:
     `git clone https://github.com/UsuarioGitQualquer/SC-MONITOR.git`

   - Download as ZIP in a browser:
     Open `https://github.com/UsuarioGitQualquer/SC-MONITOR`, choose
     Code > Download ZIP, and extract the file.

   - Download and extract as ZIP from PowerShell (main branch):
     `$repo = "https://github.com/UsuarioGitQualquer/SC-MONITOR"`
     `$zip = "$HOME\Downloads\SC-Monitor.zip"`
     `Invoke-WebRequest -Uri "$repo/archive/refs/heads/main.zip" -OutFile $zip`
     `Expand-Archive -Path $zip -DestinationPath "$HOME\Downloads\SC-Monitor-source"`

   After cloning or extracting, select the project root containing
   `manifest.json` when choosing "Load unpacked".

1. Open the browser's extensions page:
   - Chrome or Brave: `chrome://extensions/`
   - Edge: `edge://extensions/`

2. Turn on "Developer mode" in the upper-right corner.

3. Choose the appropriate procedure:
   - NEW INSTALLATION: click "Load unpacked" in the upper-left corner and
     select the project root folder containing `manifest.json`.
   - UPDATE: find SC Monitor in the extensions list and click the reload
     icon (↻) on its card.

4. Open a Stripchat broadcast page and click the 📊 extension icon. If the
   extension was updated while the room was already open, opening its popup
   attempts to reconnect the panel automatically without reloading the page.


Allow use in Incognito windows (optional):

   - On the extensions page (`chrome://extensions/`), find the SC Monitor
     card and click "Details".
   - Scroll down to "Allow in incognito".
   - Turn on the option to allow the extension on Stripchat pages opened in
     an Incognito window.


------------------------------------------------------------------------
🔒 PRIVACY AND SECURITY
------------------------------------------------------------------------

   - All message processing, token counting, and data collection happen
     strictly in your browser (client-side).

   - History is stored in the extension's local IndexedDB database, with
     increased quota through `unlimitedStorage`. Data stays in the browser;
     keep external backups.

   - Model, viewer, and chat information is not sent to external servers.

   - While monitoring is active, the model's avatar is loaded from
     Stripchat's CDN for the tab icon; the image is not forwarded to other
     servers.

========================================================================
