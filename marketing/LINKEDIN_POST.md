## Thread: Australia Deprecation Impact Scanner (ADIS)

**Target Audience:** C-level, Platform Owners, ServiceNow Enterprise Architects
**Tone:** Calm, authoritative, technically precise

---

### Post 1 / Hook

Your ServiceNow upgrade to Australia is scheduled for Q3.

You have 80,000 scripts. 20+ deprecated APIs. 3 weeks to audit.
And zero tools that scan script content for breaking changes.

This is not a skill issue. It is a tooling gap.

---

### Post 2 / Problem Evidence

Reddit r/servicenow, 2025–2026:

> "GlideEncrypter API is deprecated... can't understand how to replace the encryption."
> "Data Certification deprecated in Zurich... we will not be able to support it."
> "Agent Workspace is deprecated... Configurable Workspaces redirect you to script includes."

Official SN docs confirm:
- `GlideElementDynamicAttribute` → **removed** in Australia
- Data Generation profiles → **deleted** in Developer Sandboxes
- OAuth API endpoints → **deprecated** in favor of Machine Identity Console

There is no OOB tool that tells you which scripts reference these.

---

### Post 3 / The Gap

| What exists | What is missing |
|-------------|-----------------|
| Instance Scan (OOB) | Scans configuration, not script content |
| Release notes | Lists deprecations, not instance-specific impact |
| Manual code review | 500 scripts/hour; 160 hours for 80K scripts |
| IDE search | Needs export; cannot query production instance |

What is missing: **a scanner that lives inside ServiceNow and analyzes every script for deprecated API usage.**

---

### Post 4 / Solution

ADIS (Australia Deprecation Impact Scanner) is a scoped ServiceNow app that:

◆ Scans 13 script-bearing tables in under 5 minutes  
◆ Detects deprecated APIs via configurable regex rules  
◆ Scores every finding: Critical / High / Medium / Low  
◆ Calculates an instance-wide risk score (0–100)  
◆ Generates a remediation-ready task backlog  

Zero external data export. Zero outbound API calls. Zero vendor lock-in.

---

### Post 5 / ROI

Manual deprecation audit (80K scripts): **160 hours = $24,000**

ADIS-driven audit: **5 minutes scan + 8 hours review = $1,200**

**Savings per upgrade: $22,800**
**Annual (2 upgrades): $45,600 + 304 hours reclaimed**

Payback period: **one scan.**

---

### Post 6 / Architecture

Built for operators, not just developers:

- **Scan engine:** Chunked GlideRecord (500/batch), timeout-safe
- **Rule engine:** Customer-extensible regex rules stored as data
- **Report engine:** HTML dashboard / REST JSON / CSV / PDF
- **Security:** RBAC (`x_adis.admin`, `x_adis.scanner`, `x_adis.report_reader`)

AGPL-3.0 license. Commercial licensing available.

---

### Post 7 / Call to Action

If you are planning a Zurich → Australia upgrade, do not wait for the upgrade window to discover what breaks.

→ Repository: `github.com/vladarchitectservicenow-oss/ADIS`
→ Read the Whitepaper: `docs/WHITEPAPER.md`
→ Book a demo: open a Discussion on GitHub

Tag a platform owner who needs this.

---

*Hashtags:* #ServiceNow #AustraliaRelease #Deprecation #Upgrade #AIOps #GRC #PlatformEngineering #ServiceNowDev
