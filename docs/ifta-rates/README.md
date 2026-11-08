# IFTA rate tables (paste-ready)

Source: IFTA, Inc. tax rate matrix, https://www.iftach.org/taxmatrix4/Taxmatrix.php, Special Diesel column, U.S. line.
Load from Settings → "IFTA rate tables" (platform admin) or `POST /admin/ifta-rates`. Rates never come from anywhere else.

## 2026Q4 — `2026Q4-special-diesel.csv`

Read from the matrix on 2026-11-08 (matrix last updated 11/05/26). **The matrix is not final until December 4, 2026**; re-read it after that date and reload.

Notes on this quarter:
- 47 U.S. jurisdictions. Oregon has no fuel tax rate (weight-mile tax) and is omitted.
- Surcharge column filled for Kentucky (0.1050) and Virginia (0.1430), the two states whose surcharge row carries a Special Diesel value.
- Indiana's surcharge row shows no Special Diesel value on the matrix, so no surcharge is loaded for IN. Confirm with the preparer.
- Ohio has a second row dated 10/4/26 (rate reduction holiday 10/4/2026 to 1/2/2027, footnote 28) with a 0.0001 diesel rate. The platform holds one rate per jurisdiction per quarter, so the base 0.4700 is loaded and the split is flagged as a known limitation; mid-quarter rate splits are a backlog item.
- Canadian provinces are not loaded (U.S. carriers only for now; the matrix's USD conversion is not final until the quarter closes).
