# services/analysis — not built yet

Home for heavier AI/analysis jobs when they outgrow Next.js API routes (long-running
graph workflows, batch analysis over the whole timeline, agent pipelines).

Language is deliberately undecided — Python (LangChain/LangGraph ecosystem) vs Rust
(performance, learning goal). Decide as an ADR when the first real workload lands here;
until then, AI jobs stay in `apps/web/lib/ai/*` because Vercel functions + AI Gateway
are simple and free of extra infra.

Contract when it exists: reads the same Neon Postgres, writes results back as events /
derived rows through the Core API. No second database (CLAUDE.md architecture rule).
