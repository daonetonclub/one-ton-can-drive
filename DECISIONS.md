# Decisions

Written decisions win over the spec and mockup. `PLAN.md` (coming) is the source of truth for what we build.

## Setup (October 2026)

- The Google Sheet is private: only club organizers can open it. Students use the website only; the website talks to Apps Script, which can only add a donation or read standings.
- Club Google account: daonetonclub@gmail.com (placeholder until the tech office answers about a da.org account).
- GitHub organization: daonetonclub. Repository: daonetonclub/one-ton-can-drive (public, needed for free GitHub Pages).
- Roster request sent to the registrar and email-permission request sent to the technology office; waiting on both. Contact details are kept in private notes, not on GitHub.

## Build decisions

1. **"Just checking" step:** at 20 cans or more, the student confirms before submitting. At 25 or more, the entry is also silently flagged for review.
2. **Over 50 cans in one entry:** refused, not split. Message: "50 is the most you can log at once. Log 50 now and the rest as a second entry."
3. **Names on the leaderboard (changed by decision 23):** show first name plus last initial ("Ben M.") until written administrator approval for full names arrives, then flip the Config switch. The switch is built either way. Approver not yet known: ask Ms. Soletro who gives it.
4. **Who has already been emailed:** a "First emailed" date column on the Roster tab. The server checks it before sending, never a browser cookie.
5. **Hallway screen (replaced by decision 21):** one big number with a date stamp ("as of ..."), not a full leaderboard. Expected weekly screenshot; to-do: confirm with whoever runs the Learning Commons slideshow how often they can swap the image.
6. **Organizer view:** the private Google Sheet, not a web page. Conditional formatting turns flagged rows red (25+ cans, or three or more entries from one person within ten minutes). No `?admin=1` page in version one.
7. **Display unit:** pounds everywhere on screen. Students still log cans. The pounds-per-can ratio lives in Config (starting at 1) and gets corrected once the food bank weighs the first pickup.
8. **What wins when documents disagree:** these written decisions (and `PLAN.md`, once written) win. The mockup is only a picture of the look and feel. The spec's line "the mockup is right" no longer applies.
9. **No free-text names, for anyone.** Students and staff pick their name from the roster. A staff member not on the list sees "Not on the list? Tell the One Ton Club," and an organizer adds them to the Roster tab. (The mockup's "Type your name" box for staff is dropped.)
10. **"Give money" page:** built in full, but only after the school confirms how money is collected. Ben expects it to be a school fundraiser link (likely Veracross); unconfirmed. The page only links to the school's official page and never shows or collects payment details itself. Money never moves the tracker.
11. **First-donation email content:** the student's name and the number of cans in their first donation (e.g. "You've logged 10 cans under the name ..."), plus who to contact if it wasn't them. Nothing else about the student. Sent once per student, ever. Off by default; turned on only if the technology office approves. This is what was described to the technology office, so it must not grow without telling them.
12. **Person IDs:** every Roster row gets a permanent `id` (S001 for students, F001 for faculty). Donations store `person_id`, so two people with the same name never merge and fixing a name's spelling doesn't break history.
13. **Contests:** a fourth Sheet tab, Contests, one row per contest. Main boards always show; each contest has its own separate, time-limited board, visible only while it runs.
14. **Remembered phone:** the cans screen says "Use your own phone. It remembers you next time." and has a small "Not you? Change name" link, mainly to recover from tapping the wrong name.
15. **Outside the drive dates:** the donation form shows a "starts January 19" message before the start and a thank-you message with the total after the end. The end date may be extended; it lives in Config, so extending is a one-cell change.
16. **First-donation email has no button.** It only informs (name, cans, who to contact). No confirmFirstDonation endpoint and no "unconfirmed addresses" list. Matches what the technology office was told.
17. **Top students board:** top 10. Everyone else uses Find me.
18. **Ties at the top-10 cut:** everyone tied for 10th is shown, even if the list runs past 10.
19. **Order of extras:** Find me, faculty path and board, first-donation email (if approved), hallway screen, "Give money" page (once the school confirms). Each optional; stop when time runs out.
20. **Locking (7 November 2026):** only the write to the Donations tab is locked. "Before" rank is the log without the new donation, "after" is the log with it, both in the same server call. Replaces "read, write, read inside the lock", which made 5 to 14 of 20 simultaneous donors get "try again". Approved by Ben and Oren.
21. **Hallway screen (8 November 2026, replaces decision 5):** big number in pounds with the goal bar at the top, then short boards: all grades, the top 5 advisories and the top 5 students (everyone tied at #5 included), plus the date stamp. Names follow the privacy switch. Chosen by Ben over the full mockup version, so the number stays readable and a weekly screenshot doesn't look stale.
22. **Hallway screen ties (8 November 2026):** each list shows at most 8 rows, then a line like "+ 23 more tied at #5", so the screenshot always fits the TV.
23. **Full names now, with a gate (8 November 2026, changes decision 3):** the Config full_names switch is turned on now, while the Sheet holds only fake people. **Gate:** before the real roster goes into the Sheet in Phase 5, either written administrator approval for full names is in hand, or full_names goes back to FALSE. The spec requires administrator approval for names on a public page; Ben's earlier emails said names would appear on the leaderboard, which this matches.
