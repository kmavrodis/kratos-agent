#!/usr/bin/env node
// core-banking-mcp-server — stdio MCP server that mocks a retail core-banking
// platform against curated JSON fixtures. Customers, accounts, transactions,
// cards, products, disputes, plus write tools for raising disputes, blocking
// cards, transferring funds, and refunding transactions. All data is fictional;
// writes mutate in-memory state for the lifetime of the process.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "data");

// ── Types ─────────────────────────────────────────────────────────────────

type Customer = {
  id: string; first_name: string; last_name: string; preferred_name: string;
  date_of_birth: string; email: string; phone: string;
  address_line_1: string; address_line_2: string | null;
  city: string; state: string; zip: string; country: string;
  customer_since: string;
  segment: "Mass" | "Mass Affluent" | "Premier" | "Private";
  kyc_status: "Verified" | "Pending" | "Failed";
  marketing_consent: boolean;
  preferred_branch: string;
};
type Account = {
  id: string; customer_id: string;
  type: "Checking" | "Savings" | "Brokerage" | "Mortgage" | "Loan" | "CreditCard";
  product_code: string; nickname: string;
  iban: string | null; account_number_last4: string;
  balance_usd: number; available_usd: number; currency: string;
  status: "Active" | "Frozen" | "Closed";
  opened_date: string; interest_rate_pct: number; overdraft_limit_usd: number;
};
type Transaction = {
  id: string; account_id: string; posted_date: string;
  amount_usd: number; currency: string;
  direction: "credit" | "debit";
  channel: "Card" | "ACH" | "Wire" | "BillPay" | "ATM" | "Branch" | "P2P";
  merchant: string; category: string;
  status: "Posted" | "Pending" | "Disputed" | "Refunded" | "Reversed";
  memo: string;
};
type Card = {
  id: string; customer_id: string; account_id: string | null;
  type: "Debit" | "Credit";
  network: "Visa" | "Mastercard" | "Amex" | "Discover";
  last4: string;
  status: "Active" | "Blocked" | "Lost" | "Stolen" | "Cancelled";
  issued_date: string; expiry: string;
  credit_limit_usd: number | null; balance_usd: number | null;
  block_reason?: string;
};
type Dispute = {
  id: string; transaction_id: string; customer_id: string;
  opened_date: string; amount_usd: number; reason: string;
  status: "Open" | "Under Review" | "Resolved — Customer" | "Resolved — Merchant" | "Closed";
  provisional_credit_usd: number;
  provisional_credited_at: string | null;
  agent_id: string;
  expected_resolution_by: string;
};
type Product = {
  code: string; name: string;
  type: "Checking" | "Savings" | "Loan" | "Investment" | "CreditCard";
  monthly_fee_usd: number; interest_rate_pct: number; min_balance_usd: number;
  perks: string[]; eligibility: string;
};

// ── Load fixtures into mutable in-memory store ────────────────────────────

const load = <T>(file: string): T =>
  JSON.parse(readFileSync(path.join(dataDir, file), "utf-8")) as T;

const customers:    Customer[]    = load("customers.json");
const accounts:     Account[]     = load("accounts.json");
const transactions: Transaction[] = load("transactions.json");
const cards:        Card[]        = load("cards.json");
const disputes:     Dispute[]     = load("disputes.json");
const products:     Product[]     = load("products.json");

let nextDspSeq = 9000;
let nextTxnSeq = 39000;

const text = (obj: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }],
});
const notFound = (kind: string, id: string) => ({
  content: [{ type: "text" as const, text: JSON.stringify({ error: "not_found", kind, id }) }],
  isError: true,
});
const today = () => new Date().toISOString().slice(0, 10);

// Masks for output safety — never echo a full PAN, even fictional.
const maskAccount = (last4: string) => `****${last4}`;
const maskCard = (last4: string) => `**** **** **** ${last4}`;

const server = new McpServer({
  name: "core-banking-mcp-server",
  version: "0.1.0",
});

// ── Customers ─────────────────────────────────────────────────────────────

server.registerTool(
  "banking_search_customers_by_name",
  {
    title: "Search customers by name",
    description: "Case-insensitive substring match on first/last/preferred name + email.",
    inputSchema: { query: z.string().min(1).describe("Substring to match.") },
  },
  async ({ query }) => {
    const q = query.toLowerCase();
    const matches = customers.filter((c) =>
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      c.preferred_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
    return text({ matches, total: matches.length });
  }
);

server.registerTool(
  "banking_get_customer",
  {
    title: "Get one customer",
    description:
      "Fetch a customer by id including KYC status, segment, and preferred branch. " +
      "Use after a name search.",
    inputSchema: { customer_id: z.string().describe("Customer id, e.g. CUS-10001.") },
  },
  async ({ customer_id }) => {
    const c = customers.find((x) => x.id === customer_id);
    return c ? text(c) : notFound("customer", customer_id);
  }
);

// ── Accounts ──────────────────────────────────────────────────────────────

server.registerTool(
  "banking_list_accounts",
  {
    title: "List accounts (optionally for one customer)",
    description: "List accounts, optionally scoped to a customer or to one type (e.g. only Checking).",
    inputSchema: {
      customer_id: z.string().optional(),
      type: z.enum(["Checking", "Savings", "Brokerage", "Mortgage", "Loan", "CreditCard"]).optional(),
      status: z.enum(["Active", "Frozen", "Closed"]).optional(),
    },
  },
  async ({ customer_id, type, status }) => {
    let pool = accounts;
    if (customer_id) pool = pool.filter((a) => a.customer_id === customer_id);
    if (type) pool = pool.filter((a) => a.type === type);
    if (status) pool = pool.filter((a) => a.status === status);
    const masked = pool.map((a) => ({ ...a, account_number_last4: maskAccount(a.account_number_last4) }));
    return text({ accounts: masked, total: masked.length });
  }
);

server.registerTool(
  "banking_get_account",
  {
    title: "Get one account",
    description: "Fetch an account by id. Account number is masked to last-4.",
    inputSchema: { account_id: z.string().describe("Account id, e.g. ACC-20001.") },
  },
  async ({ account_id }) => {
    const a = accounts.find((x) => x.id === account_id);
    if (!a) return notFound("account", account_id);
    return text({ ...a, account_number_last4: maskAccount(a.account_number_last4) });
  }
);

// ── Transactions ──────────────────────────────────────────────────────────

server.registerTool(
  "banking_list_transactions",
  {
    title: "List transactions for an account",
    description:
      "Return transactions for one account, newest first, with optional date range " +
      "and status filter. Default limit 25.",
    inputSchema: {
      account_id: z.string(),
      from_date: z.string().optional().describe("ISO date inclusive."),
      to_date: z.string().optional().describe("ISO date inclusive."),
      status: z.enum(["Posted", "Pending", "Disputed", "Refunded", "Reversed"]).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
  },
  async ({ account_id, from_date, to_date, status, limit }) => {
    let pool = transactions.filter((t) => t.account_id === account_id);
    if (from_date) pool = pool.filter((t) => t.posted_date >= from_date);
    if (to_date)   pool = pool.filter((t) => t.posted_date <= to_date);
    if (status)    pool = pool.filter((t) => t.status === status);
    pool = [...pool].sort((a, b) => b.posted_date.localeCompare(a.posted_date));
    return text({ transactions: pool.slice(0, limit ?? 25), total: pool.length });
  }
);

server.registerTool(
  "banking_get_transaction",
  {
    title: "Get one transaction",
    description: "Fetch a single transaction by id including merchant, category, and status.",
    inputSchema: { transaction_id: z.string().describe("Transaction id, e.g. TXN-30006.") },
  },
  async ({ transaction_id }) => {
    const t = transactions.find((x) => x.id === transaction_id);
    return t ? text(t) : notFound("transaction", transaction_id);
  }
);

// ── Cards ─────────────────────────────────────────────────────────────────

server.registerTool(
  "banking_list_cards",
  {
    title: "List cards (for a customer)",
    description: "Return cards held by a customer. Card numbers are masked to last-4 in output.",
    inputSchema: {
      customer_id: z.string(),
      status: z.enum(["Active", "Blocked", "Lost", "Stolen", "Cancelled"]).optional(),
    },
  },
  async ({ customer_id, status }) => {
    let pool = cards.filter((c) => c.customer_id === customer_id);
    if (status) pool = pool.filter((c) => c.status === status);
    const masked = pool.map((c) => ({ ...c, last4: c.last4, masked_pan: maskCard(c.last4) }));
    return text({ cards: masked, total: masked.length });
  }
);

server.registerTool(
  "banking_block_card",
  {
    title: "Block (or freeze) a card",
    description:
      "Block a card with a reason — typical reasons: 'Lost', 'Stolen', 'Suspected fraud'. " +
      "The agent MUST show the user the draft + ask_user confirm before calling this tool.",
    inputSchema: {
      card_id: z.string().describe("Card id, e.g. CRD-50001."),
      block_status: z.enum(["Blocked", "Lost", "Stolen"]).default("Blocked"),
      reason: z.string().min(1).describe("Free-text reason logged on the card."),
    },
  },
  async ({ card_id, block_status, reason }) => {
    const c = cards.find((x) => x.id === card_id);
    if (!c) return notFound("card", card_id);
    c.status = block_status;
    c.block_reason = `${reason} (set ${today()})`;
    return text({ ok: true, card: { ...c, masked_pan: maskCard(c.last4) } });
  }
);

// ── Disputes ──────────────────────────────────────────────────────────────

server.registerTool(
  "banking_list_disputes",
  {
    title: "List disputes",
    description: "List disputes, optionally filtered by customer or status.",
    inputSchema: {
      customer_id: z.string().optional(),
      status: z.enum(["Open", "Under Review", "Resolved — Customer", "Resolved — Merchant", "Closed"]).optional(),
    },
  },
  async ({ customer_id, status }) => {
    let pool = disputes;
    if (customer_id) pool = pool.filter((d) => d.customer_id === customer_id);
    if (status) pool = pool.filter((d) => d.status === status);
    return text({ disputes: pool, total: pool.length });
  }
);

server.registerTool(
  "banking_raise_dispute",
  {
    title: "Raise a dispute on a transaction",
    description:
      "Open a new dispute on a card transaction. Marks the transaction as Disputed. " +
      "If `with_provisional_credit` is true, also credits the disputed amount to the " +
      "customer's account immediately and records it on the dispute. Agent MUST confirm " +
      "the wording and the provisional-credit decision with the user before calling.",
    inputSchema: {
      transaction_id: z.string(),
      reason: z.string().min(3),
      agent_id: z.string().describe("AGT-* id of the CSR handling the case."),
      with_provisional_credit: z.boolean().default(true),
    },
  },
  async ({ transaction_id, reason, agent_id, with_provisional_credit }) => {
    const t = transactions.find((x) => x.id === transaction_id);
    if (!t) return notFound("transaction", transaction_id);
    const a = accounts.find((x) => x.id === t.account_id);
    if (!a) return notFound("account", t.account_id);

    const dsp: Dispute = {
      id: `DSP-${++nextDspSeq}`,
      transaction_id, customer_id: a.customer_id,
      opened_date: today(),
      amount_usd: Math.abs(t.amount_usd),
      reason,
      status: "Open",
      provisional_credit_usd: with_provisional_credit ? Math.abs(t.amount_usd) : 0,
      provisional_credited_at: with_provisional_credit ? today() : null,
      agent_id,
      expected_resolution_by: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    };
    disputes.push(dsp);
    t.status = "Disputed";
    t.memo = `${t.memo ? t.memo + " — " : ""}Disputed: ${reason} (${dsp.id})`;

    if (with_provisional_credit) {
      a.balance_usd = +(a.balance_usd + Math.abs(t.amount_usd)).toFixed(2);
      a.available_usd = +(a.available_usd + Math.abs(t.amount_usd)).toFixed(2);
    }
    return text({ ok: true, dispute: dsp, transaction_updated: t, account_balance_after: { account_id: a.id, balance_usd: a.balance_usd } });
  }
);

// ── Refunds & transfers ───────────────────────────────────────────────────

server.registerTool(
  "banking_refund_transaction",
  {
    title: "Refund a transaction",
    description:
      "Issue a refund for a transaction directly to the original account (creates a credit " +
      "transaction and marks the original as Refunded). Agent MUST confirm the refund amount " +
      "and the recipient account with the user before calling.",
    inputSchema: {
      transaction_id: z.string(),
      amount_usd: z.number().positive().optional().describe("Defaults to the full transaction amount."),
      agent_id: z.string(),
      memo: z.string().optional(),
    },
  },
  async ({ transaction_id, amount_usd, agent_id, memo }) => {
    const t = transactions.find((x) => x.id === transaction_id);
    if (!t) return notFound("transaction", transaction_id);
    const a = accounts.find((x) => x.id === t.account_id);
    if (!a) return notFound("account", t.account_id);
    const refundAmount = amount_usd ?? Math.abs(t.amount_usd);

    const refundTxn: Transaction = {
      id: `TXN-${++nextTxnSeq}`,
      account_id: a.id,
      posted_date: today(),
      amount_usd: refundAmount,
      currency: t.currency,
      direction: "credit",
      channel: t.channel,
      merchant: `REFUND — ${t.merchant}`,
      category: "Refund",
      status: "Posted",
      memo: memo ?? `Refund for ${t.id} (agent ${agent_id})`,
    };
    transactions.push(refundTxn);
    t.status = "Refunded";
    a.balance_usd = +(a.balance_usd + refundAmount).toFixed(2);
    a.available_usd = +(a.available_usd + refundAmount).toFixed(2);

    return text({ ok: true, refund: refundTxn, original_updated: t, account_balance_after: { account_id: a.id, balance_usd: a.balance_usd } });
  }
);

server.registerTool(
  "banking_transfer_between_accounts",
  {
    title: "Transfer funds between two of a customer's accounts",
    description:
      "Internal transfer between two accounts owned by the same customer. Creates a debit " +
      "transaction on the source and a credit transaction on the destination. Agent MUST " +
      "confirm both accounts and the amount with the user before calling.",
    inputSchema: {
      from_account_id: z.string(),
      to_account_id: z.string(),
      amount_usd: z.number().positive(),
      memo: z.string().optional(),
    },
  },
  async ({ from_account_id, to_account_id, amount_usd, memo }) => {
    const from = accounts.find((x) => x.id === from_account_id);
    const to   = accounts.find((x) => x.id === to_account_id);
    if (!from) return notFound("account", from_account_id);
    if (!to)   return notFound("account", to_account_id);
    if (from.customer_id !== to.customer_id) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "different_customers", from: from.customer_id, to: to.customer_id }) }],
        isError: true,
      };
    }
    if (from.available_usd < amount_usd) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "insufficient_funds", available: from.available_usd, requested: amount_usd }) }],
        isError: true,
      };
    }
    const debit: Transaction = {
      id: `TXN-${++nextTxnSeq}`,
      account_id: from.id, posted_date: today(),
      amount_usd: -amount_usd, currency: from.currency, direction: "debit",
      channel: "P2P", merchant: `Internal transfer to ${maskAccount(to.account_number_last4)}`,
      category: "Transfer", status: "Posted", memo: memo ?? "",
    };
    const credit: Transaction = {
      id: `TXN-${++nextTxnSeq}`,
      account_id: to.id, posted_date: today(),
      amount_usd, currency: to.currency, direction: "credit",
      channel: "P2P", merchant: `Internal transfer from ${maskAccount(from.account_number_last4)}`,
      category: "Transfer", status: "Posted", memo: memo ?? "",
    };
    transactions.push(debit, credit);
    from.balance_usd = +(from.balance_usd - amount_usd).toFixed(2);
    from.available_usd = +(from.available_usd - amount_usd).toFixed(2);
    to.balance_usd = +(to.balance_usd + amount_usd).toFixed(2);
    to.available_usd = +(to.available_usd + amount_usd).toFixed(2);
    return text({ ok: true, debit, credit, from_balance_after: from.balance_usd, to_balance_after: to.balance_usd });
  }
);

// ── Products ──────────────────────────────────────────────────────────────

server.registerTool(
  "banking_list_products",
  {
    title: "List product catalog",
    description: "List bank products. Use to compare options when the customer asks about upgrades or new accounts.",
    inputSchema: {
      type: z.enum(["Checking", "Savings", "Loan", "Investment", "CreditCard"]).optional(),
    },
  },
  async ({ type }) => {
    let pool = products;
    if (type) pool = pool.filter((p) => p.type === type);
    return text({ products: pool, total: pool.length });
  }
);

// ── Boot ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
