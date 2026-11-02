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
