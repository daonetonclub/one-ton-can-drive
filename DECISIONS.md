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
3. **Names on the leaderboard:** show first name plus last initial ("Ben M.") until written administrator approval for full names arrives, then flip the Config switch. The switch is built either way. Approver not yet known: ask Ms. Soletro who gives it.
4. **Who has already been emailed:** a "First emailed" date column on the Roster tab. The server checks it before sending, never a browser cookie.
5. **Hallway screen:** one big number with a date stamp ("as of ..."), not a full leaderboard. Expected weekly screenshot; to-do: confirm with whoever runs the Learning Commons slideshow how often they can swap the image.
6. **Organizer view:** the private Google Sheet, not a web page. Conditional formatting turns flagged rows red (25+ cans, or three or more entries from one person within ten minutes). No `?admin=1` page in version one.
7. **Display unit:** pounds everywhere on screen. Students still log cans. The pounds-per-can ratio lives in Config (starting at 1) and gets corrected once the food bank weighs the first pickup.
8. **What wins when documents disagree:** these written decisions (and `PLAN.md`, once written) win. The mockup is only a picture of the look and feel. The spec's line "the mockup is right" no longer applies.
