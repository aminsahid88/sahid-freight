import { test } from "node:test";
import assert from "node:assert/strict";
import { csvEscape, toCsv } from "./csv";

test("toCsv writes a header and rows with CRLF line endings", () => {
  const out = toCsv(["a", "b"], [["1", "2"], [3, null]]);
  assert.equal(out, "a,b\r\n1,2\r\n3,\r\n");
});

test("fields containing commas, quotes or newlines are quoted per RFC 4180", () => {
  assert.equal(csvEscape('Pilot "Flying J", Exit 4'), '"Pilot ""Flying J"", Exit 4"');
  assert.equal(csvEscape("line1\nline2"), '"line1\nline2"');
  assert.equal(csvEscape("line1\r\nline2"), '"line1\r\nline2"');
  assert.equal(csvEscape("plain"), "plain");
  assert.equal(csvEscape(""), "");
  assert.equal(csvEscape(undefined), "");
  const out = toCsv(["vendor", "total"], [['Love"s, Inc', "12.30"]]);
  assert.equal(out, 'vendor,total\r\n"Love""s, Inc",12.30\r\n');
});

test("a row with the wrong number of cells is rejected", () => {
  assert.throws(() => toCsv(["a", "b"], [["only one"]]), RangeError);
});
