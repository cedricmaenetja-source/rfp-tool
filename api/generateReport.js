// /api/generateReport.js
// Vercel serverless function — Node.js only, no Python needed.
// Install: npm install exceljs

import ExcelJS from 'exceljs';

// ── COLOURS ──────────────────────────────────────────────────────
const C = {
    orangeHdr:  'FFE46C0A',
    orangeFill: 'FFFDE9D9',
    greenHdr:   'FFEBF1DE',
    greenFont:  'FF375623',
    yellowFill: 'FFFFF2CC',
    greyFill:   'FFD9D9D9',
    altGrey:    'FFF2F2F2',
    white:      'FFFFFFFF',
    black:      'FF000000',
};

const PRIORITY_MULTIPLIER  = { 'Must-Have': 1.5, 'Should-Have': 1.25, 'Could-Have': 1.0 };
const PRIORITY_ORDER       = ['Must-Have', 'Should-Have', 'Could-Have'];
const SOLUTION_MULTIPLIERS = [1, 0.8, 0.6, 0.4, 0];

// ── STYLE HELPERS ─────────────────────────────────────────────────
function solidFill(argb) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function thinBorder() {
    const s = { style: 'thin', color: { argb: C.black } };
    return { top: s, left: s, bottom: s, right: s };
}

function applyCell(cell, {
    value     = null,
    bold      = false,
    italic    = false,
    fontColor = C.black,
    fontSize  = 10,
    fillColor = null,
    hAlign    = 'left',
    border    = true,
    wrap      = false,
} = {}) {
    if (value !== null && value !== undefined) cell.value = value;
    cell.font      = { name: 'Arial', bold, italic, size: fontSize, color: { argb: fontColor } };
    cell.alignment = { horizontal: hAlign, vertical: 'middle', wrapText: wrap };
    if (fillColor) cell.fill = solidFill(fillColor);
    if (border)    cell.border = thinBorder();
}

// ── FEEDBACK HELPERS ──────────────────────────────────────────────
function getVendorFB(vendors, vendorId) {
    return vendors.find(v => v.id === vendorId)?.feedback ?? [];
}

function solutionMult(fbValue, fbLabels) {
    const idx = fbLabels.indexOf(fbValue ?? '');
    if (idx < 0) return 0;
    return SOLUTION_MULTIPLIERS[idx] ?? 0;
}

// Matches getSolutionMultipliers in app.js exactly
function buildMultiplierArray(feedback, fbLabels) {
    return feedback.map(entry => {
        const idx = fbLabels.indexOf(entry?.feedback ?? '');
        return idx >= 0 ? SOLUTION_MULTIPLIERS[idx] : 0;
    });
}

// Matches dashboard.js: score / (allReqs.length * 1.5) * 100
function calcMatchScore(reqs, allReqs, multipliers, fbLabels) {
    let score = 0;
    reqs.forEach(req => {
        const gIdx = allReqs.indexOf(req);
        score += (PRIORITY_MULTIPLIER[req.priority] ?? 1) * (multipliers[gIdx] ?? 0);
    });
    const pct = allReqs.length > 0
        ? parseInt((score / (allReqs.length * 1.5)) * 100)
        : 0;
    return Math.min(pct, 100);
}

// ── SHEET BUILDER ─────────────────────────────────────────────────
function buildSheet(wb, sheetName, systemPart, vendors, allReqs, fbLabels) {
    const ws = wb.addWorksheet(sheetName.slice(0, 31));

    const reqs = systemPart === 'All areas'
        ? allReqs
        : allReqs.filter(r => r.system_part === systemPart);

    const vendorMaps = vendors.map(v => {
        const rawFB      = getVendorFB(vendors, v.id);
        const multipliers = buildMultiplierArray(rawFB, fbLabels);
        return { vendor: v, feedback: rawFB, multipliers };
    });

    // ── COLUMN WIDTHS ────────────────────────────────────────────
    ws.getColumn(1).width = 18;
    ws.getColumn(2).width = 13;
    ws.getColumn(3).width = 56;
    ws.getColumn(4).width = 10;
    vendors.forEach((_, i) => {
        ws.getColumn(5 + i * 2).width = 28;
        ws.getColumn(6 + i * 2).width = 22;
    });

    let r = 1;

    // ── MAX SCORES BLOCK ─────────────────────────────────────────
    ws.mergeCells(r, 1, r, 3);
    applyCell(ws.getCell(r, 1), { value: 'Max scores', bold: true, fontSize: 11, fillColor: C.orangeHdr, fontColor: C.white });
    [2, 3].forEach(c => {
        ws.getCell(r, c).fill   = solidFill(C.orangeHdr);
        ws.getCell(r, c).border = thinBorder();
    });
    r++;

    const maxByPriority = {};
    PRIORITY_ORDER.forEach(p => {
        const count = reqs.filter(req => req.priority === p).length;
        maxByPriority[p] = count * PRIORITY_MULTIPLIER[p];
        applyCell(ws.getCell(r, 1), { value: '',             fillColor: C.orangeFill });
        applyCell(ws.getCell(r, 2), { value: p,              fillColor: C.orangeFill, bold: true });
        applyCell(ws.getCell(r, 3), { value: maxByPriority[p], fillColor: C.orangeFill, hAlign: 'center' });
        r++;
    });

    const maxTotal = Object.values(maxByPriority).reduce((a, b) => a + b, 0);
    applyCell(ws.getCell(r, 1), { value: '',       fillColor: C.orangeFill });
    applyCell(ws.getCell(r, 2), { value: 'Total',  fillColor: C.orangeFill, bold: true });
    applyCell(ws.getCell(r, 3), { value: maxTotal, fillColor: C.orangeFill, bold: true, hAlign: 'center' });
    r++;
    r++; // spacer

    // ── PRIORITY SECTIONS ────────────────────────────────────────
    PRIORITY_ORDER.forEach(priority => {
        const priorityReqs = reqs.filter(req => req.priority === priority);
        if (!priorityReqs.length) return;

        const mult = PRIORITY_MULTIPLIER[priority];

        // Header row
        applyCell(ws.getCell(r, 1), { value: systemPart,          fillColor: C.greenHdr, fontColor: C.greenFont, bold: true });
        applyCell(ws.getCell(r, 2), { value: 'Multiplier',        fillColor: C.greenHdr, fontColor: C.greenFont, bold: true, hAlign: 'center' });
        applyCell(ws.getCell(r, 3), { value: priority,            fillColor: C.greenHdr, fontColor: C.greenFont, bold: true });
        applyCell(ws.getCell(r, 4), { value: priorityReqs.length, fillColor: C.greenHdr, fontColor: C.greenFont, bold: true, hAlign: 'center' });

        vendorMaps.forEach(({ vendor }, i) => {
            const bdCol = 5 + i * 2;
            const wsCol = 6 + i * 2;
            applyCell(ws.getCell(r, bdCol), { value: `${vendor.name} Requirements Breakdown`, fillColor: C.greenHdr, fontColor: C.greenFont, bold: true, hAlign: 'center', wrap: true });
            applyCell(ws.getCell(r, wsCol), { value: `${vendor.name} Weighted Scoring`,       fillColor: C.greenHdr, fontColor: C.greenFont, bold: true, hAlign: 'center', wrap: true });
        });
        ws.getRow(r).height = 32;
        r++;

        // Feedback rows — column B shows SOLUTION multiplier for that row
        fbLabels.forEach((label, li) => {
            const rowFill   = li % 2 === 1 ? C.altGrey : C.white;
            const solMult   = SOLUTION_MULTIPLIERS[li] ?? 0; // ← solution multiplier for this feedback option

            applyCell(ws.getCell(r, 1), { value: '',      fillColor: rowFill });
            applyCell(ws.getCell(r, 2), { value: solMult, fillColor: rowFill, hAlign: 'center' }); // ← fix: was mult
            applyCell(ws.getCell(r, 3), { value: label,   fillColor: rowFill, wrap: true });
            applyCell(ws.getCell(r, 4), { value: '',      fillColor: rowFill });

            vendorMaps.forEach(({ feedback }, i) => {
                const bdCol = 5 + i * 2;
                const wsCol = 6 + i * 2;
                let count = 0, weighted = 0;

                priorityReqs.forEach(req => {
                    const gIdx = allReqs.indexOf(req);
                    const fb   = feedback[gIdx]?.feedback ?? '';
                    if (fb === label) {
                        count++;
                        weighted += mult * solutionMult(fb, fbLabels);
                    }
                });

                applyCell(ws.getCell(r, bdCol), { value: count > 0 ? count : null,                          fillColor: rowFill, hAlign: 'center' });
                applyCell(ws.getCell(r, wsCol), { value: weighted > 0 ? parseFloat(weighted.toFixed(2)) : null, fillColor: rowFill, hAlign: 'center' });
            });
            r++;
        });

        // SUM row
        applyCell(ws.getCell(r, 1), { value: '',    fillColor: C.greyFill });
        applyCell(ws.getCell(r, 2), { value: '',    fillColor: C.greyFill });
        applyCell(ws.getCell(r, 3), { value: 'SUM', fillColor: C.greyFill, bold: true });
        applyCell(ws.getCell(r, 4), { value: '',    fillColor: C.greyFill });

        vendorMaps.forEach(({ feedback }, i) => {
            const bdCol = 5 + i * 2;
            const wsCol = 6 + i * 2;
            let tc = 0, tw = 0;
            priorityReqs.forEach(req => {
                const gIdx = allReqs.indexOf(req);
                const fb   = feedback[gIdx]?.feedback ?? '';
                if (fb) { tc++; tw += mult * solutionMult(fb, fbLabels); }
            });
            applyCell(ws.getCell(r, bdCol), { value: tc > 0 ? tc : null,                        fillColor: C.greyFill, bold: true, hAlign: 'center' });
            applyCell(ws.getCell(r, wsCol), { value: tw > 0 ? parseFloat(tw.toFixed(2)) : null, fillColor: C.greyFill, bold: true, hAlign: 'center' });
        });
        r++;

        // % Fully met row
        applyCell(ws.getCell(r, 1), { value: '',            fillColor: C.white });
        applyCell(ws.getCell(r, 2), { value: '',            fillColor: C.white });
        applyCell(ws.getCell(r, 3), { value: '% Fully met', fillColor: C.white, bold: true, italic: true });
        applyCell(ws.getCell(r, 4), { value: '',            fillColor: C.white });

        vendorMaps.forEach(({ feedback }, i) => {
            const bdCol = 5 + i * 2;
            const wsCol = 6 + i * 2;
            const fm = priorityReqs.filter(req => {
                const gIdx = allReqs.indexOf(req);
                return (feedback[gIdx]?.feedback ?? '') === fbLabels[0];
            }).length;
            const pct = priorityReqs.length > 0
                ? `${Math.round((fm / priorityReqs.length) * 100)}%`
                : '—';
            applyCell(ws.getCell(r, bdCol), { value: '',  fillColor: C.white });
            applyCell(ws.getCell(r, wsCol), { value: pct, fillColor: C.white, bold: true, hAlign: 'center' });
        });
        r++;
        r++; // spacer
    });

    // ── TOTALS ────────────────────────────────────────────────────
    // SUM points row
    applyCell(ws.getCell(r, 1), { value: '',           fillColor: C.yellowFill });
    applyCell(ws.getCell(r, 2), { value: '',           fillColor: C.yellowFill });
    applyCell(ws.getCell(r, 3), { value: 'SUM points', fillColor: C.yellowFill, bold: true });
    applyCell(ws.getCell(r, 4), { value: '',           fillColor: C.yellowFill });

    vendorMaps.forEach(({ multipliers }, i) => {
        let total = 0;
        reqs.forEach(req => {
            const gIdx = allReqs.indexOf(req);
            total += (PRIORITY_MULTIPLIER[req.priority] ?? 1) * (multipliers[gIdx] ?? 0);
        });
        const bdCol = 5 + i * 2;
        const wsCol = 6 + i * 2;
        applyCell(ws.getCell(r, bdCol), { value: '',                           fillColor: C.yellowFill });
        applyCell(ws.getCell(r, wsCol), { value: parseFloat(total.toFixed(2)), fillColor: C.yellowFill, bold: true, hAlign: 'center' });
    });
    r++;

    // Match score % row — uses allReqs.length * 1.5 as denominator (matches dashboard.js)
    applyCell(ws.getCell(r, 1), { value: '',              fillColor: C.yellowFill });
    applyCell(ws.getCell(r, 2), { value: '',              fillColor: C.yellowFill });
    applyCell(ws.getCell(r, 3), { value: 'Match score %', fillColor: C.yellowFill, bold: true });
    applyCell(ws.getCell(r, 4), { value: '',              fillColor: C.yellowFill });

    vendorMaps.forEach(({ multipliers }, i) => {
        const pct    = calcMatchScore(reqs, allReqs, multipliers, fbLabels);
        const bdCol  = 5 + i * 2;
        const wsCol  = 6 + i * 2;
        applyCell(ws.getCell(r, bdCol), { value: '',          fillColor: C.yellowFill });
        applyCell(ws.getCell(r, wsCol), { value: `${pct}%`,   fillColor: C.yellowFill, bold: true, hAlign: 'center' });
    });
}

// ── VERCEL HANDLER ────────────────────────────────────────────────
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { data, formFields, filename } = req.body;

    if (!data || !formFields) {
        return res.status(400).json({ error: 'Missing data or formFields' });
    }

    const vendors  = data.assigned_vendors ?? [];
    const allReqs  = data.requirements ?? [];
    const fbLabels = formFields.vendor_feedback ?? [];
    const sysParts = formFields.system_parts ?? [];
    const allAreas = ['All areas', ...sysParts];

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Udder RFP Tool';
    wb.created = new Date();

    allAreas.forEach(part => {
        const safeName = part.replace(/[\/\\?*[\]:]/g, '-').slice(0, 31);
        buildSheet(wb, safeName, part, vendors, allReqs, fbLabels);
    });

    const buffer = await wb.xlsx.writeBuffer();
    const b64    = Buffer.from(buffer).toString('base64');
    const safeFilename = (filename ?? 'vendor_report.xlsx').replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    return res.status(200).json({ status: 'ok', filename: safeFilename, data: b64 });
}