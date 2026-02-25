import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getTodayNY(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const source = body.source || "h2b";
    const today = body.date || getTodayNY();

    const urls: Record<string, string> = {
      jo: `https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/jo/${today}`,
      h2a: `https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/h2a/${today}`,
      h2b: `https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/h2b/${today}`,
    };

    const apiUrl = urls[source];
    if (!apiUrl) throw new Error("Invalid source");

    console.log(`Fetching ${apiUrl}`);
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`DOL returned ${response.status}`);

    const zipBytes = new Uint8Array(await response.arrayBuffer());
    const unzipped = unzipSync(zipBytes);

    const jsonFileName = Object.keys(unzipped).find((f) => f.endsWith(".json"));
    if (!jsonFileName) throw new Error("No JSON file found in ZIP");

    const allItems = JSON.parse(new TextDecoder().decode(unzipped[jsonFileName]));

    // Get first 2 items and show ALL their keys (including nested)
    const samples = allItems.slice(0, 2);
    
    // Flatten to show all keys
    function getAllKeys(obj: any, prefix = ""): string[] {
      const keys: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        keys.push(fullKey);
        if (v && typeof v === "object" && !Array.isArray(v)) {
          keys.push(...getAllKeys(v, fullKey));
        }
      }
      return keys;
    }

    const allKeys = getAllKeys(samples[0]);
    
    // Extract date-related fields
    const dateKeys = allKeys.filter(k => 
      k.toLowerCase().includes("date") || 
      k.toLowerCase().includes("begin") || 
      k.toLowerCase().includes("end") || 
      k.toLowerCase().includes("start") ||
      k.toLowerCase().includes("tempneed")
    );

    // Get the actual values for date fields from first sample
    function getNestedValue(obj: any, path: string): any {
      return path.split(".").reduce((o, k) => o?.[k], obj);
    }

    const dateValues: Record<string, any> = {};
    for (const key of dateKeys) {
      dateValues[key] = getNestedValue(samples[0], key);
    }

    return new Response(JSON.stringify({
      source,
      date: today,
      total_items: allItems.length,
      all_top_level_keys: Object.keys(samples[0]),
      date_related_keys: dateKeys,
      date_values_sample: dateValues,
      full_first_item: samples[0],
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
