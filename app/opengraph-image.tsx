import { ImageResponse } from "next/og";

import { SITE } from "@/lib/site";

export const alt = SITE.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        backgroundColor: "#ffffff",
        color: "#1f1f1f",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontSize: 34,
          fontWeight: 700,
          color: "#0b57d0",
        }}
      >
        loopin
      </div>
      <div
        style={{
          display: "flex",
          marginTop: "28px",
          fontSize: 62,
          fontWeight: 700,
          lineHeight: 1.1,
          maxWidth: "900px",
        }}
      >
        {SITE.tagline}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: "28px",
          fontSize: 30,
          color: "#5f6368",
          maxWidth: "900px",
        }}
      >
        AI extracts events from screenshots &amp; notes, then syncs them to
        Google Calendar.
      </div>
    </div>,
    size,
  );
}
