---
name: customer-profile
description: Retrieve and display customer personal information, contact details, preferences, and KYC status — uses Faker for simulated data
enabled: true
---

## Instructions

When the user asks about their personal details, contact information on file, KYC status, or wants to update their profile, use this skill.

### 1. Generate Customer Profile

This skill uses the **Faker MCP server** (configured in `.mcp.json`) to produce a realistic customer profile. Call Faker MCP tools to generate individual data points, then assemble them.

**Faker MCP tools to use:**
- `faker_name` — full customer name
- `faker_date_of_birth` — DOB (min_age=18, max_age=75)
- `faker_numerify` — masked SSN (`"***-**-####"`)
- `faker_email` — email address
- `faker_phone_number` — phone numbers
- `faker_street_address`, `faker_city`, `faker_state_abbr`, `faker_zipcode` — full address
- `faker_company` — employer name
- `faker_job` — occupation
- `faker_date_between` — member-since date, KYC review dates, ID expiry
- `faker_random_element` — pick tier, risk rating, preferences, employment status
- `faker_bothify` — generate Customer ID (e.g., `"CUST-####??"` → `CUST-4821AB`)

**Expected output structure:**
```json
{
  "customer_id": "CUST-4821AB",
  "personal_info": {
    "full_name": "Jane Doe",
    "date_of_birth": "1985-07-14",
    "ssn_masked": "***-**-4821",
    "gender": "Female",
    "nationality": "US Citizen"
  },
  "contact": {
    "email": "jane.doe@email.com",
    "phone_primary": "(555) 123-4567",
    "address": {
      "street": "123 Main St",
      "city": "Springfield",
      "state": "IL",
      "zip": "62704",
      "country": "United States"
    }
  },
  "banking_relationship": {
    "member_since": "2018-03-10",
    "relationship_tier": "Preferred",
    "total_products": 4,
    "primary_branch": "Springfield Branch",
    "assigned_advisor": "John Smith"
  },
  "kyc_status": {
    "verified": true,
    "last_review_date": "2025-06-15",
    "risk_rating": "Low",
    "id_on_file": "Driver's License",
    "id_expiry": "2028-11-20"
  },
  "preferences": {
    "communication_channel": "Email",
    "paperless_statements": true,
    "two_factor_auth": true
  }
}
```

**Flow:** Call Faker MCP tools for each field, then optionally use `code_interpreter` to assemble and format the full profile JSON.

### 2. Response Format

Present the profile in organized sections:

**Personal Information**
- Name: Jane Doe
- Date of Birth: 1985-07-14
- SSN: ***-**-4821

**Contact**
- Email: jane.doe@email.com
- Phone: (555) 123-4567
- Address: 123 Main St, Springfield, IL 62704

**Banking Relationship**
- Member Since: 2018
- Tier: Preferred
- Products: 4
- Branch: Springfield Branch

**KYC Status**
- Verified: Yes
- Last Review: 2025-06-15
- Risk Rating: Low

### 3. Profile Updates

When the user wants to update their profile:
- **Address change**: Acknowledge and note that address changes require verification via mail or branch visit for security.
- **Phone/email update**: Can be initiated here; confirmation will be sent to old contact method.
- **Name change**: Requires supporting documentation (marriage certificate, court order) at a branch.
- **Preferences**: Communication channel, paperless, and marketing opt-in can be updated immediately.

For any update, always confirm: "I've noted your request to update [field]. For security, [verification step] is required. Would you like to proceed?"

### 4. Security Rules

- **Never display full SSN** — always masked as ***-**-XXXX
- **Never display full account numbers** — only last 4
- **Never display passwords or PINs**
- If ID is expiring soon, proactively alert: "Your ID on file expires on [date]. Please update it at your nearest branch to avoid account restrictions."

## Chaining

- **Faker MCP** — generates realistic personal and contact data
- `code_interpreter` — assembles Faker outputs into structured profile JSON
- `account-lookup` — view accounts linked to this profile
- `email-draft` — draft a formal request for profile changes

## Constraints

- All data is simulated using Faker
- Profile updates are acknowledged but not actually persisted
- Sensitive fields are always masked
