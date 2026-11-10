import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { request } from "node:https";
import ipaddr from "ipaddr.js";
import { excludedMerchant, safeLink, safeProductImage } from "./format";

const MAX_HTML_BYTES = 2_500_000;
const exampleDomains = ["example.com", "example.net", "example.org"];

export function publicMerchantUrl(value: string) {
  const url = safeLink(value);
  if (!url || url.port || excludedMerchant(url.hostname)) return null;
  url.protocol = "https:";
  url.hash = "";
  url.hostname = url.hostname.replace(/\.$/, "");
  return safeProductImage(url.href);
}

const productParameters = new Set(["id", "product", "productid", "product_id", "sku", "asin", "item", "itemid", "item_id", "pid", "variant", "article", "reference"]);

export function importFailureKey(value: string) {
  const url = publicMerchantUrl(value);
  if (!url) return null;
  const parameters = [...url.searchParams].filter(([name, value]) =>
    productParameters.has(name.toLowerCase()) && /^[a-z0-9_-]{1,80}$/i.test(value));
  url.search = new URLSearchParams(parameters).toString();
  url.searchParams.sort();
  return { url: url.href, merchant: url.hostname };
}

export function isPublicAddress(value: string) {
  const address = ipaddr.process(value);
  if (address.range() !== "unicast") return false;
  // A public IPv6 address must be in the global unicast allocation.
  return address instanceof ipaddr.IPv4 || address.match(ipaddr.IPv6.parse("2000::"), 3);
}

export type MerchantPage = { redirect: string } | { html: Buffer } | null;

export async function readMerchantPage(url: URL, signal: AbortSignal): Promise<MerchantPage> {
  if (exampleDomains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return null;
  const addresses = await new Promise<LookupAddress[]>((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    void lookup(url.hostname, { all: true })
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) return null;
  const { address, family } = addresses.find(({ family }) => family === 4) ?? addresses[0];

  return new Promise((resolve, reject) => {
    const req = request(url, {
      signal,
      agent: false,
      family,
      lookup: (_hostname, _options, callback) => callback(null, address, family),
      headers: {
        "Accept-Language": "fr-FR,fr;q=0.9",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Encoding": "identity",
        "User-Agent": "MonSuperSecretSanta/1.0 (product metadata import)",
      },
    }, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        resolve({ redirect: location });
        response.destroy();
        return;
      }
      if (status < 200 || status >= 300 || !response.headers["content-type"]?.includes("html") ||
        Number(response.headers["content-length"]) > MAX_HTML_BYTES) {
        resolve(null);
        response.destroy();
        return;
      }
      let bytes = 0;
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_HTML_BYTES) {
          resolve(null);
          response.destroy();
          return;
        }
        chunks.push(chunk);
      });
      response.once("end", () => resolve({ html: Buffer.concat(chunks, bytes) }));
      response.once("error", reject);
    });
    req.once("error", reject);
    req.end();
  });
}
