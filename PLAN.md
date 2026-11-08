# One Ton Can Drive: Plan

This file is the source of truth for what we are building, and the living version of the spec. It wins over the original spec PDF and the mockup, which are kept unchanged for reference. Decisions and their reasons are in `DECISIONS.md`. Every change to the plan is logged with a date in "What changed" at the bottom.

**Status:** Phases 1 to 3 done (7 November 2026). Phase 4: Find me, the faculty path and the hallway screen done (8 November 2026); the first-donation email and the "Give money" page are waiting on the school. Live: donation page https://daonetonclub.github.io/one-ton-can-drive/, leaderboard https://daonetonclub.github.io/one-ton-can-drive/leaderboard.html, hallway screen https://daonetonclub.github.io/one-ton-can-drive/leaderboard.html?tv=1. Next: Phase 5 (or the two waiting extras, if answers arrive first).

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

Each new donation is written directly under the last row that has a timestamp, and only that row gets a "reviewed" checkbox. (Checkboxes on empty rows make Google treat them as used, which pushed early test donations below row 1,000.) The Sheet's time zone is Eastern, the same as the program's.

### Config tab

Settings changed without touching code.

| Setting | Starting value |
|---|---|
| Start date | 19 January 2027. **While building, set to the day setup ran (7 November 2026) so test donations are accepted. Change to 19 January 2027 in Phase 6.** |
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

## 2. The donation flow

One QR code for the whole school, on every bin. It opens the donation page. No login.

### Screens

1. **Grade.** Four big buttons (9, 10, 11, 12). A smaller "Faculty and staff" link.
2. **Advisory.** The advisories in that grade.
3. **Name.** The people in that advisory, with a search box. Names come from the roster only; no typing a new name. Staff not on the list see "Not on the list? Tell the One Ton Club."
4. **Cans.** Number box, + and − buttons, quick values 1, 5, 10, 15, 20. Note: "50 cans max per entry. Brought more? Log it in two entries." Honesty line above the button: "Please count only what you actually brought." The box does not rewrite itself while typing; it tidies up when the student leaves it.
5. **Done.** "You're in." Rank before and after, how many people they passed, where their advisory now stands. A quiet "Something wrong with this entry?" link that opens a prefilled email to the organizers.

### Repeat donors

After the first donation the phone remembers grade, advisory and name (browser storage only). Next time the student lands straight on screen 4 with their name shown. That screen says "Use your own phone. It remembers you next time." and has a small "Not you? Change name" link that goes back to screen 1.

### Messages on the cans screen

| Situation | What happens |
|---|---|
| Empty box | Blocked: "How many cans?" Never logged as 1. |
| 20 to 50 | Confirm first: "20 cans, nice. Just checking, is that right?" with "Yes" and "Let me fix it". (Number matches what they typed.) |
| 25 to 50 | Same confirm; the row is also silently flagged. |
| Over 50 | Refused: "50 is the most you can log at once. Log 50 now and the rest as a second entry." |

### Before and after the drive

Dates come from the Config tab. Before the start date the donation form is replaced by "The drive starts January 19. See you then!" After the end date it is replaced by "The drive is over. Thank you! We collected [total] lb." The leaderboard stays visible either way. To extend the drive, change the end date cell in Config before the drive ends; the form, the pace line and the closing message all follow it.

### If saving fails

If the connection drops, the student sees "That didn't save. Your cans were not counted yet. Try again." The submit button is disabled while saving, so a double tap never makes two donations.

### First-donation email

Off until the technology office approves (Config switch, checked on the server against `first_emailed`, never a browser cookie). When on, it goes once per person, ever, after their first donation, and says only: "You've logged [cans] cans under the name [name]. If that wasn't you, email the One Ton Club." No confirm button, no other details. The Done screen shows a "check your school email" note only when the switch is on.

## 3. The leaderboard

Public and read-only. Works on a phone and a laptop. Every number is computed from the Donations tab; no total is ever stored. Standings are cached for 5 minutes.

- **Tracker** at the top of every view: progress toward the goal in pounds, milestone marks from Config, and the bar keeps going past the goal instead of stopping at 100%.
- **Pace line:** "[X] lb a day from here reaches [goal] by [end date]. Yesterday the school brought in [Y]." Turns amber when yesterday fell short. Follows the Config end date.
- **"Everyone brings five":** "There are [student count] of us. If everyone brings 5, we hit the ton." Computed from roster size and goal, never typed in. Counts students only.
- **Disclosure line** under the tracker: how much of the total came from faculty (and from the money pool, if any pool rows ever count).
- **Boards:** Grades, Advisories (with "7 of 12 have donated"), Top students (top 10), Faculty (separate; faculty never count on student, advisory or grade boards). If people are tied for 10th, everyone tied is shown, so the list can run past 10. Tapping a grade opens its advisories; tapping an advisory opens its students. The back link remembers the route.
- **Contest boards:** one per running contest, from the Contests tab.
- **Ranking:** ties share a place (standard competition ranking: 1, 2, 2, 4). "Move up" messages count to the next distinct total: "2 more cans puts you at #35, past 14 people."
- **Find me:** its own tab. Search finds any student or staff member, including those who haven't donated. Shows rank in advisory, grade and school, full donation history, and what it would take to move up.
- **Names:** first name + last initial unless the Config full-names switch is on. The switch applies everywhere, including Find me.

## 4. Extras

Built after the main donation page and leaderboard, in this order. Each is optional; if time runs out in December, stop where we are.

1. **Find me** (see section 3).
2. **Faculty path and faculty board.** The small "Faculty and staff" link on the grade screen, then pick your name from the faculty list. Faculty donations count toward the ton but only on the faculty board.
3. **First-donation email.** Only if the technology office approves (see section 2).
4. **Hallway screen** at `?tv=1` (decisions 21 and 22). The big number in pounds with the goal bar, then three short boards: all grades, the top 5 advisories and the top 5 students (ties included, at most 8 rows per list, then "+ N more tied at #5"). The date stamp reads "Standings as of Feb 14, day 27 of 45". Names follow the privacy switch. It never claims to update live, and doesn't refresh itself. Screenshot sent to the Learning Commons, expected weekly. Not linked anywhere; bookmark it.
5. **"Give money" page.** Only once the school confirms how money is collected. Links to the school's official page; never shows or collects payment details.

Not in version one: the `?admin=1` organizer page (the Sheet does this job), a participation leaderboard section, a share card, a recent-donations ticker, a weekly email to advisors, organizer bulk entry, typed-in names.

## 5. Phases

Each phase needs its tests passing, and Ben checking it on his phone, before the next one starts. The detailed "how" of each phase is planned at its start.

### Phase 1: back end
**Done 7 November 2026.**
- **Built:** the private Sheet (Roster with 20 fake people, Donations, Config, Contests) in the club Drive; clasp 3.4.1 connected to the club account; Apps Script functions getRoster, submitDonation, getLeaderboard and one `standings(scope, startDate, endDate, filter)`; the web app at one fixed address. Code is in `apps-script/`, tests in `tests/`.
- **How a donation is saved:** checks first (cans 1 to 50, person on the roster, inside the drive dates). Then only the write to the Donations tab is locked. "Before" and "after" ranks both come from one server call: "after" is the log as it stands, "before" is that log without this donation.
- **Tests passing:** 17 math tests (`npm test`): ties, "past 14 people", top 10 with ties, contests, cans limits, drive dates, flags. 4 live tests (`npm run test:live`): roster has no emails; 51 refused; unknown person refused; 20 donations at the same moment make exactly 20 rows (passed three times).
- **Not yet tested live:** refusal outside the drive dates (covered by the math tests). Do it in Phase 2.
- **Checked by Ben:** a donation sent from his phone through a web address appeared in the Donations tab.

### Phase 2: donation page
**Done 7 November 2026.**
- **Built:** the page in `docs/` (plain HTML, CSS and JavaScript), hosted on GitHub Pages from the `main` branch, `/docs` folder. Grade, advisory, name, cans and done screens; remembered person with "Not you? Change name"; the cans box; the "just checking" step at 20; the over-50 message; the failed-save message; closed messages before and after the drive. Mockup colours and fonts, no school logo.
- **Saving twice is impossible:** each save carries a one-time code. The server remembers codes for 10 minutes, so a retry after a dropped connection returns the first answer instead of logging the cans again.
- **Tests passing:** 13 browser tests in headless Chrome against a pretend server (`npm test`, with the 17 math tests): empty blocked, typing never rewritten, + and − and quick buttons, 51 refused, 20 asks to confirm with Yes and Let me fix it, a double tap sends one save, a failed save keeps the number and retries with the same code, the done screen, remember me and "Not you?", closed before and after the drive, no email address on the page. 5 live tests (`npm run test:live`), including "the same code twice makes one row".
- **Checked by Ben:** donated as a fake student on his phone, closed the tab, reopened the address and landed on the cans screen with that name. The Sheet had exactly one row for it.
- **Still not tested live:** refusal outside the drive dates (needs the Config start date moved for a minute).

### Phase 3: leaderboard
**Done 7 November 2026.**
- **Built:** `docs/leaderboard.html`. The tracker in pounds with Config milestone marks, and the bar keeps going past the goal. The pace line turns amber when yesterday fell short, and shows no "yesterday" on the first day. "There are N of us. If everyone brings X, we hit the ton." "Includes X lb from faculty and staff." Tabs for Grades, Advisories, Top students (top 10 plus everyone tied) and Faculty, plus one tab per running contest. Drill-down from grade to advisories to students, with the back link returning the same way. Refreshes every 2 minutes. Linked from the donation page header and its done screen.
- **Server:** the leaderboard math moved into one pure function, `buildLeaderboard` (`apps-script/Standings.js`), so every board can be tested offline. `getLeaderboard` reads the Sheet, calls it and caches for 5 minutes. The reply now includes every student's total for drill-down. Names go through the switch, and there are never emails.
- **Tests passing:** 11 known-answer tests for every board (`tests/leaderboard.test.js`), including a tie at #10, contests only inside their dates, the name switch both ways and pounds per can. 9 browser tests for the page (`tests/leaderboard-page.test.js`), including past-the-goal, amber, drill-down and back, contest tabs, no email or full name, and no sideways scrolling at phone width. 50 offline tests in all, plus 5 live.
- **Checked by Ben:** every board on his phone and a laptop matched the numbers read from the Sheet.
- **Not checked live yet:** a contest tab (the Contests tab is empty). Optional: add one row to see it.

### Phase 4: extras
In the order in section 4. Each extra was built, tested and checked by Ben before the next.
- **Find me: done 8 November 2026.** A Find me tab on the leaderboard searches every student and staff member, including people with nothing donated. The person card shows ranks in advisory, grade and school (staff: the faculty board), pounds so far, donation history, and "N more cans puts you at #X, past Y people." It opens on the person this browser remembers. Server: `personReport` in `apps-script/Standings.js` behind a new `person` action; the leaderboard reply adds the full staff list. Tests: 7 known-answer, 4 browser, 1 live (no emails). Ben checked a donor (Riley) and someone with nothing (Nova Nobody, added to the fake roster by Ben).
- **Faculty path: done 8 November 2026.** A "Faculty and staff" link under the grade buttons opens the staff list with search. The done screen says "on the faculty board" and shows no advisory. Staff are remembered like students. Tests: 2 browser. Ben logged cans as Pat T., saw #3 to #1 on the faculty board, and Find me opened on Pat.
- **First-donation email: waiting** on the technology office (Mr. Beck). Test when built: donate from a phone and a laptop under the same name and get exactly one email.
- **Hallway screen: done 8 November 2026.** Tests: 4 browser (boards, date stamp and day count, no full names, nothing claims to update live, fits 1920x1080 even with a 20-way tie, starts and final messages). Ben checked it on a laptop.
- **"Give money" page: waiting** on how the school collects money.

### Phase 5: real data and rehearsal (by about December 12)
- **Steps:** move the fake test donations and fake roster rows into an archive tab (never deleted); the real roster goes into the Sheet only; print the QR code and scan it across a room; dry run with 5 to 10 real students; fix what breaks; teach one other member to fix a row in the Sheet.
- **Tests:** search the GitHub code for any real student name or email and find none; a second dry run with no new problems.

### Phase 6: freeze (mid December)
- Fill in Config and Contests; print posters and bin signs; agree the screenshot routine with the Learning Commons. Bug fixes only after this, no new features.

## Still waiting on

- Roster file from the registrar (being checked with the technology office and the Dean's office).
- Technology office answer on the first-donation email and a da.org account.
- Written approval for full names (ask Ms. Soletro who gives it).
- How the school collects money (for the "Give money" page).
- How often the Learning Commons can swap the hallway screenshot.
- Bin locations (facilities, December) and the food bank partner (club vote, mid-November).

## What changed

Newest first. Every change to this plan gets a dated line here, saying what changed and why.

- **8 November 2026, Phase 4 (first three extras) finished.**
  - **Hallway screen changed** from one big number (decision 5) to the big number plus short boards for grades, top 5 advisories and top 5 students (decision 21). Ben asked for names, advisories and grades on it. Each list shows at most 8 rows, then "+ N more tied", so a big tie on launch day can't push it off the screen (decision 22).
  - **Fake roster is now 21 people:** Ben added S017 Nova Nobody (grade 9, Maple) to test Find me with someone who has donated nothing.
  - Find me's move-up line counts to the next distinct total, as everywhere else. A remembered person only reopens in the same browser that donated (browser storage is per browser).
  - GitHub Pages lets browsers keep a page for up to 10 minutes, so right after an update a reload may still show the old version. Ctrl+Shift+R (Cmd+Shift+R on a Mac) gets the new one.
  - The first-donation email and the "Give money" page were not built in this round. Both are waiting on answers from the school.

- **7 November 2026, Phase 3 finished.**
  - Two Config cells were wrong since setup and were repaired with a one-time `fixConfigCells`. **Milestones:** Sheets read "500,1000,1500,2000" as one big number, so setup now writes it as plain text ("500, 1000, 1500, 2000"). **End date:** it was written while the Sheet was on Pacific time and became March 3 when the Sheet moved to Eastern. It's back to 4 March 2027. The leaderboard found both.
  - The disclosure line shows faculty pounds only. Pool rows never count toward the total (spec), so "includes" would be wrong for them.
  - The pace line counts only donations inside the drive dates, and on the first day leaves out "yesterday" (and the amber colour), since there is no yesterday yet.
  - Inside a drill-down, grades, advisories and students are ranked within that list (ties still share a place).
  - Student and faculty contest boards show the top 10 plus ties. Advisory and grade contests show every row.

- **7 November 2026, Phase 2 finished.**
  - One-time save codes added (not in the original plan): the plan said a double tap must never make two donations. Disabling the button covers taps, but not a retry after the connection drops mid-save. The server now remembers each save's code for 10 minutes. No new Sheet column.
  - The "Faculty and staff" link is hidden until the faculty path is built in Phase 4, and "See the leaderboard" until Phase 3. Until then, faculty names are left out of the student name lists.
  - The done screen has a "Log more cans" button that goes back to the cans screen.
  - "Something wrong with this entry?" and "Not on the list?" open an email to daonetonclub@gmail.com.
  - The cans screen also says "Take cans out of the case first: every can counts as one." (from the spec's counting rule).
  - No Durham Academy logo, since the spec says it isn't approved. Colours and fonts only.
  - Advisory standings on the done screen are shown in pounds (decision 7); a student's own rank is by cans logged.

- **7 November 2026, Phase 1 finished.**
  - Saving a donation: the plan said read, write, read all inside the lock. With 20 people at once, the 2-second turns made later people wait too long, and 5 to 14 of 20 were told "try again". Now only the write is locked, and "before" is worked out from the log without the new donation. 20 at once now all save. Approved by Ben and Oren (decision 20).
  - Writing rows: Google's "add to the bottom" (appendRow) was replaced by writing under the last timestamped row, and checkboxes go only on donation rows. The first setup had put checkboxes on 1,000 empty rows, which pushed donations below row 1,000. A one-time `tidyDonations` repair moved all rows up; none were lost.
  - Config start date is set to the setup day while building, so tests can donate. It goes back to 19 January 2027 in Phase 6.
  - The review flag (25+ cans or rapid entries) is checked just before the lock, not inside it. It's a soft check, so this is fine.
  - The roster list follows the full-names switch too, so with it off even the name picker shows "Ben M.".
  - clasp: version 2.4.2's sign-in no longer works with Google, so the project uses clasp 3.4.1.
  - The Sheet's time zone is set to Eastern, to match the program.
  - Phase 5 now starts by moving test rows into an archive tab instead of deleting them.
- **2 November 2026, plan written.** Sections 1 to 5 from the spec, the mockup and decisions 1 to 19.

