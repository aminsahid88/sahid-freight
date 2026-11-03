# Deliverables

## Period PDF report
- Cover: company, USDOT/MC, period, generation date/time, status (PRELIMINARY/REVIEWED), snapshot id.
- Summary: documents received, transactions, % verified, open issues by severity.
- Fuel: gallons and dollars by state and fuel type; reefer and DEF shown separately.
- Mileage and MPG by vehicle (when mileage imported).
- Non-fuel spend by category.
- Exceptions list with codes, explanations and links/page refs to source documents.
- Reconciliation notes: formulas, included/excluded records, rounding.
- Appendix: transaction table; optional supporting-document images.
- Footer on every page: page x of y, company, period, status.

## Transactions CSV columns
1. `transaction_id`
2. `status`
3. `date`
4. `time`
5. `vendor`
6. `seller_address`
7. `state`
8. `state_source`
9. `vehicle_unit`
10. `driver`
11. `fuel_type`
12. `gallons`
13. `unit_price`
14. `fuel_amount`
15. `reefer_gallons`
16. `def_gallons`
17. `non_fuel_amount`
18. `taxes`
19. `fees`
20. `credits`
21. `receipt_total`
22. `payment_method`
23. `card_last4`
24. `card_match_id`
25. `corroboration`
26. `open_issue_codes`
27. `source_document_id`
28. `source_filename`
29. `source_page`
30. `last_edited_by`
31. `last_edited_at`

## Supporting package
ZIP of original files renamed <date>_<state>_<vendor>_<transaction_id>.<ext> plus index.csv mapping files to transactions.

## IFTA worksheet
Per-jurisdiction table: total miles, taxable miles, taxable gallons consumed, tax-paid gallons, net taxable gallons, rate, surcharge, tax due/credit; fleet totals and MPG; rate table source; PRELIMINARY/REVIEWED label.

## Later
Quarter archive with all of the above plus edit history and approvals, for an auditor.
