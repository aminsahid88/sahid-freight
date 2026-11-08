# How to use — narration script

Voice: Samantha (macOS), 172 words per minute. One section per scene; the on-screen caption is in italics.

## 0. Sahid Freight Back Office

- Receipts in
- Read twice, checked by rules
- You decide only what needs you
- The quarter's IFTA numbers, ready for your preparer

Welcome to the Sahid Freight back office. This walkthrough shows how a small carrier uses it from the first day to the end of a quarter. Receipts come in. The system reads each one twice and checks it against a set of rules. You decide only the items that genuinely need a person. At the end of the quarter, the fuel tax numbers are ready to hand to your preparer. Let's go through it screen by screen.

## 1. Signing in

*Sign in with your email or phone and your password.* — screen: `img/01-sign-in.png`

Start at the sign-in page. Enter the email address or phone number on your account, then your password. If you forget it, use the reset link below the form. Each person on your team has their own login, so every change is recorded under the person who made it.

## 2. Home

*Home shows what needs you today, the next IFTA deadline, and one recommended next step.* — screen: `img/02-home.png`

Home is your starting point every day. The getting-started checklist walks a new company through five setup steps. Below it, four numbers: how many items need your attention, the days left until the next IFTA deadline, the documents received this period, and the share of transactions already verified. The Next step card points at the one thing worth doing right now. You never have to hunt for what matters.

## 3. Setup: Vehicles & Drivers

*Add each truck with its unit number and tank size, and each driver with the phone they text from.* — screen: `img/18-vehicles.png`

Set up once, under Vehicles and Drivers. Add each truck with its unit number, its tank capacity, and the ELD provider it reports through. The unit number is how a receipt lands on the right truck. The tank capacity lets the system flag a fill-up that is larger than the tank could hold. Then add your drivers with the phone numbers they will text receipts from. That phone number is how a texted receipt is attributed to the right driver and their usual truck.

## 4. Setup: Settings

*Company details, your receipt forwarding address, your team and their roles.* — screen: `img/19-settings.png`

Settings holds the company record: legal name, USDOT number, IFTA base state and time zone. The Forward receipts to address is your company's own inbox. Anything emailed to it lands in the Inbox automatically, so a driver or a vendor can simply forward a receipt. Under Team, add the people who should see this company and give each a role: owner, office staff, reviewer, or driver. Drivers can send receipts but cannot change records. You can also switch between light and dark themes here.

## 5. Inbox: getting paperwork in

*Drop files here, or let drivers text them. Every document is fingerprinted and stored unchanged.* — screen: `img/03-inbox.png`

The Inbox is where every receipt and statement arrives. You can drag a batch of files onto the page, or tap to choose them. PDFs, photos and scans are all accepted. Drivers can text a photo from their phone, and emails to your forwarding address land here too. Each document gets a fingerprint when it arrives, and the original file is stored exactly as received for four years. If the same receipt comes in twice, the second copy is marked as a duplicate of the first, so nothing is counted twice.

## 6. Inbox: a document

*The original, its fingerprint, how it arrived, who sent it, and how long it is kept.* — screen: `img/04-inbox-document.png`

Open any document to see the original image, its fingerprint, when and how it arrived, and who sent it. In this example a driver texted a faded receipt from a travel center in Fargo. Below the details, the Reading section shows the two separate reads the system performed and what they cost, and a link to the transaction that was created from them. Open original always gives you the untouched file.

## 7. Transactions: the ledger

*Every fuel purchase and expense for the quarter, each linked to its receipt.* — screen: `img/05-transactions.png`

Transactions is the ledger. Every receipt that has been read becomes a row here: date, vendor, state, truck, gallons, total and status. Filter by period at the top right, or by status: needs attention, verified, or unable to verify. A green Verified badge means both reads agreed and every rule passed. A question mark means a value could not be read and needs a person. The small number beside a status is how many open flags that row has.

## 8. Transactions: how each value was read

*Two independent reads side by side. A value is final only when both agree or a person confirmed it.* — screen: `img/06b-transaction-provenance.png`

Open a row to see exactly where each value came from. The table shows Read 1, Read 2, the final value and its source. Both agree means the two independent reads matched. If they differ, the field stays empty and is flagged, because the system never guesses. Any field can be corrected with the pencil. A correction needs a short reason, and the original extracted value is kept in the change history. Nothing is ever overwritten.

## 9. Review: only what needs you

*Flagged items, sorted by deadline. Each is due within one business day of receipt.* — screen: `img/07-review-queue.png`

Review is where the system asks for a decision. It lists only the receipts that failed a check, sorted by deadline, and each one is due within one business day of arriving. Filter by error, warning or info. Tick Claimed by me to see the items you are working on. Here one receipt is unable to verify because the gallons were smudged on the paper. The Approvals tab is for owners: when a reviewer changes a material value, that change waits here until the owner approves or rejects it.

## 10. Review: deciding an item

*The receipt on the left, both reads on the right. Accept a read, type a value, or mark it unreadable.* — screen: `img/08-review-workspace.png`

Open an item and the receipt appears on the left with both reads on the right. Click any field and the system highlights where on the receipt it was read. For each field you have four choices: use read one, use read two, type the value yourself, or mark it unreadable. Every flag at the bottom has a note box. Mark fixed when you corrected the value; Accept as is when the paper is simply right that way. If a receipt was read badly, Re-read receipt runs it through the current reader again. Once the last error is settled, the record turns Verified and leaves the queue. The timer in the corner tracks reviewer time.

## 11. Fuel & IFTA: the quarter

*Tax-paid gallons by state from verified receipts only. Reefer fuel and DEF are never counted.* — screen: `img/09-ifta-before-imports.png`

Fuel and IFTA is the quarter's workspace. The left table totals tax-paid gallons by state from verified receipts only. Reefer fuel and diesel exhaust fluid are shown separately and never count as motor fuel, which is the rule for IFTA. The right side is where your mileage goes. Below are the two imports that complete the picture: your fuel card statement and your ELD mileage report.

## 12. Fuel & IFTA: fuel card statement

*Import the CSV from your card provider. Each row is matched to its receipt, never counted twice.* — screen: `img/11-fuelcard-imported.png`

Import your fuel card statement as a CSV. Choose the provider, pick the file, and confirm which column is which; the system guesses from the headers and remembers your choice. Every row becomes a card purchase and is matched to its receipt. The result tells you how many rows matched, how many card purchases have no receipt yet, and how many receipts paid by card have no card row. Those are the receipts to chase. Card rows corroborate the receipts; they never replace them.

## 13. Fuel & IFTA: ELD mileage

*Import the quarter's jurisdiction mileage report. A newer file for a truck replaces its rows; nothing is deleted.* — screen: `img/13-mileage-imported.png`

Import the quarter's jurisdiction mileage report from your ELD the same way. Choose the layout: one row per truck and state, or one row per truck with a column per state. Trucks that are not in your fleet are listed so you can add them before anything is imported. A newer file for a truck replaces its earlier rows, and the old rows are kept for the audit trail. After the import, every fuel receipt is re-checked against the miles: fuel bought in a state with no miles, a truck with fuel but no miles, and a fleet MPG outside the expected band are all flagged.

## 14. Fuel & IFTA: the picture

*Motor-fuel gallons, total miles and fleet MPG for the quarter, with miles by jurisdiction.* — screen: `img/14-ifta-summary.png`

With both imports in, the quarter comes together. Motor-fuel gallons, total miles and fleet MPG sit at the top. Fleet MPG turns amber when it falls outside the usual range for a truck, which almost always means miles or gallons are missing somewhere. Miles by jurisdiction can be viewed by state or by truck.

## 15. Fuel & IFTA: the worksheet

*Per-jurisdiction miles, consumed gallons, tax-paid gallons, net gallons, rate and tax due. Preliminary until reviewed.* — screen: `img/15-ifta-worksheet.png`

The IFTA worksheet does the quarter's arithmetic. For each jurisdiction: taxable miles, gallons consumed at fleet MPG, tax-paid gallons from receipts, the net, the rate, and the tax due or credit. Rates come only from the official quarterly rate table loaded into the system; they are never estimated. If the table for a quarter is missing, the worksheet is blocked and says so. The sheet is labelled Preliminary and carries the preparer disclaimer. It is prepared for review by a qualified preparer; it is not a filed return.

## 16. Reports: what you hand over

*Four deliverables per quarter, each stamped with the data snapshot it was built from.* — screen: `img/17-reports-generated.png`

Reports is what you hand over. Four files per period: the period report as a PDF with a summary, fuel by state, mileage, exceptions, the worksheet and a transaction appendix; the transactions CSV; the IFTA worksheet as a spreadsheet; and the supporting package, a ZIP with every original receipt renamed by date, state and vendor, plus an index and a manifest of fingerprints. Each file records the snapshot it was built from, so it can be regenerated identically. Files stay labelled Preliminary until the period has been reviewed.

## 17. A simple rhythm

- Every week: get receipts in, clear the Review queue
- Every month: import the fuel card statement
- Quarter end: import ELD mileage, read the worksheet, generate the reports
- Send the package to your preparer

The rhythm is simple. Every week, get the receipts in and clear the Review queue; it rarely takes more than a few minutes. Every month, import the fuel card statement so the receipts are corroborated. At quarter end, import the ELD mileage, read the worksheet, generate the four reports and send the package to your preparer.

## 18. What the system will never do

- Never invent a value: unreadable means empty and flagged
- Never overwrite an original: corrections are kept as history
- Never estimate a tax rate: official tables only
- Never file, send, pay or delete anything without your approval

Four rules hold everything together. The system never invents a value: if a number cannot be read, it stays empty and is flagged. It never overwrites an original: every correction is a new entry in the history. It never estimates a tax rate: only the official table is used. And it never files, sends, pays or deletes anything without your explicit approval. That is what makes the numbers defensible in an audit.

## 19. Sahid Freight Back Office

That is the Sahid Freight back office. Sign in, add your trucks and drivers, and upload this week's receipts. The checklist on Home will take it from there.
