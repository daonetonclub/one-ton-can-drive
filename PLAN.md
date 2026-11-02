# One Ton Can Drive: Plan

This file is the source of truth for what we are building. It wins over the spec and the mockup. Decisions and their reasons are in `DECISIONS.md`.

## 1. The Google Sheet

Private. Owned by the club Google account. Only club organizers can open it. The website never reads it directly; Apps Script does.

### Roster tab

One row per person who can donate.

| Column | What it holds |
|---|---|
| `id` | A code that never changes: `S001`... for students, `F001`... for faculty and staff. Students never see it. |
| `name` | First and last name, as shown on the site. |
| `grade` | Bare number: 9, 10, 11 or 12. Blank for faculty. |
| `advisory` | Advisor's last name, spelled exactly the same everywhere. Blank for faculty. |
| `email` | School email. Never leaves the Sheet. |
| `type` | `student` or `faculty`. |
| `first_emailed` | Date the one-time first-donation email was sent. Blank means not yet emailed. |

Until Phase 5 this tab holds a fake 20-person roster. The real roster goes into the Sheet only, never into code or GitHub.

### Donations tab

One row per donation. The site only adds rows; it never edits or deletes one. Organizers fix mistakes by hand.

| Column | What it holds |
|---|---|
| `timestamp` | When it was logged. |
| `person_id` | The Roster `id`. This is what every board counts by. |
| `name` | Copy of the name, so a human can read the row. |
| `cans` | Whole number, 1 to 50. |
| `source` | `student`, `faculty` or `pool`. |
| `note` | Why a row was changed by hand. |
| `flag` | Set automatically for 25+ cans, or three or more entries from one person within ten minutes. |
| `reviewed` | Ticked by an organizer once a flagged row has been checked. Changes no numbers. |

Flagged rows turn red with conditional formatting. This tab is the organizer view.

### Config tab

Settings changed without touching code.

| Setting | Starting value |
|---|---|
| Start date | 19 January 2027 |
| End date | 4 March 2027 |
| Goal | 2,000 lb |
| Milestones | 500, 1,000, 1,500, 2,000 |
| Pounds per can | 1 (correct after the food bank weighs the first pickup) |
| Full names | Off (first name + last initial) until written approval |
| First-donation email | Off until the technology office approves |
| Bin locations | To be decided with facilities, December |

### Contests tab

One row per contest. Adding a contest means adding a row; no code change. The main boards (grades, advisories, top students, faculty) always show. Each contest gets its own separate board, shown only while it is running.

| Column | What it holds |
|---|---|
| `name` | What students see, e.g. "Most cans this week". |
| `start` | First day counted. |
| `end` | Last day counted. |
| `scope` | What competes: `student`, `advisory` or `grade`. |
| `filter` | Who is in it, e.g. `all` or `9,10`. |
| `description` | One line shown under the contest name. |

Every contest board is the same `standings(scope, startDate, endDate, filter)` call. Because every donation has a timestamp, a contest can even be added after the fact.
