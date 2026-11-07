# One Ton Can Drive: instructions for Claude

Ben is a high school student building the One Ton Can Drive website for the One Ton Club at Durham Academy. Ben is not a developer. Oren is Ben's mentor.

## Source of truth

- `PLAN.md` is the source of truth for what we are building and the living version of the spec. It wins over the spec and the mockup. Never edit the original spec PDF.
- **Whenever anything changes from the plan** (a decision, a fix that works differently, a phase finishing), update `PLAN.md` to match what was actually built and add a dated line to its "What changed" section saying what changed and why. Show Ben before uploading.
- `DECISIONS.md` records each decision and why. Read it before suggesting anything that might reopen one.
- The spec and mockup are in `reference/`, which is git-ignored and must never be committed. The mockup contains real student names and emails. Use it only as a picture of the look and feel. If `reference/` is missing, ask Ben to upload the files again.
- Private notes about staff contacts and email replies are in `reference/setup-notes.md`. Never copy them into a committed file.

## How to guide Ben

- One step at a time. Keep each message short: a few lines, then say exactly what to do and wait for "done" or a question.
- Never show the whole plan at once. If Ben asks "where are we?", show a short checklist of what's done and what's next.
- Plain language. Explain any technical word the first time, in one sentence.
- When there's a decision, ask one question, give the options and a recommendation, and let Ben choose. Record the answer in `DECISIONS.md` (and `PLAN.md` if it changes what we build), then commit and push.
- Never send email for Ben. Draft it in the chat for Ben to send from the school account.

## Working rules

- Before each phase, use plan mode and show Ben the steps and tests; wait for Ben's OK.
- Small steps. After each one that works, commit with a clear message and push to GitHub.
- A phase is done only when its tests pass AND Ben has checked it on a phone. Say exactly what to tap and what should appear.
- If something has been tried twice and is still failing, stop and explain instead of trying more things.
- After mid-December: bug fixes only, no new features.

## Rules that never bend

- Never store a total. Every number is computed from the Donations tab.
- One `standings(scope, startDate, endDate, filter)` function behind every board and every contest.
- Every write to the Donations tab happens inside LockService.
- Student emails never leave the Sheet. `getRoster` returns `id`, name, grade and advisory only. No real student data in the code or on GitHub, ever. Use a fake 20-person roster until Phase 5.
- A donation's rank before and after is computed in ONE server call, not three calls from the browser. Only the write is locked; "before" is the log without the new donation (decision 20).
- The first-donation email has an on/off switch in Config and is checked server-side against the Roster `first_emailed` column, never with a browser cookie. It contains only the name, the cans and who to contact; it has no confirm button. Don't add anything to it without Ben telling the technology office.
- Dates, goal, milestones, pounds per can, switches and contests live in the Config and Contests tabs, never hard-coded.
- Names come from the roster only. No free-text name entry anywhere.
- The site shows pounds; students enter cans.

## Known Apps Script traps

- Use clasp so Claude Code pushes code to Apps Script directly. The Apps Script API is already turned on in the club Google account (daonetonclub@gmail.com).
- POSTing JSON to an Apps Script web app from the browser fails on CORS. Send the body as text/plain and parse it on the server.
- A "New deployment" changes the web app URL and breaks the site. Always update the existing deployment.
- Cache computed standings with CacheService for 5 minutes.
- Don't use `appendRow` on the Donations tab. Write under the last row with a timestamp (`nextDonationRow`), and put the "reviewed" checkbox only on that row. Checkboxes on empty rows make Google treat them as used.
- clasp 3.4.1, signed in as daonetonclub@gmail.com with `clasp login --no-localhost` (Ben pastes back the `http://localhost:8888/...` address). The sign-in file `~/.clasprc.json` lives only in the workspace; a new workspace needs a new sign-in.
- After `clasp push`, update the existing deployment: `npx clasp update-deployment AKfycbwc4fukEa6Jh_hT4Qhl1_Bt3mZvgFsDJb1kU7FMVnyzrSAeZZrEqOAxVerIdW_zchk`. Never `create-deployment` again.
- Functions that change the Sheet's layout or fix cells (`setupSheet`, `tidyDonations`, `fixConfigCells`) are run by Ben from the Apps Script editor, not from the web address.
- Sheets turns "500,1000,1500,2000" into one number. Any list in a cell must be written as plain text (`setNumberFormat('@')`). Set the Sheet's time zone before writing any date, or the date shifts by a day.
- Claude can read a tab read-only with the clasp sign-in (Sheets "gviz" CSV export) instead of asking Ben to scroll. Only ever on the fake data; once real students are in, ask first.

## Phases

Each phase needs its tests passing before the next starts. Full steps, tests and "done" for each phase are in `PLAN.md` section 5.

1. Back end: the Sheet (Roster, Donations, Config, Contests) with a fake roster; clasp; getRoster, submitDonation, getLeaderboard, standings.
2. Donation page on GitHub Pages.
3. Leaderboard.
4. Extras, in order: Find me; faculty path and board; first-donation email (only if approved); hallway screen; "Give money" page (only once the school confirms).
5. Real data and rehearsal (by about December 12).
6. Freeze (mid December).

## Accounts

- Club Google account: daonetonclub@gmail.com (until the technology office provides a da.org account, if it does).
- GitHub: organization `daonetonclub`, repository `daonetonclub/one-ton-can-drive` (public, for GitHub Pages).
- Commits are authored as "One Ton Club", never with a personal email.
