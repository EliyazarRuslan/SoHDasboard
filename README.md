# HAPL & MV SoH Usage Report

Static dashboard showing EV battery State of Health recorded on Maximo work orders
(sites **HAPL** and **MV**), with degradation rates and warranty-end predictions.

**Live dashboard:** https://eliyazarruslan.github.io/SoHDasboard/

## Columns

Vehicle No · Owner · Registration Date · Service · Mileage · Date · Recorded SoH ·
SoH degradation per 10,000 km · SoH degradation per year ·
Predicted SoH @ 8 years (warranty end) · @ 160,000 km (warranty end) ·
@ 10 years (extended warranty end) · @ 200,000 km (extended warranty end)

Use **Export to Excel** to download the current filtered view.

## Methodology

- Assumes 100% SoH at vehicle registration (`ASSET.installdate`).
- Degradation per 10,000 km = (100 − SoH) ÷ (mileage ÷ 10,000).
- Degradation per year = (100 − SoH) ÷ years in service.
- Predictions are linear extrapolations from each reading, capped to 0–100%.
- Readings above 100% (fresh batteries) count as zero degradation.
- SoH values outside 20–120% are treated as data-entry errors and excluded.

## Refreshing the data

Data lives in `data/soh_data.js` and is regenerated from the Maximo database.
The DB is only reachable **inside the corporate network**.

One-time setup:

```bash
npm install
cp .env.example .env   # then fill in DB credentials
```

Refresh + publish:

```bash
./refresh.sh
```

This queries Maximo, rewrites `data/soh_data.js`, commits, and pushes.
GitHub Pages redeploys automatically (~1 minute).

## Files

| File | Purpose |
|------|---------|
| `index.html` | The dashboard (also `soh_dashboard.html`, identical copy) |
| `data/soh_data.js` | Extracted work-order data (`window.SOH_DATA`) |
| `refresh_data.js` | Pulls fresh data from Maximo (needs `.env`) |
| `refresh.sh` | Refresh + commit + push in one step |
