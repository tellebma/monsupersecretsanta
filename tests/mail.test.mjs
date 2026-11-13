import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { load } from "cheerio";
import { renderMail } from "../lib/mail.ts";

test("every notification includes HTML and a plain-text alternative with the same destination", () => {
  const destinations = {
    invite: "/invitation/secret-token", draw: "/groupes/edition-1", blocked: "/groupes/edition-1",
    empty: "/mes-cadeaux", reservation: "/groupes/edition-1", exchange: "/groupes/edition-1",
  };
  for (const [kind, path] of Object.entries(destinations)) {
    const mail = renderMail({ kind, payload: { group: "Les amis", edition: "edition-1", token: "secret-token", gift: "Un livre" } }, "https://santa.example/path");
    const $ = load(mail.html);
    assert.ok(mail.subject);
    assert.equal($("html").attr("lang"), "fr");
    assert.equal($("h1").length, 1);
    assert.equal($("a.email-button").attr("href"), `https://santa.example${path}`);
    assert.equal($("a").last().attr("href"), `https://santa.example${path}`);
    assert.ok(mail.text.includes(`https://santa.example${path}`));
    assert.equal($("script, img, link").length, 0);
  }
});

test("user content stays text and cannot inject HTML or change a link's origin", () => {
  const gift = '<img src=x onerror="alert(1)"> & cadeaux';
  const mail = renderMail({ kind: "reservation", payload: { gift, edition: '../other?x=" onmouseover="alert(1)' } }, "https://santa.example");
  const $ = load(mail.html);
  assert.equal($("img, [onerror], [onmouseover]").length, 0);
  assert.ok($("body").text().includes(gift));
  assert.ok(mail.text.includes(gift));
  assert.equal(new URL($("a").first().attr("href")).origin, "https://santa.example");
  assert.ok($("a").first().attr("href").includes("%2F"));
});

test("verification codes are readable without a misleading action link", async () => {
  const mail = renderMail({ kind: "invite_code", payload: { code: "012345" } }, "https://santa.example");
  const $ = load(mail.html);
  assert.ok($("body").text().includes("012345"));
  assert.ok(mail.text.includes("012345"));
  assert.ok(mail.text.includes("15 minutes"));
  assert.equal($("a").length, 0);
  const authHtml = await readFile(new URL("../supabase/templates/code.html", import.meta.url), "utf8");
  assert.ok(authHtml.includes("{{ .Token }}"));
  assert.equal(load(authHtml)("a").length, 0);
});
