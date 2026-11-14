// ISO 3166-1 alpha-2 codes; names are resolved with Intl.DisplayNames.
export const COUNTRY_CODES = [
  "AE","AR","AT","AU","BD","BE","BG","BH","BR","CA","CH","CL","CN","CO","CY","CZ","DE","DK","DZ","EE",
  "EG","ES","ET","FI","FR","GB","GR","HK","HR","HU","ID","IE","IL","IN","IQ","IR","IS","IT","JO","JP",
  "KE","KR","KW","LB","LK","LT","LU","LV","LY","MA","MT","MX","MY","NG","NL","NO","NZ","OM","PE","PH",
  "PK","PL","PS","PT","QA","RO","RS","RU","SA","SD","SE","SG","SI","SK","SN","SY","TH","TN","TR","TW",
  "UA","US","UY","VN","YE","ZA",
];

export function countryName(code, locale = "en") {
  if (!code) return "";
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    return dn.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

export function countryList(locale = "en") {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, locale) })).sort((a, b) =>
    a.name.localeCompare(b.name, locale)
  );
}

/** Best-effort country detection from the visitor's IP address. */
export async function detectCountryFromIp() {
  const endpoints = [
    { url: "https://ipapi.co/json/", pick: (j) => j.country_code },
    { url: "https://ipwho.is/", pick: (j) => j.country_code },
  ];
  for (const ep of endpoints) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(ep.url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = await res.json();
      const code = ep.pick(json);
      if (code && /^[A-Za-z]{2}$/.test(code)) return code.toUpperCase();
    } catch {
      /* try next provider */
    }
  }
  return "";
}

/** International dialling codes for the supported countries. */
export const DIAL_CODES = {
  AE: "+971", AR: "+54", AT: "+43", AU: "+61", BD: "+880", BE: "+32", BG: "+359", BH: "+973",
  BR: "+55", CA: "+1", CH: "+41", CL: "+56", CN: "+86", CO: "+57", CY: "+357", CZ: "+420",
  DE: "+49", DK: "+45", DZ: "+213", EE: "+372", EG: "+20", ES: "+34", ET: "+251", FI: "+358",
  FR: "+33", GB: "+44", GR: "+30", HK: "+852", HR: "+385", HU: "+36", ID: "+62", IE: "+353",
  IL: "+972", IN: "+91", IQ: "+964", IR: "+98", IS: "+354", IT: "+39", JO: "+962", JP: "+81",
  KE: "+254", KR: "+82", KW: "+965", LB: "+961", LK: "+94", LT: "+370", LU: "+352", LV: "+371",
  LY: "+218", MA: "+212", MT: "+356", MX: "+52", MY: "+60", NG: "+234", NL: "+31", NO: "+47",
  NZ: "+64", OM: "+968", PE: "+51", PH: "+63", PK: "+92", PL: "+48", PS: "+970", PT: "+351",
  QA: "+974", RO: "+40", RS: "+381", RU: "+7", SA: "+966", SD: "+249", SE: "+46", SG: "+65",
  SI: "+386", SK: "+421", SN: "+221", SY: "+963", TH: "+66", TN: "+216", TR: "+90", TW: "+886",
  UA: "+380", US: "+1", UY: "+598", VN: "+84", YE: "+967", ZA: "+27",
};

export function dialCode(code) {
  if (!code) return "";
  return DIAL_CODES[code.toUpperCase()] || "";
}

/** Country options with their dialling codes, sorted by name. */
export function dialCodeList(locale = "en") {
  return countryList(locale)
    .map((c) => ({ ...c, dial: dialCode(c.code) }))
    .filter((c) => c.dial);
}
