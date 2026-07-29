#!/usr/bin/env node
/**
 * Refresh data/soh_data.js from Maximo (MAXDB76).
 * Requires .env with DB_SERVER, DB_DATABASE, DB_USER, DB_PASSWORD, DB_PORT.
 * Must run inside the corporate network (DB is not reachable externally).
 */
'use strict';
require('dotenv').config();
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const REQUIRED = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error('Missing env vars: ' + missing.join(', ') + ' (create .env — see README)');
  process.exit(1);
}

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 1433),
  connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT || 60000),
  requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT || 300000),
  options: {
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    encrypt: true
  }
};

const QUERY = `
SELECT w.wonum, w.siteid AS site, w.assetnum, w.gb_assetregistrationno AS vehicle,
c.name AS owner, a.installdate AS regdate, a.gb_vehiclemodel AS model, w.worktype, w.description,
TRY_CAST(REPLACE(NULLIF(LTRIM(RTRIM(w.gb_mileagereading)),''),',','') AS FLOAT) AS mileage,
w.reportdate AS date, w.status,
TRY_CAST(NULLIF(REPLACE(LTRIM(RTRIM(w.gb_soh)),'%',''),'') AS FLOAT) AS soh
FROM WORKORDER w
LEFT JOIN ASSET a ON a.assetnum = w.assetnum AND a.siteid = w.siteid
OUTER APPLY (SELECT MAX(pc.name) AS name FROM PLUSPCUSTOMER pc WHERE pc.customer = a.pluspcustomer) c
WHERE w.siteid IN ('HAPL','MV') AND w.gb_soh IS NOT NULL
AND LTRIM(RTRIM(w.gb_soh)) NOT IN ('','-','NA','N/A','0')
ORDER BY w.wonum
OFFSET @offset ROWS FETCH NEXT @batch ROWS ONLY`;

const BATCH = 500;

function cleanRow(r) {
  return {
    wonum: r.wonum,
    site: r.site,
    assetnum: r.assetnum,
    vehicle: r.vehicle,
    owner: r.owner,
    regdate: r.regdate ? new Date(r.regdate).toISOString() : null,
    model: r.model,
    worktype: r.worktype,
    description: r.description ? String(r.description).replace(/\s*[\r\n]+\s*/g, ' | ').trim() : null,
    mileage: typeof r.mileage === 'number' && isFinite(r.mileage) ? r.mileage : null,
    date: r.date ? new Date(r.date).toISOString() : null,
    status: r.status,
    soh: typeof r.soh === 'number' && isFinite(r.soh) ? r.soh : null
  };
}

(async () => {
  console.log('Connecting to ' + config.server + '/' + config.database + ' ...');
  const pool = await sql.connect(config);
  const rows = [];
  for (let offset = 0; ; offset += BATCH) {
    const res = await pool.request()
      .input('offset', sql.Int, offset)
      .input('batch', sql.Int, BATCH)
      .query(QUERY);
    rows.push(...res.recordset.map(cleanRow));
    process.stdout.write('\rFetched ' + rows.length + ' rows');
    if (res.recordset.length < BATCH) break;
  }
  await pool.close();
  console.log('');

  if (rows.length === 0) {
    console.error('Query returned 0 rows — refusing to overwrite existing data file.');
    process.exit(1);
  }

  const out = 'window.SOH_GENERATED = ' + JSON.stringify(new Date().toISOString()) + ';\n' +
              'window.SOH_DATA = ' + JSON.stringify(rows) + ';\n';
  const target = path.join(__dirname, 'data', 'soh_data.js');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, out);
  const vehicles = new Set(rows.map(r => r.site + '|' + (r.vehicle || r.assetnum))).size;
  console.log('Wrote ' + target + ' — ' + rows.length + ' rows, ' + vehicles + ' vehicles.');
})().catch(err => {
  console.error('Refresh failed: ' + err.message);
  process.exit(1);
});
