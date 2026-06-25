import * as App from "../app.js";

const PRIORITY_MULTIPLIER  = { 'Must-Have': 1.5, 'Should-Have': 1.25, 'Could-Have': 1 };
const SOLUTION_MULTIPLIERS = [1, 0.8, 0.6, 0.4, 0];
const BAR_CLASSES          = ['bar-green', 'bar-blue', 'bar-amber', 'bar-orange', 'bar-red'];
const PIE_COLORS           = ['#22c55e', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'];
const VENDOR_COLORS        = ['#378ADD', '#1D9E75', '#BA7517', '#993556', '#D85A30', '#534AB7', '#888780'];

// ─────────────────────────────────────────────────────────────────
$(async function () {
    if (!App.loggedIn()) {
        location.href = App.pages.login;
        return;
    }

    const requirement = App.getParam('req');
    let reqId = null;

    try {
        reqId = requirement ? decodeURIComponent(JSON.parse(atob(requirement))) : null;
    } catch (e) {
        App.customError('Invalid report link.');
        return;
    }

    if (!reqId) {
        location.href = App.pages.dashboard;
        return;
    }

    const [reqRes, ffRes] = await Promise.all([
        fetch(`/api/supabase?action=getRequirementsById&reqId=${reqId}`),
        fetch(`/api/supabase?action=getFormFields`)
    ]);

    const reqResult = await reqRes.json();
    const ffResult  = await ffRes.json();

    if (reqResult.error || ffResult.error) {
        App.customError(App.OPERATION_FAILED);
        return;
    }

    const data       = reqResult.data;
    const formFields = ffResult.data;

    renderReport(data, formFields);

    $('#backBtn').on('click', () => {
        location.href = `details.html?req=${requirement}`;
    });

    $('#exportBtn').removeClass('hide').on('click', async function () {
        const $btn = $(this);
        $btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Generating…');
        try {
            await exportToExcel(data, formFields);
        } catch (e) {
            console.error(e);
            App.customError('Failed to generate Excel. Please try again.');
        }
        $btn.prop('disabled', false).html('<i class="fa-solid fa-file-excel"></i> Export to Excel');
    });
});

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function getVendorFB(vendors, vendorId) {
    return vendors.find(v => v.id === vendorId)?.feedback ?? [];
}

function scoreClass(pct) {
    if (pct >= 70) return 'high';
    if (pct >= 40) return 'mid';
    return 'low';
}

function heatColor(pct) {
    if (pct >= 80) return { bg: '#f0fdf4', text: '#15803d' };
    if (pct >= 60) return { bg: '#fefce8', text: '#854d0e' };
    if (pct >= 40) return { bg: '#fff7ed', text: '#c2410c' };
    return { bg: '#fef2f2', text: '#b91c1c' };
}

function initials(name) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function tagClass(fb) {
    if (!fb) return 'tag-default';
    const f = fb.toLowerCase();
    if (f.includes('workaround') || f.includes('3rd-party')) return 'tag-workaround';
    if (f.includes('minor'))   return 'tag-minor';
    if (f.includes('partial')) return 'tag-partial';
    if (f.includes('fail'))    return 'tag-fail';
    return 'tag-default';
}

function shortFB(fb) {
    if (!fb) return '—';
    if (fb.includes('Fully meets'))  return 'Fully meets';
    if (fb.includes('minor gaps'))   return 'Minor gaps';
    if (fb.includes('workaround'))   return 'Workaround';
    if (fb.includes('Partially'))    return 'Partial';
    if (fb.includes('Fails'))        return 'Fails';
    return fb.slice(0, 30) + '…';
}

function isCoreFullyMet(fbValue, fbLabels) {
    if (!fbValue) return false;
    return fbValue === fbLabels[0] && !/workaround|3rd.party/i.test(fbValue);
}

function isMetWithGaps(fbValue) {
    if (!fbValue) return false;
    return /minor|workaround|3rd.party|partial/i.test(fbValue);
}

function buildScoreMap(vendors, reqs, allAreas, fbLabels) {
    const map = {};
    vendors.forEach(v => {
        map[v.name] = {};
        const rawFB       = getVendorFB(vendors, v.id);
        const multipliers = rawFB.map(entry => {
            const idx = fbLabels.indexOf(entry?.feedback ?? '');
            return idx >= 0 ? SOLUTION_MULTIPLIERS[idx] : 0;
        });
        allAreas.forEach(part => {
            let score = 0;
            reqs.forEach((req, i) => {
                if (part === 'All areas' || req.system_part === part)
                    score += (PRIORITY_MULTIPLIER[req.priority] ?? 1) * (multipliers[i] ?? 0);
            });
            const pct = reqs.length > 0 ? parseInt((score / (reqs.length * 1.5)) * 100) : 0;
            map[v.name][part] = Math.min(pct, 100);
        });
    });
    return map;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 0 — CHARTS
// ─────────────────────────────────────────────────────────────────
function renderCharts(vendors, reqs, fbLabels, sysParts, scoreMap) {
    const allAreas = ['All areas', ...sysParts];

    vendors.forEach((v, vi) => {
        const fb    = getVendorFB(vendors, v.id);
        const dist  = fbLabels.map(label =>
            reqs.filter((_, i) => (fb[i]?.feedback ?? '') === label).length
        );
        const total = dist.reduce((a, b) => a + b, 0);
        const pct   = scoreMap[v.name]['All areas'];
        const c     = heatColor(pct);

        const legendHTML = fbLabels.map((lbl, i) => {
            if (!dist[i]) return '';
            const p = total > 0 ? Math.round((dist[i] / total) * 100) : 0;
            return `<div class="pie-legend-item">
                <div class="pie-legend-sq" style="background:${PIE_COLORS[i]}"></div>
                <span>${shortFB(lbl)} — ${dist[i]} (${p}%)</span>
            </div>`;
        }).join('');

        $('#chartPieRow').append(`
            <div class="pie-card">
                <div class="pie-card-vendor">${v.name}</div>
                <div class="pie-card-score" style="color:${c.text}">${pct}%</div>
                <div class="pie-canvas-wrap">
                    <canvas id="pieChart${vi}" role="img"
                        aria-label="Response distribution for ${v.name}. Overall match score ${pct}%.">
                    </canvas>
                </div>
                <div class="pie-legend">${legendHTML}</div>
            </div>
        `);

        new Chart(document.getElementById(`pieChart${vi}`), {
            type: 'doughnut',
            data: {
                labels: fbLabels,
                datasets: [{ data: dist, backgroundColor: PIE_COLORS, borderWidth: 1.5, borderColor: '#ffffff', hoverOffset: 3 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '62%',
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => ` ${shortFB(ctx.label)}: ${ctx.raw}` } }
                }
            }
        });
    });

    // Legend
    $('#heatmapLegend').html(vendors.map((v, i) => `
        <span style="display:flex;align-items:center;gap:5px;">
            <span style="width:10px;height:10px;border-radius:2px;background:${VENDOR_COLORS[i % VENDOR_COLORS.length]}"></span>
            <span style="font-size:12px;color:#8a8880;">${v.name}</span>
        </span>
    `).join(''));

    // Bar chart
    const barHeight = Math.max(200, allAreas.length * vendors.length * 18 + 80);
    $('#heatmapBarWrap').css('height', barHeight + 'px');

    new Chart(document.getElementById('heatmapBarChart'), {
        type: 'bar',
        data: {
            labels: allAreas,
            datasets: vendors.map((v, i) => ({
                label: v.name,
                data: allAreas.map(area => scoreMap[v.name][area]),
                backgroundColor: VENDOR_COLORS[i % VENDOR_COLORS.length] + 'cc',
                borderColor:     VENDOR_COLORS[i % VENDOR_COLORS.length],
                borderWidth: 1, borderRadius: 3,
            }))
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}%` } } },
            scales: {
                x: { min: 0, max: 100, ticks: { callback: v => v + '%', font: { size: 11 }, color: '#8a8880', stepSize: 20 }, grid: { color: 'rgba(0,0,0,0.06)' }, border: { display: false } },
                y: { ticks: { font: { size: 12 }, color: '#111827' }, grid: { display: false }, border: { display: false } }
            }
        }
    });

    // Heatmap table
    const vendorThs = vendors.map(v => `<th>${v.name}</th>`).join('');
    $('#heatmapHead').html(`<tr><th>Area</th>${vendorThs}</tr>`);
    allAreas.forEach(area => {
        const cells = vendors.map(v => {
            const pct = scoreMap[v.name][area];
            const c   = heatColor(pct);
            return `<td><span class="heatmap-cell" style="background:${c.bg};color:${c.text}">${pct}%</span></td>`;
        }).join('');
        $('#heatmapBody').append(`<tr><td>${area}</td>${cells}</tr>`);
    });
}

// ─────────────────────────────────────────────────────────────────
// RENDER REPORT
// ─────────────────────────────────────────────────────────────────
function renderReport(data, formFields) {
    const vendors  = data.assigned_vendors ?? [];
    const reqs     = data.requirements ?? [];
    const fbLabels = formFields.vendor_feedback ?? [];
    const sysParts = formFields.system_parts ?? [];
    const allAreas = ['All areas', ...sysParts];
    const mustReqs = reqs.filter(r => r.priority === 'Must-Have');

    // ── Page header ──
    $('#rTitle').text(data.title);
    $('#rCompany').text(data.client?.company ?? '');
    $('#rClient').text(data.client?.name ?? '—');
    $('#rCountry').text(data.client?.country ?? '—');
    $('#rTimeline').text(data.client?.timeline ?? '—');
    $('#rHeadcount').text(data.client?.headcount ?? '—');
    $('#rVendorCount').text(vendors.length);
    $('#rReqCount').text(reqs.length);

    // ── Sidebar ──
    $('#sidebarTitle').text(data.title);
    $('#sidebarCompany').text(data.client?.company ?? '');
    $('#sidebarVendors').text(vendors.length);
    $('#sidebarReqs').text(reqs.length);
    $('#topbarMeta').text(
        `${data.client?.company ?? ''} · ${vendors.length} vendor${vendors.length !== 1 ? 's' : ''}`
    );

    // Sidebar gap badge — total must-have gaps across all vendors
    let totalGaps = 0;
    vendors.forEach(v => {
        const fb = getVendorFB(vendors, v.id);
        totalGaps += mustReqs.filter(req =>
            (fb[reqs.indexOf(req)]?.feedback ?? '') !== fbLabels[0]
        ).length;
    });
    $('#navGapCount').text(totalGaps);

    const scoreMap = buildScoreMap(vendors, reqs, allAreas, fbLabels);

    // ── Section 0 ── charts
    renderCharts(vendors, reqs, fbLabels, sysParts, scoreMap);

    // ── Section 1 ── Match Scores
    vendors.forEach(v => {
        const pct = scoreMap[v.name]['All areas'];
        $('#scoreCards').append(`
            <div class="score-card">
                <div class="score-card-vendor">${v.name}</div>
                <div class="score-value ${scoreClass(pct)}">${pct}%</div>
                <div class="score-label">overall match</div>
            </div>
        `);
    });

    const vendorThs = vendors.map(v => `<th>${v.name}</th>`).join('');
    $('#scoreTableHead').html(`<tr><th>Area</th>${vendorThs}</tr>`);
    allAreas.forEach(area => {
        const cells = vendors.map(v => {
            const pct = scoreMap[v.name][area];
            return `<td><span class="pill ${scoreClass(pct)}">${pct}%</span></td>`;
        }).join('');
        $('#scoreTableBody').append(`<tr><td>${area}</td>${cells}</tr>`);
    });

    // ── Section 2 ── Core Platform
    vendors.forEach(v => {
        const fb       = getVendorFB(vendors, v.id);
        const coreMet  = mustReqs.filter(req => isCoreFullyMet(fb[reqs.indexOf(req)]?.feedback ?? '', fbLabels)).length;
        const withGaps = mustReqs.filter(req => isMetWithGaps(fb[reqs.indexOf(req)]?.feedback ?? '')).length;
        const notMet   = mustReqs.length - coreMet - withGaps;
        const corePct  = mustReqs.length > 0 ? Math.round((coreMet  / mustReqs.length) * 100) : 0;
        const gapsPct  = mustReqs.length > 0 ? Math.round((withGaps / mustReqs.length) * 100) : 0;
        const notPct   = mustReqs.length > 0 ? Math.round((notMet   / mustReqs.length) * 100) : 0;

        $('#coreCards').append(`
            <div class="core-tile">
                <div class="core-tile-vendor">${v.name}</div>
                <div class="core-stat-row">
                    <div class="core-stat">
                        <div class="core-stat-label"><span class="core-dot core-dot-green"></span>Core platform</div>
                        <div class="core-stat-right">
                            <div class="core-stat-value core-green">${coreMet}<span class="core-denom"> / ${mustReqs.length}</span></div>
                            <div class="core-stat-pct">${corePct}%</div>
                        </div>
                    </div>
                    <div class="core-stat">
                        <div class="core-stat-label"><span class="core-dot core-dot-amber"></span>Met w/ gaps</div>
                        <div class="core-stat-right">
                            <div class="core-stat-value core-amber">${withGaps}<span class="core-denom"> / ${mustReqs.length}</span></div>
                            <div class="core-stat-pct">${gapsPct}%</div>
                        </div>
                    </div>
                    <div class="core-stat">
                        <div class="core-stat-label"><span class="core-dot core-dot-red"></span>Not met</div>
                        <div class="core-stat-right">
                            <div class="core-stat-value core-red">${notMet}<span class="core-denom"> / ${mustReqs.length}</span></div>
                            <div class="core-stat-pct">${notPct}%</div>
                        </div>
                    </div>
                </div>
                <div class="core-bar-track" title="${corePct}% core · ${gapsPct}% gaps · ${notPct}% not met">
                    <div class="core-bar-seg core-seg-green" style="width:${corePct}%"></div>
                    <div class="core-bar-seg core-seg-amber" style="width:${gapsPct}%"></div>
                    <div class="core-bar-seg core-seg-red"   style="width:${notPct}%"></div>
                </div>
            </div>
        `);
    });

    // ── Section 3 ── Must-Have Summary
    vendors.forEach(v => {
        const fb       = getVendorFB(vendors, v.id);
        const fullyMet = mustReqs.filter(req =>
            (fb[reqs.indexOf(req)]?.feedback ?? '') === fbLabels[0]
        ).length;
        const pct = mustReqs.length > 0 ? Math.round((fullyMet / mustReqs.length) * 100) : 0;
        $('#mustCards').append(`
            <div class="must-tile">
                <div class="must-tile-vendor">${v.name}</div>
                <div class="must-tile-fraction">${fullyMet}<span> / ${mustReqs.length}</span></div>
                <div class="must-tile-pct">${pct}% fully met</div>
            </div>
        `);
    });

    // ── Section 4 ── Must-Have Gaps
    const $gapList = $('#gapList');
    vendors.forEach(v => {
        const fb   = getVendorFB(vendors, v.id);
        const gaps = mustReqs
            .map(req => ({ req, fb: fb[reqs.indexOf(req)]?.feedback ?? '' }))
            .filter(g => g.fb !== fbLabels[0]);

        $gapList.append(`
            <div class="vd">
                <div class="vd-avatar">${initials(v.name)}</div>
                <div class="vd-name">${v.name}</div>
                <div class="vd-line"></div>
                <div class="vd-count">${gaps.length} gap${gaps.length !== 1 ? 's' : ''}</div>
            </div>
        `);

        if (gaps.length === 0) {
            $gapList.append('<p class="empty-note" style="padding-left:36px;">All must-have requirements fully met.</p>');
        } else {
            gaps.forEach((g, i) => {
                $gapList.append(`
                    <div class="gap-item">
                        <div class="gap-num">${String(i + 1).padStart(2, '0')}</div>
                        <div class="gap-body">
                            <div class="gap-req">${g.req.requirement}</div>
                            <div class="gap-meta">${g.req.area} · ${g.req.system_part} · ${g.req.priority}</div>
                            <div class="gap-tags">
                                <span class="tag ${tagClass(g.fb)}">${shortFB(g.fb)}</span>
                            </div>
                        </div>
                    </div>
                `);
            });
        }
    });

    // ── Section 5 ── Breakdown by Area & Priority
    const $bd    = $('#breakdownWrap');
    const dotMap = ['dot-green','dot-blue','dot-amber','dot-orange','dot-red'];

    vendors.forEach(v => {
        const fb = getVendorFB(vendors, v.id);
        $bd.append(`<div class="vendor-heading">${v.name}</div>`);

        const areaMap = {};
        reqs.forEach((req, i) => {
            if (!areaMap[req.area]) areaMap[req.area] = [];
            areaMap[req.area].push({ req, fbVal: fb[i]?.feedback ?? '' });
        });

        Object.entries(areaMap).forEach(([area, items]) => {
            $bd.append(`<div class="area-heading">${area}</div>`);
            const total = items.length;

            // Bars with inline count + %
            fbLabels.forEach((label, li) => {
                const count = items.filter(x => x.fbVal === label).length;
                if (count === 0) return;
                const pct    = total > 0 ? Math.round((count / total) * 100) : 0;
                const barCls = BAR_CLASSES[li] ?? 'bar-green';
                $bd.append(`
                    <div class="bar-row">
                        <div class="bar-label">${shortFB(label)}</div>
                        <div class="bar-track"><div class="bar-fill ${barCls}" style="width:${pct}%"></div></div>
                        <div class="bar-counts">
                            <div class="bar-count bd-count">${count}</div>
                            <div class="bar-count bd-pct">${pct}%</div>
                        </div>
                    </div>
                `);
            });

            // Summary table
            const rows = fbLabels.map((label, li) => {
                const count = items.filter(x => x.fbVal === label).length;
                const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                return `
                    <tr class="bdt-row">
                        <td class="bdt-status">
                            <span class="bdt-dot ${dotMap[li] ?? 'dot-green'}"></span>${shortFB(label)}
                        </td>
                        <td class="bdt-n">${count}</td>
                        <td class="bdt-pct">${pct}%</td>
                        <td class="bdt-bar">
                            <div class="bdt-track">
                                <div class="bdt-fill ${BAR_CLASSES[li] ?? 'bar-green'}" style="width:${pct}%"></div>
                            </div>
                        </td>
                    </tr>`;
            }).join('');

            $bd.append(`
                <div class="bdt-wrap">
                    <table class="bdt-table">
                        <thead>
                            <tr>
                                <th class="bdt-th-status">Status</th>
                                <th class="bdt-th-n">Count</th>
                                <th class="bdt-th-pct">%</th>
                                <th class="bdt-th-bar">Distribution</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                            <tr class="bdt-total">
                                <td>Total</td><td>${total}</td><td>100%</td><td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `);
        });
    });

    // ── Reveal sidebar + content ──
    $('#sidebar').removeClass('hide');
    $('#loadingState').addClass('hide');
    $('#reportContent').removeClass('hide');
}

// ─────────────────────────────────────────────────────────────────
// EXPORT TO EXCEL
// ─────────────────────────────────────────────────────────────────
async function exportToExcel(data, formFields) {
    const filename = `${data.title}_${data.client?.company ?? 'report'}_vendor_scores.xlsx`
        .replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    const res = await fetch('/api/generateReport', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data, formFields, filename })
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const result = await res.json();
    if (result.error) throw new Error(result.error);

    const bytes  = atob(result.data);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);

    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = result.filename ?? filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}