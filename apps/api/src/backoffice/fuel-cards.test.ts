import { test } from "node:test";
import assert from "node:assert/strict";
import { companyWithOwner, prisma } from "../test/fixtures";
import { tenantClient } from "../tenant/client";
import { detectMapping, duplicateKey, mappingVersion, normalizeHeader, parseAmount, parseCardDate, parseCardLast4, parseFuelCardCsv, parseGallons, parseUnitNumber } from "./fuel-cards";
import { receiptGallons, runCardMatching } from "./matching";
import { d, seedPeriod, seedTransaction } from "./test-harness";

test("detectMapping: Comdata-style header, provider preferences first, each header claimed once", () => {
  const headers = ["Transaction Date", "Merchant Name", "Merchant State", "Unit Number", "Card Number", "Product Description", "Quantity", "Total Amount", "Posting Date"];
  const { mapping, missing } = detectMapping(headers, "comdata");
  assert.deepEqual(mapping, {
    date: "Transaction Date",
    location: "Merchant Name",
    state: "Merchant State",
    unitNumber: "Unit Number",
    cardLast4: "Card Number",
    fuelType: "Product Description",
    gallons: "Quantity",
    amount: "Total Amount",
  });
  assert.deepEqual(missing, []);
});

test("detectMapping: WEX/EFS, AtoB and generic headers; case/space/underscore-insensitive; missing lists required fields", () => {
  const wex = detectMapping(["Trans Date", "Location Name", "Location State", "Unit", "Card #", "Product", "Units", "Net Amount"], "wex_efs").mapping;
  assert.equal(wex.date, "Trans Date");
  assert.equal(wex.gallons, "Units");
  assert.equal(wex.amount, "Net Amount");
  assert.equal(wex.cardLast4, "Card #");

  const atob = detectMapping(["date", "merchant", "state", "vehicle", "card", "fuel_type", "gallons", "amount"], "atob").mapping;
  assert.equal(atob.unitNumber, "vehicle");
  assert.equal(atob.fuelType, "fuel_type");

  const generic = detectMapping(["  TRANSACTION_DATE ", "Site", "ST", "Truck #", "Last 4", "Item", "Volume", "Total"], "generic");
  assert.deepEqual(generic.mapping, { date: "TRANSACTION_DATE", location: "Site", state: "ST", unitNumber: "Truck #", cardLast4: "Last 4", fuelType: "Item", gallons: "Volume", amount: "Total" });
  assert.deepEqual(generic.missing, []);

  assert.deepEqual(detectMapping(["Merchant", "Gallons"], "generic").missing, ["date"]);
  assert.deepEqual(detectMapping(["Date", "Merchant"], "generic").missing, ["gallons", "amount"]);
  assert.equal(normalizeHeader(" Unit_Number "), "unit number");
});

test("cell parsers: dates, money, gallons, state, unit, card digits", () => {
  assert.equal(parseCardDate("2026-10-15"), "2026-10-15");
  assert.equal(parseCardDate("10/15/2026"), "2026-10-15");
  assert.equal(parseCardDate("1/5/26"), "2026-01-05");
  assert.equal(parseCardDate("10/15/2026 08:15:00"), "2026-10-15");
  assert.equal(parseCardDate("2026/10/15"), "2026-10-15");
  assert.equal(parseCardDate("02/30/2026"), null);
  assert.equal(parseCardDate("Oct 15 2026"), null);
  assert.equal(parseCardDate(""), null);

  assert.equal(parseAmount("$1,234.5"), "1234.50");
  assert.equal(parseAmount("(12.34)"), "-12.34");
  assert.equal(parseAmount("12.34-"), "-12.34");
  assert.equal(parseAmount("-$5"), "-5.00");
  assert.equal(parseAmount("  "), null);
  assert.equal(parseAmount("abc"), undefined);
  assert.equal(parseGallons("1,000.1234"), "1000.123");
  assert.equal(parseGallons("100"), "100.000");

  assert.equal(parseUnitNumber("UNIT 101"), "101");
  assert.equal(parseUnitNumber("#101"), "101");
  assert.equal(parseUnitNumber("Unit #101"), "101");
  assert.equal(parseUnitNumber("T-7"), "T-7");
  assert.equal(parseUnitNumber(""), null);
  assert.equal(parseCardLast4("****4417"), "4417");
  assert.equal(parseCardLast4("XXXX-XXXX-XXXX-1234"), "1234");
  assert.equal(parseCardLast4("12"), null);
});

test("parseFuelCardCsv: rows with values normalised, raw map kept, header repeats skipped, errors per row", () => {
  const mapping = { date: "Transaction Date", location: "Merchant Name", state: "Merchant State", unitNumber: "Unit Number", cardLast4: "Card Number", fuelType: "Product Description", gallons: "Quantity", amount: "Total Amount" };
  const csv = [
    "Transaction Date,Merchant Name,Merchant State,Unit Number,Card Number,Product Description,Quantity,Total Amount",
    '10/15/2026,FICTIONAL FUEL STOP #12,oh,UNIT 101,****4417,ULSD,"1,000.0","$4,125.00"',
    "",
    "Transaction Date,Merchant Name,Merchant State,Unit Number,Card Number,Product Description,Quantity,Total Amount",
    "2026-10-16,FICTIONAL FUEL STOP #12,Ohio,#102,4418,DEF,2.5,(12.00)",
    "10/17/2026,FICTIONAL FUEL STOP #12,OH,103,4419,ULSD,,80.00",
  ].join("\r\n");
  const { rows, errors } = parseFuelCardCsv(csv, mapping);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 3);
  const r1 = rows[0]!;
  assert.equal(r1.row, 2);
  assert.equal(r1.date, "2026-10-15");
  assert.equal(r1.state, "OH");
  assert.equal(r1.unitNumber, "101");
  assert.equal(r1.cardLast4, "4417");
  assert.equal(r1.gallons, "1000.000");
  assert.equal(r1.amount, "4125.00");
  assert.equal(r1.raw["Total Amount"], "$4,125.00");
  assert.equal(r1.raw["Merchant Name"], "FICTIONAL FUEL STOP #12");
  const r2 = rows[1]!;
  assert.equal(r2.row, 4); // row numbers count non-blank lines (blank lines are dropped before numbering)
  assert.equal(r2.state, null); // "Ohio" is not a 2-letter code → null, kept in raw
  assert.equal(r2.raw["Merchant State"], "Ohio");
  assert.equal(r2.unitNumber, "102");
  assert.equal(r2.amount, "-12.00");
  const r3 = rows[2]!;
  assert.equal(r3.gallons, null);
  assert.equal(r3.amount, "80.00");

  const bad = parseFuelCardCsv("Date,Gallons,Amount\n10/99/2026,10,40\n2026-10-15,abc,xyz\n2026-10-16,,\n", { date: "Date", gallons: "Gallons", amount: "Amount" });
  assert.equal(bad.rows.length, 0);
  assert.deepEqual(
    bad.errors.map((e) => `${e.row}:${e.field}`),
    ["2:date", "3:gallons", "3:amount", "4:amount"],
  );
  assert.equal(parseFuelCardCsv("", { date: "Date", amount: "Amount" }).errors[0]!.field, "file");
  assert.equal(parseFuelCardCsv("Date,Amount\n", { date: "Date", amount: "Amount" }).errors[0]!.message, "The file has a header but no data rows");
  assert.equal(parseFuelCardCsv("Date,Amount\n2026-10-15,1\n", { date: "Date", amount: "Total" }).errors[0]!.field, "amount");
  assert.equal(parseFuelCardCsv("Date,Amount\n2026-10-15,1\n", { amount: "Amount" }).errors[0]!.field, "header");
});

test("mappingVersion is provider + 8 hex of the sorted mapping; order-insensitive; duplicateKey normalises location", () => {
  const a = mappingVersion("comdata", { date: "Transaction Date", amount: "Total Amount" });
  const b = mappingVersion("comdata", { amount: "Total Amount", date: "Transaction Date" });
  assert.equal(a, b);
  assert.match(a, /^comdata:[0-9a-f]{8}$/);
  assert.notEqual(a, mappingVersion("comdata", { date: "Trans Date", amount: "Total Amount" }));
  assert.notEqual(a, mappingVersion("generic", { date: "Transaction Date", amount: "Total Amount" }));
  assert.equal(
    duplicateKey({ date: "2026-10-15", amount: "412.50", gallons: null, cardLast4: "4242", location: " Fuel Stop " }),
    duplicateKey({ date: "2026-10-15", amount: "412.50", gallons: null, cardLast4: "4242", location: "fuel stop" }),
  );
});

test("receiptGallons: motor fuel only, null for none or liters", () => {
  const dec = (s: string) => ({ toString: () => s });
  assert.equal(receiptGallons([{ category: "MOTOR_FUEL", quantity: dec("100.000"), unit: "gal" }, { category: "REEFER_FUEL", quantity: dec("20"), unit: "gal" }, { category: "DEF", quantity: dec("2.5"), unit: "gal" }]), "100.000");
  assert.equal(receiptGallons([{ category: "MOTOR_FUEL", quantity: dec("50.5"), unit: "gal" }, { category: "MOTOR_FUEL", quantity: dec("49.5"), unit: null }]), "100.000");
  assert.equal(receiptGallons([{ category: "MOTOR_FUEL", quantity: dec("378.5"), unit: "L" }]), null);
  assert.equal(receiptGallons([{ category: "DEF", quantity: dec("2.5"), unit: "gal" }]), null);
});

test("runCardMatching (DB): Match + D003 + RECEIPT_AND_CARD, I003/I004 for the unmatched, idempotent re-run, period scope, settings tolerance", async () => {
  const a = await companyWithOwner();
  const db = tenantClient(prisma, a.company.id);
  const period = await seedPeriod(a.company.id);
  const matched = await seedTransaction(a.company.id, { periodId: period.id, date: "2026-10-15", state: "OH", cardLast4: "4417", receiptTotal: "412.50", paymentMethod: "fuel_card" });
  const cardPaidNoRow = await seedTransaction(a.company.id, { periodId: period.id, date: "2026-11-02", state: "IN", receiptTotal: "300.00", paymentMethod: "credit_card", lines: [{ category: "MOTOR_FUEL", quantity: "75.000", amount: "300.00" }] });
  const cashNoRow = await seedTransaction(a.company.id, { periodId: period.id, date: "2026-11-03", state: "IN", receiptTotal: "50.00", paymentMethod: "cash", lines: [{ category: "MOTOR_FUEL", quantity: "12.000", amount: "50.00" }] });
  const outsidePeriod = await seedTransaction(a.company.id, { periodId: null, date: "2026-09-10", state: "OH", receiptTotal: "100.00", paymentMethod: "fuel_card", lines: [{ category: "MOTOR_FUEL", quantity: "25.000", amount: "100.00" }] });

  const imp = await prisma.fuelCardImport.create({
    data: {
      companyId: a.company.id,
      provider: "comdata",
      mappingVersion: "comdata:test0000",
      rows: {
        create: [
          { companyId: a.company.id, date: d("2026-10-16"), state: "OH", cardLast4: "4417", gallons: "100.300", amount: "412.90", location: "FICTIONAL FUEL STOP", raw: {} }, // +1 day, within tolerances
          { companyId: a.company.id, date: d("2026-10-20"), state: "KY", cardLast4: "4418", gallons: "60.000", amount: "240.00", location: "FICTIONAL TRUCK STOP", raw: {} }, // no receipt
          { companyId: a.company.id, date: d("2026-09-10"), state: "OH", cardLast4: "4242", gallons: "25.000", amount: "100.00", location: "FICTIONAL FUEL STOP", raw: {} }, // outside period
        ],
      },
    },
    include: { rows: { orderBy: { date: "asc" } } },
  });
  const cardOutside = imp.rows[0]!;
  const cardMatched = imp.rows[1]!;
  const cardOrphan = imp.rows[2]!;

  const first = await runCardMatching({ prisma, db, companyId: a.company.id, userId: a.user.id, period });
  assert.deepEqual(first, { receiptsConsidered: 3, cardRowsConsidered: 2, matched: 1, newMatches: 1, unmatchedReceipts: 2, unmatchedCardRows: 1 });

  const match = await prisma.match.findUnique({ where: { transactionId_cardTransactionId: { transactionId: matched.tx.id, cardTransactionId: cardMatched.id } } });
  assert.ok(match);
  assert.equal(match.score.toFixed(3), "0.750"); // ±1 day → date contributes 0 of 1.00
  assert.deepEqual(match.fieldsUsed, ["date", "gallons", "amount", "state", "cardLast4"]);
  assert.equal(match.ruleVersion, "match-v1");
  assert.equal((await prisma.transaction.findUnique({ where: { id: matched.tx.id } }))!.corroboration, "RECEIPT_AND_CARD");
  const d003 = await prisma.issue.findMany({ where: { companyId: a.company.id, code: "D003" } });
  assert.equal(d003.length, 1);
  assert.equal(d003[0]!.transactionId, matched.tx.id);
  assert.equal(d003[0]!.severity, "INFO");
  assert.equal((d003[0]!.evidence as { cardTransactionId: string }).cardTransactionId, cardMatched.id);

  const i003 = await prisma.issue.findMany({ where: { companyId: a.company.id, code: "I003" } });
  assert.equal(i003.length, 1);
  assert.equal(i003[0]!.transactionId, null);
  assert.equal(i003[0]!.severity, "WARNING");
  assert.deepEqual(i003[0]!.evidence, { fuelCardTransactionId: cardOrphan.id, date: "2026-10-20", amount: "240.00", gallons: "60.000", location: "FICTIONAL TRUCK STOP" });

  const i004 = await prisma.issue.findMany({ where: { companyId: a.company.id, code: "I004" } });
  assert.equal(i004.length, 1);
  assert.equal(i004[0]!.transactionId, cardPaidNoRow.tx.id); // cash receipt gets no I004, out-of-period one not considered
  assert.equal(i004[0]!.severity, "INFO");
  assert.equal(await prisma.issue.count({ where: { transactionId: cashNoRow.tx.id } }), 0);
  assert.equal(await prisma.issue.count({ where: { transactionId: outsidePeriod.tx.id } }), 0);

  // Re-run: nothing new.
  const second = await runCardMatching({ prisma, db, companyId: a.company.id, userId: a.user.id, period });
  assert.deepEqual(second, { receiptsConsidered: 3, cardRowsConsidered: 2, matched: 1, newMatches: 0, unmatchedReceipts: 2, unmatchedCardRows: 1 });
  assert.equal(await prisma.match.count({ where: { transactionId: matched.tx.id } }), 1);
  assert.equal(await prisma.issue.count({ where: { companyId: a.company.id, code: { in: ["D003", "I003", "I004"] } } }), 3);

  // Whole-company run picks up the out-of-period pair; an audit row names the company.
  const company = await runCardMatching({ prisma, db, companyId: a.company.id, userId: a.user.id });
  assert.equal(company.newMatches, 1);
  assert.equal(company.matched, 2);
  assert.ok(await prisma.match.findFirst({ where: { transactionId: outsidePeriod.tx.id, cardTransactionId: cardOutside.id } }));
  const audits = await prisma.auditLog.findMany({ where: { companyId: a.company.id, action: "edit" }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(
    audits.map((x) => x.target),
    [`Period:${period.id}`, `Period:${period.id}`, `Company:${a.company.id}`],
  );

  // Resolve-on-match: the orphan card row's I003 and the card-paid receipt's I004 close once they pair up.
  await prisma.fuelCardTransaction.create({ data: { importId: imp.id, companyId: a.company.id, date: d("2026-11-02"), state: "IN", cardLast4: "4242", gallons: "75.000", amount: "300.00", location: "X", raw: {} } });
  await seedTransaction(a.company.id, { periodId: period.id, date: "2026-10-20", state: "KY", cardLast4: "4418", receiptTotal: "240.00", paymentMethod: "fuel_card", lines: [{ category: "MOTOR_FUEL", quantity: "60.000", amount: "240.00" }] });
  const third = await runCardMatching({ prisma, db, companyId: a.company.id, userId: a.user.id, period });
  assert.equal(third.newMatches, 2);
  assert.equal(third.unmatchedCardRows, 0);
  const closedI003 = await prisma.issue.findFirst({ where: { companyId: a.company.id, code: "I003" } });
  assert.equal(closedI003!.status, "RESOLVED");
  assert.equal(closedI003!.resolutionNote, "Matched to a receipt");
  const closedI004 = await prisma.issue.findFirst({ where: { companyId: a.company.id, code: "I004" } });
  assert.equal(closedI004!.status, "RESOLVED");

  // Company tolerance setting is honoured: a 2-day gap matches only with days=2.
  const far = await seedTransaction(a.company.id, { periodId: period.id, date: "2026-12-01", state: "TX", cardLast4: "7777", receiptTotal: "99.00", paymentMethod: "fuel_card", lines: [{ category: "MOTOR_FUEL", quantity: "24.000", amount: "99.00" }] });
  await prisma.fuelCardTransaction.create({ data: { importId: imp.id, companyId: a.company.id, date: d("2026-12-03"), state: "TX", cardLast4: "7777", gallons: "24.000", amount: "99.00", location: "X", raw: {} } });
  assert.equal((await runCardMatching({ prisma, db, companyId: a.company.id, userId: a.user.id, period })).newMatches, 0);
  await prisma.setting.create({ data: { companyId: a.company.id, key: "card_match_tolerance", value: { days: 2, gallonsRatio: "0.005", amountUsd: "0.50" } } });
  assert.equal((await runCardMatching({ prisma, db, companyId: a.company.id, userId: a.user.id, period })).newMatches, 1);
  assert.ok(await prisma.match.findFirst({ where: { transactionId: far.tx.id } }));
});
