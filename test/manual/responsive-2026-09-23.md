# Phone and tablet check — 2026-09-23

Live frontend revision: 71a1fbf (Pages: 28b8b863094a80696efc03d03e376c5765c02973).
Test method: Chrome browser viewport overrides and real UI interaction with a disposable review. This was not a physical iOS/Android device test; Safari behavior and software-keyboard interaction remain untested.

## Issues fixed

- Phone ranking sidebar left too little room for entry text, comments and editing. At widths up to 600px, controls now sit above a full-width entry, with the section menu below the ranking arrows.
- Ranking arrows, send buttons, comment actions, verdicts and disclosure controls were too small. Phone/tablet controls now have a minimum 44px height; arrow/send targets are 44px square.
- Long mobile counters can wrap; comment textareas use 16px type; comment action buttons wrap when necessary.
- Admin content can wrap long text and uses less padding on phones.

## Layout results

| Viewport | Reviewer page | Active control heights | Admin inbox |
| --- | --- | --- | --- |
| 320 × 740 | No horizontal overflow | At least 44px | No overflow |
| 390 × 844 | No horizontal overflow; visually inspected | At least 44px | No overflow |
| 430 × 932 | No horizontal overflow | At least 44px | Not separately checked |
| 768 × 1024 | No horizontal overflow; visually inspected | At least 44px | No overflow |
| 1024 × 768 | No horizontal overflow | At least 44px | No overflow |

## Functional results

- Name login and sign-out: passed on phone/tablet; reopening with different capitalization restored the same review.
- Long comment: wrapped correctly; Edit/Save/Cancel remained legible and usable.
- Section move on phone: entry moved from Employment to Other, keeping its comment.
- Ranking: moved to rank 5 in General and rank 4 in Ottawa; switching views preserved independent orders.
- Automatic saving: reached Saved; return login restored section, General rank and notebook.
- Awards: selected Competition involved, verified the 100-character counter and posted field label.
- Unsend/Undo: removed and restored the award comment; final unsend saved.
- Admin inbox: loaded feedback and fit phone/tablet widths.

Temporary review removed after testing; real reviewer content was not edited. Viewport override reset.
