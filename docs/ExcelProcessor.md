# ExcelProcessor — Excel Beautification & Salary Engine

> Transforms raw MicoWorld streamer export files into premium-styled Excel reports with automated salary calculations, a union revenue dashboard, and dynamic row sorting.

---

## ✨ Features

| Feature | Description |
| :--- | :--- |
| 🌸 **Premium Pink Theme** | High-contrast headers, zebra striping, and soft borders |
| 💰 **20-Tier Salary Engine** | Automatic wage-to-THB conversion with tier-based union commission |
| 📊 **Revenue Dashboard** | Auto-generated summary block at the top of each report |
| 🔄 **Data Enrichment** | Fetch totalDay/totalMin from Mico H5 API per user |
| 📐 **Dynamic Formulas** | Live Excel formulas (SUM, SUMPRODUCT, IF, ROUND) |
| ↕️ **Smart Sorting** | Active VJs sorted by wage descending; inactive VJs highlighted in red |
| 🔒 **Frozen Panes** | Header row + dashboard frozen for easy scrolling |
| 🙈 **Auto-Hide Columns** | Internal columns (unionId, anchorId, etc.) hidden automatically |

---

## 📋 Usage

### Basic — Beautify Only

```typescript
import { ExcelProcessor } from './src/lib/ExcelProcessor.js';

const processor = new ExcelProcessor();

// Beautify and overwrite the existing file
await processor.beautify('exports/anchor_statistics[month].xlsx');

// Or save to a new path
await processor.beautify('input.xlsx', 'output_beautified.xlsx');
```

### Advanced — With Data Enrichment

```typescript
import { MicoClient, ExcelProcessor } from './src/index.js';

const client = new MicoClient();
await client.init();

const processor = new ExcelProcessor();
await processor.beautify(
    'exports/raw_export.xlsx',  // input
    'exports/final_report.xlsx', // output
    client,                      // MicoClient for enrichment
    2026,                        // year
    3                            // month
);
```

### Pipeline — Full Automation

```typescript
import { MicoReportManager } from './src/index.js';

const manager = new MicoReportManager();
await manager.init();

// Export → Download → Enrich → Beautify (all automated)
const finalPath = await manager.generateMonthlyReport('3/2026');
```

---

## 📊 Union Revenue Dashboard

A summary block is automatically inserted at rows 1–7 of each report:

| Row | Label | Formula |
| :---: | :--- | :--- |
| 1 | **สรุปรายได้สังกัด** | Title (merged cells) |
| 2 | หมวดหมู่ / ยอดรวม (THB) | Column headers |
| 3 | ยอดส่วนแบ่งพื้นฐาน | `SUM(ส่วนแบ่งสังกัดพื้นฐาน)` |
| 4 | ยอดโบนัส Recruit | `SUM(Recruit Bonus THB)` |
| 5 | ยอดโบนัสผลักดัน | `SUM(โบนัสวีเจใหม่ THB)` |
| 6 | **ยอดรวม Wage VJ Active** | `SUMPRODUCT((wage>=10000)*wage)` |
| 7 | **รวมรายได้สังกัดสุทธิ** | `SUM(รวมรายได้สังกัด THB)` |

> **Row 8** = empty spacer · **Row 9** = header row · **Row 10+** = data rows

### Active VJ Definition

An **Active VJ** is defined as a VJ with `wage ≥ 10,000`. Row 6 calculates the total combined wage of all active VJs using an Excel `SUMPRODUCT` formula.

---

## 💰 Salary Policy Table (20 Tiers)

The salary engine uses a static 20-tier commission policy defined in `ExcelProcessor.POLICY_TABLE`:

| Level | Wage Target | Min Days | Union Share % | Push Bonus (฿) | Recruit Bonus (฿) |
| :---: | ---: | :---: | :---: | ---: | ---: |
| 0 | 0 | 15 | 0% | 0 | 0 |
| 1 | 10,000 | 15 | 13.6% | 0 | 0 |
| 2 | 20,000 | 15 | 14.4% | 0 | 0 |
| 3 | 30,000 | 15 | 15.2% | 0 | 0 |
| 4 | 40,000 | 15 | 16.0% | 2,000 | 500 |
| 5 | 50,000 | 15 | 16.5% | 3,000 | 500 |
| 6 | 80,000 | 15 | 17.3% | 3,000 | 500 |
| 7 | 100,000 | 12 | 17.5% | 5,000 | 1,000 |
| 8 | 150,000 | 12 | 17.7% | 5,000 | 1,000 |
| 9 | 200,000 | 12 | 18.1% | 5,000 | 1,500 |
| 10 | 300,000 | 12 | 18.5% | 5,000 | 2,000 |
| 11 | 400,000 | 12 | 18.9% | 5,000 | 2,000 |
| 12 | 500,000 | 10 | 19.3% | 5,000 | 2,000 |
| 13 | 700,000 | 10 | 19.7% | 5,000 | 2,000 |
| 14 | 1,000,000 | 10 | 20.3% | 5,000 | 2,000 |
| 15 | 1,200,000 | 10 | 20.7% | 5,000 | 2,000 |
| 16 | 1,600,000 | 10 | 21.1% | 5,000 | 2,000 |
| 17 | 2,000,000 | 10 | 21.5% | 5,000 | 2,000 |
| 18 | 2,400,000 | 10 | 21.9% | 5,000 | 2,000 |
| 19 | 2,800,000 | 10 | 22.3% | 5,000 | 2,000 |
| 20 | 3,500,000 | 10 | 22.3% | 5,000 | 2,000 |

### Tier Lookup Logic

1. **Share Level** — Highest tier where `wage >= target`
2. **Performance Level** — Highest tier where `wage >= target` AND `totalDay >= days`
3. Push and Recruit bonuses are toggled via dropdown columns (`YES` / `NO`)

---

## 🔧 Calculated Columns

These columns are **inserted automatically** if missing from the raw export:

| Column | Formula | Format |
| :--- | :--- | :--- |
| โบนัสผลักดัน | Dropdown: `YES` / `NO` | — |
| Recruit Bonus | Dropdown: `YES` / `NO` | — |
| โบนัสวีเจใหม่ (THB) | `IF(Push="YES", tier.newVj, 0)` | `0.00` |
| Recruit Bonus (THB) | `IF(Recruit="YES", tier.recruit, 0)` | `0.00` |
| รายได้วีเจพื้นฐาน (THB) | `ROUND(wage / 10, 2)` | `0.00` |
| ส่วนแบ่งสังกัด % | Tier-based lookup | `0.0%` |
| ส่วนแบ่งสังกัดพื้นฐาน (THB) | `ROUND((wage × share%) / 10, 2)` | `0.00` |
| รวมรายได้สังกัด (THB) | `Base + Recruit + Push` | `0.00` |

---

## 🎨 Styling Rules

| Element | Style |
| :--- | :--- |
| **Dashboard Title** | Bold, 18pt, Pink (`#FF3385`) |
| **Dashboard Headers** | White text on Pink background, 12pt |
| **Data Header (Row 9)** | White text on Pink background, 12pt, word-wrap, 45px height |
| **Active Data Rows** | Alternating white / light pink (`#FFF0F5`) |
| **Inactive Data Rows** | Red background (`#FFCDD2`), bold dark red text |
| **Borders** | Thin light gray (`#EEEEEE`) throughout |
| **Number Format** | `#,##0.00` for currency columns |

### Sorting & Highlighting

- **Active VJs** (wage ≥ 10,000 AND totalDay ≥ 10) → sorted by wage descending
- **Inactive VJs** → moved to bottom, highlighted in red

---

## 🙈 Hidden Columns

The following internal columns are automatically hidden:

```
unionId, unionName, oneOnOneType, oneOnOneWage, dateStr,
audioMin, audioDay, inUnion, salaryModel, country, region,
anchorId, gender, vClass, liveWage, audioWage, liveMin, gameMin
```

---

## 📐 Data Enrichment

When a `MicoClient` is provided, the processor enriches each row with data from the Mico H5 API:

| Target Column | Source |
| :--- | :--- |
| totalDay | `h5Stats.all_volidDays` |
| totalMin | `h5Stats.all_minutes` (formatted as "H H M mins") |
| liveDay | `h5Stats.normal_volidDays` |
| liveMin | `h5Stats.normal_minutes` |
| gameDay | `h5Stats.game_volidDays` |
| gameMin | `h5Stats.game_minutes` |
| audioDay | `h5Stats.live_party_volidDays` |
| audioMin | `h5Stats.live_party_minutes` |

> Enrichment rate-limits requests with 1-second delays between API calls to prevent throttling.

---

## 🧪 Demo Scripts

```bash
# Beautify an existing export file
npx tsx demo/demo_excel.ts exports/anchor_statistics[month].xlsx

# Full enrichment simulation (requires .env credentials)
npx tsx demo/simulate_enrichment.ts

# Test the Active VJ Wage dashboard row with mock data
npx tsx demo/test_active_wage.ts
```

---

## 📊 Output Layout

```
┌──────────────────────────────────────────────┐
│ Row 1: สรุปรายได้สังกัด (Title)                │
│ Row 2: หมวดหมู่ | ยอดรวม (THB)                 │
│ Row 3: ยอดส่วนแบ่งพื้นฐาน | SUM(...)           │
│ Row 4: ยอดโบนัส Recruit | SUM(...)             │
│ Row 5: ยอดโบนัสผลักดัน | SUM(...)              │
│ Row 6: ยอดรวม Wage VJ Active | SUMPRODUCT(...) │
│ Row 7: รวมรายได้สังกัดสุทธิ | SUM(...)          │
│ Row 8: (empty spacer)                         │
├──────────────────────────────────────────────┤
│ Row 9: Headers (frozen, auto-filtered)        │
├──────────────────────────────────────────────┤
│ Row 10+: Active VJs (sorted by wage ↓)        │
│ ...                                           │
│ Row N+: Inactive VJs (highlighted red)        │
└──────────────────────────────────────────────┘
```
