---
name: crm
description: Search and retrieve wealth-management client profiles, financial data, and portfolio holdings from the CRM system
enabled: true
---

## Instructions

When the user asks about a client, customer, or account holder — including their profile, contact details, financial situation, investment preferences, or portfolio — use this skill to look them up in the CRM.

### 1. Identify the Lookup Method

Determine how to search based on what the user provides:

| User provides | Function to call | Example |
|---------------|-----------------|---------|
| A name or partial name | `load_from_crm_by_client_fullname` | "Look up Pete Mitchell", "find client Bradshaw" |
| A client ID | `load_from_crm_by_client_id` | "Get client 123456", "pull up account 234567" |
| Request for portfolio details | `get_client_portfolio` | "Show me Pete's holdings", "what's in client 123456's portfolio" |
| General overview | `list_all_clients` | "Show me all clients", "who are our clients" |

- **Name search** is case-insensitive and supports partial matching (first name, last name, or full name)
- **ID search** requires an exact match on the client ID
- If the user asks about holdings or positions, use `get_client_portfolio` to get the full positions list

### 2. Present Client Profile

When displaying client information, organize it clearly:

**Personal Details**
- Full name, date of birth, nationality
- Contact details (email, phone)
- Address

**Financial Overview**
- Source of wealth, net income, annual income
- Assets breakdown (real estate, investments, cash)

**Investment Profile**
- Risk profile (Aggressive / Moderate / Conservative)
- Investment objectives and horizon

**Compliance**
- PEP status
- Name screening result
- Documents provided

### 3. Present Portfolio Data

When the user asks about portfolio holdings, use `get_client_portfolio` and present positions in a table:

| Ticker | Company | Sector | Asset Class | Avg Cost | Units |
|--------|---------|--------|-------------|----------|-------|
| MSFT | Microsoft Corp | Technology | Equity | $350 | 200 |

Include the portfolio summary:
- **Strategy** description
- **Risk profile**
- **Performance YTD** and **since inception**
- **Inception date**
- **Number of positions** and total holdings

### 4. Multi-Step Workflows

For complex requests, combine CRM data with other skills:

- **Portfolio review**: Use `load_from_crm_by_client_fullname` → `get_client_portfolio` → hand off to `portfolio-review` or `code_interpreter` for analysis
- **Client report**: Use CRM data → `pdf-wealth-report` to generate a formatted PDF
- **Market context**: Use CRM to get the client's holdings → `web_search` for current prices and news on those tickers

### 5. When to Use

- Client lookup by name or ID
- Retrieving contact details, address, or financial information
- Checking a client's risk profile or investment objectives
- Reviewing portfolio holdings and performance
- KYC-related queries (PEP status, name screening, documents)
- Preparing data for portfolio reviews or client reports

### Response Guidelines

- Present client data clearly, using tables or structured formatting for financial details
- When displaying portfolio positions, include ticker, company name, sector, and allocation
- Respect data sensitivity — do not volunteer PII unless the user specifically asks for it
- If the search returns multiple clients, present a summary and ask which one the user means
- Always confirm the correct client before sharing detailed financial information
- Note that CRM data is sourced from the internal system and may not reflect real-time market values
