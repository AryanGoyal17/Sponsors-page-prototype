// sponsors.sample.js
// -----------------------------------------------------------------------------
// MOCK data for layout/visual testing only — swap every entry for real LEAD
// sponsors (name, real logo file, blurb, link) before this goes anywhere
// near production.
//
// NOTE ON LOGOS: this used to point at https://logo.clearbit.com/{domain}.
// Clearbit's free Logo API was permanently shut down on Dec 8, 2025 (folded
// into HubSpot's Breeze Intelligence after the acquisition) — every request
// to logo.clearbit.com now simply fails to connect, which is the actual
// reason nothing was rendering on the orb. It wasn't a Three.js/texture
// problem, the source images never arrived.
//
// Fix here: generate a tiny inline SVG data-URI per sponsor. No network
// request, no third-party dependency, no CORS handling needed (data: URIs
// never taint a <canvas>), and it sidesteps hot-linking real trademarked
// logos for a mock dataset. For the real page, replace `logoUrl` with a
// self-hosted file, e.g. `/logos/your-sponsor.svg` (drop the file in
// `public/logos/`) — same reasoning as above: don't depend on someone
// else's endpoint for a static asset you control.
// -----------------------------------------------------------------------------

function placeholderLogo(label, hue) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="hsl(${hue} 70% 18%)" />
      <text x="64" y="78" font-family="Space Grotesk, system-ui, sans-serif"
            font-size="44" font-weight="700" text-anchor="middle"
            fill="hsl(${hue} 90% 78%)">${label}</text>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const sponsorsSample = [
  { id: "google", name: "Google", logoUrl: placeholderLogo("Go", 210), blurb: "Placeholder blurb — replace with real sponsor copy.", link: "https://google.com" },
  { id: "microsoft", name: "Microsoft", logoUrl: placeholderLogo("Ms", 195), blurb: "Placeholder blurb — replace with real sponsor copy.", link: "https://microsoft.com" },
  { id: "spotify", name: "Spotify", logoUrl: placeholderLogo("Sp", 140), blurb: "Placeholder blurb — replace with real sponsor copy.", link: "https://spotify.com" },
  { id: "adobe", name: "Adobe", logoUrl: placeholderLogo("Ad", 0), blurb: "Placeholder blurb — replace with real sponsor copy.", link: "https://adobe.com" },
  { id: "notion", name: "Notion", logoUrl: placeholderLogo("No", 260), blurb: "Placeholder blurb — replace with real sponsor copy.", link: "https://notion.so" },
  { id: "figma", name: "Figma", logoUrl: placeholderLogo("Fi", 320), blurb: "Placeholder blurb — replace with real sponsor copy.", link: "https://figma.com" },
  { id: "vercel", name: "Vercel", logoUrl: placeholderLogo("Ve", 0), blurb: "Placeholder blurb — replace with real sponsor copy.", link: "https://vercel.com" },
  { id: "stripe", name: "Stripe", logoUrl: placeholderLogo("St", 255), blurb: "Placeholder blurb — replace with real sponsor copy.", link: "https://stripe.com" },
  { id: "github", name: "GitHub", logoUrl: placeholderLogo("Gh", 270), blurb: "Placeholder blurb — replace with real sponsor copy.", link: "https://github.com" },
  { id: "slack", name: "Slack", logoUrl: placeholderLogo("Sl", 300), blurb: "Placeholder blurb — replace with real sponsor copy.", link: "https://slack.com" },
];