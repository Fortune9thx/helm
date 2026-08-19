"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DecisionBadge } from "@/components/DecisionBadge";
import type { HelmDecision } from "@/lib/helm-abi";

const DECISIONS: { key: HelmDecision; description: string }[] = [
  { key: "PAUSE", description: "Halt protocol operation when a trigger condition demands it." },
  { key: "REBALANCE", description: "Signal a rebalancing action across positions or reserves." },
  { key: "SWITCH_ORACLE", description: "Recommend switching the configured oracle or data source." },
  { key: "ADJUST_PARAM", description: "Recommend adjusting a numeric or operational parameter." },
  { key: "ALERT", description: "Notify a human operator without changing on-chain state." },
  { key: "NO_ACTION", description: "The default, fail-closed outcome — nothing changes." },
];

const STEPS = [
  {
    n: "01",
    title: "Register a policy",
    body: "Any protocol writes its operational trigger in plain language and points Helm at the live data URL(s) it should check.",
  },
  {
    n: "02",
    title: "Trigger evaluation",
    body: "Anyone — a keeper, a cron job, an operator — calls evaluate_policy(). Helm fetches the live data fresh, every time.",
  },
  {
    n: "03",
    title: "Consensus under the Equivalence Principle",
    body: "Independent validators each reason over the same policy and data. A decision only lands if they agree — otherwise it fails closed.",
  },
  {
    n: "04",
    title: "Structured, on-chain decision",
    body: "A typed decision, confidence score, reasoning, and cited evidence are recorded on-chain for any downstream contract or keeper to read.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative">
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 pb-24 pt-28 text-center sm:pt-36">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-4 py-1.5 text-xs font-medium tracking-wide text-text-secondary"
        >
          <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-cyan" />
          Live on GenLayer Bradbury testnet
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-8 text-5xl font-semibold tracking-tight sm:text-7xl"
        >
          <span className="cyan-gradient-text">Helm</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-5 max-w-2xl text-lg text-text-secondary sm:text-xl"
        >
          Intelligent Operational Control Layer for On-Chain Protocols.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-4 max-w-xl text-sm text-text-muted sm:text-base"
        >
          Register a natural-language operational policy once. Helm fetches live data, evaluates it
          under GenLayer&rsquo;s Equivalence Principle, and records a structured, consensus-backed
          decision your protocol can act on — pause, rebalance, switch oracle, adjust a parameter,
          alert an operator, or do nothing.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Button asChild size="lg">
            <Link href="/dashboard">Open Dashboard</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/explorer">Explore Policies</Link>
          </Button>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">How it works</h2>
          <p className="mt-2 text-sm text-text-secondary">
            No claims, no disputes — pure operational intelligence, end to end.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <Card className="h-full">
                <span className="font-mono text-xs text-cyan-dim">{step.n}</span>
                <h3 className="mt-3 text-base font-semibold text-text-primary">{step.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{step.body}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
            A closed set of operational decisions
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Structured output only — never free text, never an unbounded action space.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DECISIONS.map((d, i) => (
            <motion.div
              key={d.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
            >
              <Card>
                <DecisionBadge decision={d.key} />
                <p className="mt-3 text-sm text-text-secondary">{d.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-28">
        <Card className="p-8 sm:p-10" hover={false}>
          <h2 className="text-xl font-semibold text-text-primary">
            Built for correctness, not just demos
          </h2>
          <ul className="mt-5 space-y-3 text-sm text-text-secondary">
            <li className="flex gap-3">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
              Every LLM output is fenced, closed-enum, confidence-gated, and fails closed to
              <code className="mx-1 rounded bg-void-raised px-1.5 py-0.5 font-mono text-xs text-cyan">NO_ACTION</code>
              on any parsing error, schema violation, or low confidence.
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
              Decisions only land on-chain once independent validators agree under the
              Equivalence Principle — not a single model&rsquo;s opinion.
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
              Downstream contracts pull Helm&rsquo;s decision via a verified read pattern — a
              deliberate, tested architecture, not a shortcut.
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
