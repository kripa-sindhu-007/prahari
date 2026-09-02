import { ImageResponse } from "next/og";

/**
 * The social card every shared link renders — HN, Reddit, LinkedIn, X, Slack.
 *
 * Generated rather than checked in as a PNG so it cannot drift from the brand
 * or the tagline, and so there is no binary in the repo to keep in sync. The
 * metadata already declares `summary_large_image`; without this file that
 * promise renders as an empty card, which is worse than claiming nothing.
 */

export const runtime = "edge";
export const alt =
  "prahari — type-safe environment variables for TypeScript that can't drift from your .env.example";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0B0F14",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark + the Devanagari the name comes from */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#E6EDF3" }}>prahari</div>
          <div style={{ fontSize: 34, color: "#22C55E" }}>प्रहरी</div>
        </div>

        {/* Satori requires an explicit display on any element with more than
            one child, so every stacked block below is a flex container. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 62,
              fontWeight: 700,
              color: "#E6EDF3",
              letterSpacing: "-0.02em",
            }}
          >
            <div style={{ display: "flex" }}>Type-safe environment</div>
            <div style={{ display: "flex" }}>variables for TypeScript</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 30,
              color: "#8B949E",
            }}
          >
            <div style={{ display: "flex" }}>Validated at boot. And a CLI that stops your</div>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ color: "#22C55E" }}>.env.example</span>
              <span>from ever drifting again.</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {["zero dependencies", "Zod · Valibot · ArkType", "Next.js · Vite"].map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                fontSize: 24,
                color: "#8B949E",
                border: "1px solid #1F2933",
                borderRadius: 999,
                padding: "10px 22px",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
