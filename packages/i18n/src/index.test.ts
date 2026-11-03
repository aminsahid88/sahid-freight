import { test } from "node:test";
import assert from "node:assert/strict";
import { dictionary, flattenKeys, interpolate, isLocale, LOCALES, t, translator } from "./index";

test("English and Somali define exactly the same keys", () => {
  const en = flattenKeys(dictionary("en"));
  const so = flattenKeys(dictionary("so"));
  assert.deepEqual(so, en);
  assert.ok(en.length > 30, "expected the starter string set");
});

test("every string is non-empty in every locale", () => {
  for (const locale of LOCALES) {
    for (const key of flattenKeys(dictionary(locale))) {
      assert.notEqual(t(locale, key).trim(), "", `${locale}:${key} is empty`);
    }
  }
});

test("placeholders are identical across locales", () => {
  const en = dictionary("en");
  const so = dictionary("so");
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
  for (const key of flattenKeys(en)) {
    assert.deepEqual(placeholders(t("so", key)), placeholders(t("en", key)), `placeholder mismatch in ${key}`);
  }
  void so;
});

test("t translates, interpolates and falls back", () => {
  assert.equal(t("en", "nav.inbox"), "Inbox");
  assert.equal(t("so", "nav.inbox"), "Sanduuqa");
  assert.equal(t("en", "home.daysLeft", { days: 12 }), "12 days left");
  assert.equal(t("so", "home.daysLeft", { days: 12 }), "12 maalmood ayaa haray");
  assert.equal(t("so", "does.not.exist"), "does.not.exist");
  assert.equal(t("en", "nav"), "nav", "a branch key is not a string and falls back to the key");
});

test("interpolate leaves unknown placeholders visible rather than blanking them", () => {
  assert.equal(interpolate("Hi {name}, {count} new", { name: "Amin" }), "Hi Amin, {count} new");
});

test("translator binds a locale and isLocale guards input", () => {
  const tr = translator("so");
  assert.equal(tr("common.save"), "Kaydi");
  assert.equal(isLocale("so"), true);
  assert.equal(isLocale("am"), false);
  assert.equal(isLocale(undefined), false);
});
