# Suri: scope and limitations

One rule decides everything: **Suri automates what the paper can prove. When the paper is unclear, it asks. When the paper can't prove something, it says so.** It never marks something as passed by guessing.

## 1. Suri checks automatically

The answer is printed on the documents.

| Check | Example |
| --- | --- |
| Names match across papers | Name on the bill = name on the ID (handles "Dela Cruz, Maria" vs "Maria Dela Cruz"; asks to confirm "Ma." vs "Maria" and extra words) |
| Same date across papers | Birth date on the ID = birth date on the birth certificate |
| A field equals a value | Civil status is "Single" |
| A field contains a value | Address contains "Barangay Baybayin" |
| Date is not in the future | Issue date is not after today |
| Date is recent enough | Bill is from the last 3 months |
| Amounts add up | Items add up to the subtotal; subtotal + VAT = total |
| **Age limit** | Applicant is at least 18, using the birth date on the ID |

## 2. Suri asks instead of guessing

The answer is on the paper, but it isn't clear.

| Situation | What Suri does |
| --- | --- |
| Blurry, dark, or cut-off photo | Asks for a retake and says what's wrong |
| Wrong document uploaded | Says what it looks like instead (e.g. "this looks like a report card") |
| Values almost match (typo, nickname, missing middle name) | Asks one question that shows both values |
| Description too vague to build a check | Asks which documents and rules are needed |

## 3. Check by hand

The paper can't prove it, so Suri lists it under "Check by hand" and never marks it passed.

| Kind of rule | Examples | Why |
| --- | --- | --- |
| Records kept somewhere else | Registered voter, enrolled student, no NBI record | The answer is in another office's database, not on the paper |
| Is the document genuine? | Fake or edited document, real signature, original vs photocopy | A photo can't prove authenticity |
| Physical marks | Dry seal, wet ink signature | A phone photo can't reliably show them |
| Judgement calls | Good moral character, "valid reason" | A person must decide |

### Why Suri doesn't judge authenticity

Today anyone can make a convincing fake document, and AI makes that easier every month. A photo alone can't prove a document is real, so Suri never says one is.

- **Integrity is not authenticity.** A hash (like SHA-256) proves a file wasn't changed *after* it was uploaded. It says nothing about whether the document was real *before* it was uploaded.
- **Only the issuer can prove a document is real,** for example by scanning the QR code on a PhilSys ID or confirming with the school or agency that issued it.
- **What Suri does instead:** it checks that the papers agree with each other and with the office's rules. A fake that contradicts the other papers still gets flagged. A perfect fake is the issuer's job to catch, and Suri says so rather than pretending.

## 4. Outside this hackathon build

- **Real documents.** The demo uses sample documents only.
- **Accounts and logins.** Visitors get an anonymous session, and each one only sees their own checks.
- **Keeping data.** Uploads and results are deleted automatically after 7 days.
- **Final decisions.** Suri prepares and flags; a person always approves or rejects.
