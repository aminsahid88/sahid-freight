# IFTA Logic

**Scope:** Preparer-ready worksheet only. No filing.

## Facts
- IFTA covers the 48 contiguous U.S. states and 10 Canadian provinces; returns are filed quarterly with the base jurisdiction.
- Qualified motor vehicles: two axles and over 26,000 lb gross/registered weight, three or more axles, or a combination over 26,000 lb.
- Records (distance and fuel) must be retained 4 years from the later of the due date or filing date.

## Calculation
- total_miles = sum of all jurisdiction miles for qualified vehicles (taxable and non-taxable as reported).
- total_taxable_gallons = sum of motor-fuel gallons purchased for qualified vehicles in the quarter (excluding reefer fuel and DEF).
- fleet_mpg = total_miles / total_taxable_gallons (rounded per base-jurisdiction rules from config; default 2 decimals).
- gallons_consumed[j] = taxable_miles[j] / fleet_mpg
- net_taxable_gallons[j] = gallons_consumed[j] − tax_paid_gallons[j]
- tax[j] = net_taxable_gallons[j] × rate[j] (+ surcharge[j] where the rate table defines one)
- Rates come only from the official quarterly IFTA rate table loaded into ifta_rate_tables with source URL and import date; never from an LLM.
- Use decimal arithmetic (no floats) and document every rounding step in the worksheet.

## Labels
Worksheet header states PRELIMINARY until all error issues are resolved and the owner approves; REVIEWED after approval. Always include: 'Prepared for review by a qualified preparer; not a filed return.'

## Worked example (fictional)

Fleet: 2 qualified trucks. Quarter totals: 30,000 miles; 4,800 motor-fuel gallons → MPG = 6.25.

| State | Taxable miles | Gallons consumed (miles ÷ 6.25) | Tax-paid gallons | Net taxable gallons |
| --- | --- | --- | --- | --- |
| OH | 12,500 | 2,000.00 | 2,600 | −600.00 (credit) |
| IN | 10,000 | 1,600.00 | 1,200 | 400.00 |
| IL | 7,500 | 1,200.00 | 1,000 | 200.00 |

Tax due per state = net taxable gallons × that quarter's official rate (plus surcharge if the rate table has one). Use this table as a unit-test fixture with a fictional rate table.
