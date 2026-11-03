# Intake Channels

Meet owners and drivers where they already are. Every channel lands in the same documents pipeline with identical processing.

| Channel | Phase | Details |
| --- | --- | --- |
| Web upload | 1 | Drag-and-drop multi-file upload; PDF, JPG, PNG, HEIC, TIFF, CSV, XLSX; per-file progress and errors. |
| Mobile camera capture (PWA) | 1 | Installable PWA on iPhone/Android; multi-shot capture, auto-crop, blur and glare warnings before upload; offline queue that uploads when signal returns. |
| Email forwarding | 1 | Each company gets a unique inbound address (e.g. docs+<company-slug>@<domain>). Attachments become documents; sender must be a registered user or is held for owner approval. |
| WhatsApp / SMS | 1 | Twilio (or equivalent) number. Sender phone maps to a user/driver and company. Photos become documents; the bot replies with a receipt confirmation and asks only for missing essentials (e.g. truck unit number) in the user's language. Unknown senders are rejected politely. |
| Fuel card statement import | 1 | CSV/XLSX import with saved column mappings per provider (Comdata, WEX/EFS, AtoB, TCS, generic). Each row becomes a fuel_card_transaction, not a duplicate receipt. |
| ELD mileage import | 1 | Import the ELD's IFTA/jurisdiction mileage report (CSV/XLSX/PDF) per vehicle and quarter. Direct API integrations (Motive, Samsara, etc.) are phase 3. |
| Bank and credit card statements | 2 | CSV/OFX import for expense matching and bookkeeping. |

## Attribution rules
- Every document gets company, reporting period (derived from transaction date, overridable), uploader and channel.
- Truck unit number is captured from the receipt, the fuel card row, the driver's default truck, or by asking — in that order, recording which source was used.
- Never assign a document to a company based on guesswork; unattributable documents go to an 'Unassigned' inbox.
