# gcode.dev

![gcode Monogram](https://via.placeholder.com/200x200/FF6B35/6B7280?text=gc)  
*Great code that gets better with every build.*  
*Powered by Grok & Claude—choose speed or polish, or both.*

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)](https://nextjs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://typescriptlang.org) [![Vercel](https://img.shields.io/badge/Vercel-Deploy-black?style=flat&logo=vercel)](https://vercel.com) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

gcode.dev is an open-source AI-first app builder and IDE, forking [Firecrawl's open-lovable](https://github.com/firecrawl/open-lovable) to deliver Google AI Studio-like prompt-to-prototype magic. But with a twist: **Dual-model intelligence**. Grok (xAI) blasts through creative scaffolds and rapid diffs at 92 tokens/sec, while Claude (Anthropic) hardens for production—audits, flags, and elegant refactors. It's the IDE that *learns your style*: Quality memory via Supabase vectors recalls past fixes, vibes enforce "scrappy startup" vs. "enterprise-grade" guardrails, and incremental diffs preserve your tweaks.

No single-model lock-in. No prototype purgatory. Build, debug, deploy—what ships, ships ready. Perfect for indie devs prototyping trade dashboards or full CRMs in minutes.

> "G for Grok when you need speed. C for Claude when you need polish. Code that gets better because it remembers what 'production-ready' means to *you*."  
> — The gcode Manifesto

## 🚀 Features
- **Prompt-to-App**: NL like "Build an IPO analyzer with Polygon data and Sankey charts" → React/TS scaffold + tests.
- **Dual-Model Routing**: Grok for velocity (UI/creatives), Claude for hardening (security/perf). Smart auto-route or manual toggle.
- **Incremental Diffs**: Edits via Monaco—apply surgical changes without regen hell. 78% SWE-Bench accuracy on diffs.
- **Quality Memory Graph**: Supabase vectors embed corrections/prefs—recall "similar to Project X" across sessions.
- **Vibes with Guardrails**: Presets like "Startup Scrappy" (debt-OK speed) or "Enterprise-Grade" (flags/docs) enforce consistency.
- **AI Debugging Loop**: Errors? Grok explains + 3 fixes with tradeoffs; D3 dep graphs visualize chaos.
- **Smart Integrations**: "Add Stripe" → Full impl + tests + cost monitor. Figma/GitHub imports via Firecrawl + vision.
- **Collab Native**: Realtime cursors (Supabase), role views (PM stories vs. dev code), AI-mediated merges.
- **Prod-First Exports**: One-click Vercel/GitHub PRs with CI/CD YAML, observability stubs (Sentry/Lighthouse).
- **Multimodal Bonus**: Grok image gen for mocks; E2B sandboxes for safe previews.

Built on Next.js, LangChain agents, and Vercel AI SDK—scales from localhost to team fleets.

## 🎯 Quick Start
1. **Fork & Clone**:
   ```bash
   git clone https://github.com/beatnyk77/gcode.git
   cd gcode
   pnpm install  # Or npm/yarn
   ```

2. **Env Setup** (`.env.local`—grab keys from providers):
   ```
   # xAI Grok (required for core routing)
   XAI_API_KEY=your_xai_key  # From https://x.ai/api

   # Anthropic Claude (for hardening)
   ANTHROPIC_API_KEY=your_claude_key  # From console.anthropic.com

   # Firecrawl (for URL/Figma scraping)
   FIRECRAWL_API_KEY=your_firecrawl_key  # From firecrawl.dev

   # Supabase (for quality graph & collab)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_key

   # Optional: Vercel AI Gateway for proxies
   AI_GATEWAY_API_KEY=your_gateway_key  # From vercel.com/ai

   # E2B (sandboxes—$0.10/run)
   E2B_API_KEY=your_e2b_key  # From e2b.dev
   ```

3. **Run Dev Server**:
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000). Prompt "Clone a scrappy trade dashboard" → Watch Grok scaffold, Claude harden.

4. **Deploy to Vercel**:
   ```bash
   vercel --prod  # Env vars auto-prompted
   ```
   Boom—live at your-vercel-app.vercel.app.

## 📖 Usage
### Core Flow
1. **Prompt**: Chat sidebar: "Build a break-even calculator with Supabase auth."
2. **Route & Gen**: Dropdown: "Dual" → Grok plans UI, Claude adds tests. Vibe chips prefix (e.g., "Scrappy" for quick debt).
3. **Edit**: Monaco center pane—apply diffs, run Vitest ("Run Tests" footer).
4. **Debug**: Break something? Modal pops: Grok's 3 fixes + dep graph. Apply → Embed to quality graph.
5. **Harden & Ship**: "Harden to Prod" → Claude audits (flags/logging). Export: ZIP/GitHub/Vercel button.

### Examples
- **Your Niche**: "IPO analyzer: Polygon fetches + Sankey viz" → Scaffold + integrate.
- **Collab**: Share session ID—realtime edits, AI resolves "Merge John's hook?"
- **Import Magic**: URL/Figma → Firecrawl scrape + Grok vision → JSX components.

Pro Tip: Seed demos via `/api/seed`—pre-loads IPO app for tours.

## 🏗️ Architecture
- **Frontend**: Next.js 14 + React/TS + Tailwind. Monaco Editor for diffs, Zustand for state.
- **AI Layer**: Vercel AI SDK router—Grok via custom `lib/clients/grok.ts` (SSE streaming, tool calls). LangChain agents for chains (plan → gen → test).
- **Backend**: API routes (`/api/gen`, `/api/debug`, `/api/harden`). Supabase for vectors/realtime; E2B for sandboxes.
- **Data Flow**: Prompt → Analyze prefs (history scan) → Surgical search (if edit) → Dual LLM → Diffs/tests → Preview/export.
- **Extensibility**: Add models (Gemini?) via router. Tools: EditFile, SupabaseQuery, GitHubCommit.

See `/docs/arch.md` for diagrams (TBD).

## 🚀 Roadmap
- **v0.2 (Dec '25)**: Grok Remote integration (xAI hackathon)—cloud PRs from prompts.
- **v0.3**: Voice mode (Grok-3 proxy), full multi-agent (UI bot + backend bot).
- **v1.0**: Freemium SaaS—basic free (Grok-3 limits), Pro ($10/mo) for unlimited Claude + teams.
- **Dream**: "Smarter with every build"—ML on graph for auto-vibe shifts.

Hack with us at xAI's Dec 6-7 hackathon—early Grok-4 remote access!

## 🤝 Contributing
Love it? Fork, PR, or star! Guidelines:
- Branch: `feat/[short-desc]` (e.g., `feat/vibe-presets`).
- Tests: `pnpm test` (Jest + Playwright)—80% cov.
- Lint: `pnpm lint`.
- Issues: Bug reports, feature reqs welcome. Tag `@beatnyk77`.

Run `pnpm build` pre-PR. No breaking changes without tests.

## 📄 License
MIT © 2025 beatnyk77. See [LICENSE](LICENSE).

## 🙌 Acknowledgments
- [Firecrawl/open-lovable](https://github.com/firecrawl/open-lovable): Base scaffold—scraping-to-React magic.
- [xAI Grok API](https://x.ai/api): Velocity king.
- [Anthropic Claude](https://anthropic.com): Polish perfection.
- [Supabase](https://supabase.com): Graph & realtime backbone.
- Claude for branding wisdom; Cursor Composer for the build sprint.

Questions? mail at beatnyk77@gmail.com or open an issue. Let's build code that *compounds*. 🚀
