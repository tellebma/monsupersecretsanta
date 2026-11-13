import { test } from "node:test";
import assert from "node:assert/strict";
import { analyticsUrl } from "../lib/analytics.ts";

test("analytics removes URL parameters and private route values", () => {
  const origin = "https://monsupersecretsanta.vercel.app";
  for (const [input, output] of [
    ["/connexion?email=secret@example.com#code", "/connexion"],
    ["/invitation/private-token?email=secret@example.com", "/invitation/[token]"],
    ["/groupes/private-id?member=private-member", "/groupes/[edition]"],
    ["/mes-cadeaux/private-gift", "/mes-cadeaux/[gift]"],
    ["/mes-cadeaux/chercher?q=secret", "/mes-cadeaux/chercher"],
    ["/groupes/nouveau", "/groupes/nouveau"],
  ]) assert.equal(analyticsUrl(origin + input), origin + output);
});

test("analytics drops unknown routes and authentication callbacks", () => {
  for (const path of ["/auth/callback?code=secret", "/unknown/private-value", "/api/schedule"]) {
    assert.equal(analyticsUrl(`https://monsupersecretsanta.vercel.app${path}`), null);
  }
  assert.equal(analyticsUrl("invalid"), null);
});
