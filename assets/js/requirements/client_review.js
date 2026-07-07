import * as App from "../app.js";
import { PAGES } from "../utils/constants.js";

let requirements = [];
let draftData = {};
let isSaving = false;
let areas = [];
window.areas = [];
window.system_parts = [];
window.draft_req_id = '';

const warningColor = '#D32F2F33';

const PRIORITY_MULTIPLIER  = { 'Must-Have': 1.5, 'Should-Have': 1.25, 'Could-Have': 1 };
const SOLUTION_MULTIPLIERS = [1, 0.8, 0.6, 0.4, 0];
const BAR_CLASSES          = ['bar-green', 'bar-blue', 'bar-amber', 'bar-orange', 'bar-red'];
const PIE_COLORS           = ['#22c55e', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'];
const VENDOR_COLORS        = ['#378ADD', '#1D9E75', '#BA7517', '#993556', '#D85A30', '#534AB7', '#888780'];

$(function(){
    $('#loader').removeClass('hide');
    $('.input-row input, select, #title').prop('disabled', true);
    $('#categoryFilter').prop('disabled', false);
    $('#recommendationOptions').prop('disabled', false);

    const id = App.getParam('id');
    const reqId = id ? id : null;

    if (reqId === null){
        location.href = 'https://udder.rocks'
    }

    loadRequirementData(reqId);
    loadReport(reqId);

    setInterval(() => loadReport(reqId), 300000);
    
    async function loadFormFields(){
        const response = await fetch(`/api/supabase?action=getFormFields`);
        const result = await response.json();
        if (result.error) {
            console.error('Fetch failed:', result.error);
            App.customError(App.OPERATION_FAILED);
            return;
        }

        //$('#areaInput').empty();
        window.areas = result.data.area;
        if (window.areas && window.areas.length > 0) window.areas.sort((a, b) => a.localeCompare(b));

        window.system_parts = result.data.system_parts;

        // for (var part of data.system_parts){
        //     $('#systemPartInput').append(`<option>${part}</option>`);
        // }
    }

    loadFormFields();

    function renderTable() {
        const $tbody = $('#requirementsTable tbody');
        $tbody.empty();
        
        $.each(requirements, function (index, req) {
            $tbody.append(`
            <tr style="font-size:14px;">
                <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${req.area}</td>
                <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${req.requirement} (${req.system_part})</td>
                <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${req.priority}</td>
                <td style="padding:8px; border-bottom:1px solid #e5e7eb;">
                <button class="remove" data-index="${index}">✕</button>
                </td>
            </tr>
            `);
        });
    }

    $('#saveDraft').on('click', async function(){
        const subject = `Recommendations have been added - ${draftData.title} (${draftData.client.company}).`;

        App.swal.fire({
            title: "Success!",
            text: "Your draft has been saved!",
            icon: "success"
        });

        const token = App.getParam('tk');
        const res = await fetch('/api/send-email?action=onReviewChange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                token: token,
                link: `${PAGES.req_review}${id}`,
                subject: `[RFP Tool] ${draftData.client.name} Has Submitted Their Requirements Review`
            })
        });
        const result = await res.json();
        if (result.error){console.log(result.error)}
        App.setCookie('onChange', true);
    });

    $('#categoryFilter').on('change', function(){
        const selected = $(this).val().toLowerCase();
 
        $('#requirementsTable tbody tr').each(function(){
            const category = $(this).find('td:nth-child(2)').text().toLowerCase();
 
            if(selected === '' || category === selected){
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    });
    
    $('#recommendationOptions').on('change', async function(){
        const val = $(this).val();
        $('input[name="mark-req"]:checked').each(function () {
            const id = $(this).data('id');

            requirements[id]['recommendation'] = val;
        });

        reloadRequirements();

        draftData.requirements = requirements;

        const res = await fetch("/api/supabase?action=updateDraftRequirement", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: reqId, requirement: draftData})
        });
        
        const result = await res.json();
        if (result.error){
            console.error('Error:', result.error);
            App.swal.fire({
                title: "Error",
                text: App.REQUEST_NOT_PROCESSED,
            });
            return;
        }

        enableSignOffBtn();
    });

    $('.tab-btn').on('click', function () {
      const target = $(this).data('tab');

      $('.tab-btn').removeClass('active');
      $(this).addClass('active');

      $('.tab-panel').removeClass('active');
      $('#' + target).addClass('active');
    });

    $('#addRequirementBtn').on('click', async function () {
        const categoryOptions = window.areas.map(a => `<option value="${a}">${a}</option>`).join('');
        const systemPartsOptions = window.system_parts.map(a => `<option value="${a}">${a}</option>`).join('');

        const { value: formValues } = await App.swal.fire({
            title: 'Add New Requirement',
            html: `
                <div style="text-align:left; display:flex; flex-direction:column; gap:12px;">
                    <label style="font-size:12px; font-weight:500; color:#8a8880;">
                        Category
                        <select id="swal-category" class="swal2-select" style="margin:4px 0 0; width:100%; padding:8px; border-radius:6px; border:1px solid #e2e0db;">
                            <option value="">-select-</option>
                            ${categoryOptions}
                        </select>
                        <input id="swal-category-other" class="swal2-input hide" style="margin:6px 0 0; width:100%;" placeholder="New category name">
                    </label>
                    <label style="font-size:12px; font-weight:500; color:#8a8880;">
                        Description
                        <textarea id="swal-description" class="swal2-textarea" style="margin:4px 0 0; width:100%;" placeholder="Describe the requirement..."></textarea>
                    </label>
                    <label style="font-size:12px; font-weight:500; color:#8a8880;">
                        Priority Level
                        <select id="swal-priority" class="swal2-select" style="margin:4px 0 0; width:100%; padding:8px; border-radius:6px; border:1px solid #e2e0db;">
                            <option value="">-select-</option>
                            <option>Could-Have</option>
                            <option>Must-Have</option>
                            <option>Should-Have</option>
                        </select>
                    </label>
                    <label style="font-size:12px; font-weight:500; color:#8a8880;">
                        System Part
                        <select id="swal-system-part" class="swal2-select" style="margin:4px 0 0; width:100%; padding:8px; border-radius:6px; border:1px solid #e2e0db;">
                            <option value="">-select-</option>
                            ${systemPartsOptions}
                        </select>
                    </label>
                    <label style="font-size:12px; font-weight:500; color:#8a8880;">
                        Recommendation
                        <select id="swal-recommendation" class="swal2-select" style="margin:4px 0 0; width:100%; padding:8px; border-radius:6px; border:1px solid #e2e0db;">
                            <option value="">-select-</option>
                            <option>Remove</option>
                            <option>Amend</option>
                            <option>Keep</option>
                        </select>
                    </label>
                    <label style="font-size:12px; font-weight:500; color:#8a8880;">
                        Notes
                        <textarea id="swal-notes" class="swal2-textarea" style="margin:4px 0 0; width:100%;" placeholder="Additional notes or comment..."></textarea>
                    </label>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Add Requirement',
            didOpen: () => {
                $('#swal-category').on('change', function () {
                    $('#swal-category-other').toggleClass('hide', $(this).val() !== '__other__');
                });
            },
            preConfirm: () => {
                let area = $('#swal-category').val();
                if (area === '__other__') area = $('#swal-category-other').val().trim();

                const requirement = $('#swal-description').val().trim();
                const priority = $('#swal-priority').val();
                const recommendation = $('#swal-recommendation').val();
                const comment = $('#swal-notes').val().trim();
                const system_part = $('#swal-system-part').val().trim();

                if (!area || !requirement || !priority || !system_part) {
                    App.swal.showValidationMessage('Please fill in Category, Description, Priority, and System Part.');
                    return false;
                }

                return { area, requirement, priority, system_part, recommendation, comment };
            }
        });

        if (!formValues) return;
      
        requirements.push(formValues);
        draftData.requirements = requirements;

        // if (!areas.includes(formValues.area)) {
        //     areas.push(formValues.area);
        //     $('#categoryFilter').append(`<option value="${formValues.area}">${formValues.area}</option>`);
        // }

        reloadRequirements();
        enableSignOffBtn();
      
        const res = await fetch("/api/supabase?action=updateDraftRequirement", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: reqId, requirement: draftData })
        });

        const result = await res.json();
        if (result.error) {
            console.error('Error:', result.error);
            App.swal.fire({
                title: "Error",
                text: App.REQUEST_NOT_PROCESSED,
            });
            return;
        }

        const token = App.getParam('tk');
        const r = await fetch('/api/send-email?action=onAddNewReq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                token: token,
                clientName: draftData.client.name,
                link: `${PAGES.req_review}${reqId}`,
                subject: `[RFP Tool] ${draftData.client.name} Has Submitted a New Requirement`
            })
        });
        const rt = await r.json();
        if (rt.error){console.log(rt.error)}
    });

    $('#addRequirement').on('click', async function () {
        const area = $('#areaInput').val().trim();
        const requirement = $('#requirementInput').val().trim();
        const priority = $('#priorityInput').val();
        const system_part = $('#systemPartInput').val();

        if (!area || !requirement || !priority || !system_part) {
            alert('Please fill in Area, Requirement, Priority,and System part.');
            return;
        }

        requirements.push({ area, requirement, priority, system_part });

        $('#areaInput').val('');
        $('#requirementInput').val('');
        $('#priorityInput').val('');
        $('#systemPartInput').val('');
        
        if (reqId !== null){
            const res = await fetch("/api/supabase?action=updateRequirements", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: reqId, requirements: requirements})
            });

            const result = await res.json();
            if (result.error){
                console.error('Error:', result.error);
                App.swal.fire({
                    title: "Error",
                    text: App.REQUEST_NOT_PROCESSED,
                });
                return;
            }
        }

        renderTable();
    });

    $('#requirementsTable').on('click', '.remove', async function () {
        const index = $(this).data('index');
        requirements.splice(index, 1);

        const res = await fetch("/api/supabase?action=updateRequirements", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: reqId, requirements: requirements})
        });

        const result = await res.json();
        if (result.error){
            console.error('Error:', result.error);
            App.swal.fire({
                title: "Error",
                text: App.REQUEST_NOT_PROCESSED,
            });
            return;
        }

        renderTable();
    });

    $('#submitRequirements').on('click', async function () {
        const text = $(this).text().trim();

        const swalWithBootstrapButtons = App.swal.mixin({
            customClass: {
                confirmButton: "btn btn-success",
                cancelButton: "btn btn-danger"
            },
            buttonsStyling: false
        });
        swalWithBootstrapButtons.fire({
            title: "Are you sure?",
            text: "Only sign-off when no further changes are required. You won't be able to revert this!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, sign-off!",
            cancelButtonText: "No, cancel!",
            reverseButtons: true
        }).then(async (result) => {
            if (result.isConfirmed) {
                $(this).prop('disabled', true);
                $(this).html(`<i class="fa fa-spin fa-spinner"></i>Submitting...`);

                const res = await fetch("/api/supabase?action=approveDraftRequirements", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: reqId})
                });
                
                const result = await res.json();
                if (result.error){
                    console.error('Error:', result.error);
                    App.swal.fire({
                        title: "Error",
                        text: App.REQUEST_NOT_PROCESSED,
                    });
                    return;
                }

                const token = App.getParam('tk');
                const subject = `[RFP Tool] ${draftData.client.name} Has Sign-Off On Their Requirements`;
                const rc = await fetch('/api/send-email?action=onReviewChange', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        token: token,
                        link: `${PAGES.req_review}${id}`,
                        subject: subject
                    })
                });
                const rtc = await rc.json();
                if (result.error){console.log(rtc.error)};
            } 
        });

        //requirements.length = 0;
        renderTable();
    });

    $(document).on('change', '.recommendation', async function () {
        const pos = $(this).data('pos');
        const val = $(this).val();

        $('#keepAll').prop('checked', false);

        requirements[pos]['recommendation'] = val;
        draftData.requirements = requirements;

        enableSignOffBtn();

        const res = await fetch("/api/supabase?action=updateDraftRequirement", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: reqId, requirement: draftData})
        });
        
        const result = await res.json();
        if (result.error){
            console.error('Error:', result.error);
            App.swal.fire({
                title: "Error",
                text: App.REQUEST_NOT_PROCESSED,
            });
            return;
        }

        onChange('recommendation');
    });

    $('#keepAll').on('change', async function () {
        if ($(this).is(':checked')) {
            $.each(requirements, function (index, req) {
                requirements[index]['recommendation'] = 'Keep';
            });
        }

        reloadRequirements();

        draftData.requirements = requirements;

        const res = await fetch("/api/supabase?action=updateDraftRequirement", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: reqId, requirement: draftData})
        });
        
        const result = await res.json();
        if (result.error){
            console.error('Error:', result.error);
            App.swal.fire({
                title: "Error",
                text: App.REQUEST_NOT_PROCESSED,
            });
            return;
        }

        enableSignOffBtn();
    });

    $(document).on('click', '.comment-btn', async function () {
        const pos = $(this).data('pos');
        const comment = requirements[pos]['comment'] === undefined ? '' : requirements[pos]['comment'];
        
        const { value: text } = await App.swal.fire({
            input: "textarea",
            inputLabel: "Comment",
            inputPlaceholder: "Type your comment here...",
            inputAttributes: {
                "aria-label": "Type your comment here"
            },
            inputValue: comment,
            showCancelButton: true
        });
        requirements[pos]['comment'] = text;
        draftData.requirements = requirements;

        enableSignOffBtn();
        const res = await fetch("/api/supabase?action=updateDraftRequirement", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: reqId, requirement: draftData})
        });
        
        const result = await res.json();
        if (result.error){
            console.error('Error:', result.error);
            App.swal.fire({
                title: "Error",
                text: App.REQUEST_NOT_PROCESSED,
            });
            return;
        }
    });

    // $('input, select, textarea').on('change', async function () {
    //     if (reqId === null) return;
    //     if (isSaving) return;

    //     const clientName = $('#clientName').val().trim();
    //     const email = $('#email').val().trim();
    //     const companyName = $('#companyName').val().trim();
    //     const title = $('#title').val().trim();

    //     const payload = {
    //       client: {
    //         name: clientName,
    //         company: companyName,
    //         email: email,
    //         phone: $('#phone').val(),
    //         country: $('#country').val(),
    //         headcount: $('#headcount').val(),
    //         timeline: $('#timeline').val(),
    //       },
    //       title: title,
    //       submittedAt: new Date().toISOString()
    //     };

    //     if (!clientName || !email || !companyName || !title) return;
    //     console.log('empty: ', clientName);

    //     isSaving = true;

    //     $('.card')
    //     .find('input, select, textarea, button')
    //     .prop('disabled', true);

    //     const {data, error} = await updateClientRequirementInformation(reqId, payload);
    //     if (error) {
    //         console.error('Insert failed:', error);
    //         App.customError(App.OPERATION_FAILED);
    //         return;
    //     }

    //     $('.card')
    //     .find('input, select, textarea, button')
    //     .prop('disabled', false);

    //     isSaving = false;
    // });
});

function shortFB(fb) {
    if (!fb) return '—';
    if (fb.includes('Fully meets'))  return 'Fully meets';
    if (fb.includes('minor gaps'))   return 'Minor gaps';
    if (fb.includes('workaround'))   return 'Workaround';
    if (fb.includes('Partially'))    return 'Partial';
    if (fb.includes('Fails'))        return 'Fails';
    return fb.slice(0, 30) + '…';
}

async function loadReport(reqId){
    if (!reqId){
        $('#tab-analysis').html(`
            <div class="note">
                <strong>Note:</strong>
                <span>Data not available as yet...</span>
            </div>`);
            $('.note').css('background', '#f0f9ff');
        return;
    }

    const [reqRes, ffRes] = await Promise.all([
        fetch(`/api/supabase?action=getRequirementsByDrafReqId&reqId=${reqId}`,{
            method: "GET",
            credentials: "include" 
        }),
        fetch(`/api/supabase?action=getFormFields`)
    ]);

    const reqResult = await reqRes.json();
    const ffResult  = await ffRes.json();

    if (reqResult.error || ffResult.error) {
        console.log(reqResult, ffResult);
        App.customError(App.OPERATION_FAILED);
        return;
    }

    const data       = reqResult.data;
    const formFields = ffResult.data;

    if (data == null){
        $('#tab-analysis').html(`
            <div class="note">
                <strong>Note:</strong>
                <span>Data not available as yet...</span>
            </div>`);
            $('.note').css('background', '#f0f9ff');
        return;
    }
  
    renderReport(data, formFields);
}

function getVendorFB(vendors, vendorId) {
    return vendors.find(v => v.id === vendorId)?.feedback ?? [];
}

function scoreClass(pct) {
    if (pct >= 70) return 'high';
    if (pct >= 40) return 'mid';
    return 'low';
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

function heatColor(pct) {
    if (pct >= 80) return { bg: '#f0fdf4', text: '#15803d' };
    if (pct >= 60) return { bg: '#fefce8', text: '#854d0e' };
    if (pct >= 40) return { bg: '#fff7ed', text: '#c2410c' };
    return { bg: '#fef2f2', text: '#b91c1c' };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 0 — CHARTS
// ─────────────────────────────────────────────────────────────────
function renderCharts(vendors, reqs, fbLabels, sysParts, scoreMap) {
    const allAreas = ['All areas', ...sysParts];
    $('#chartPieRow').empty();

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

        const existingPie = Chart.getChart(`pieChart${vi}`);
        if (existingPie) existingPie.destroy();

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

    // 👇 destroy any existing chart on the heatmap canvas before creating a new one
    const existingBar = Chart.getChart('heatmapBarChart');
    if (existingBar) existingBar.destroy();

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
    $('#heatmapBody').empty();
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

    const scoreMap = buildScoreMap(vendors, reqs, allAreas, fbLabels);

    // ── Section 0 ── charts
    renderCharts(vendors, reqs, fbLabels, sysParts, scoreMap);

    // ── Section 1 ── Match Scores
    $('#scoreCards').empty();
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

    // const vendorThs = vendors.map(v => `<th>${v.name}</th>`).join('');
    // $('#scoreTableHead').html(`<tr><th>Area</th>${vendorThs}</tr>`);
    // allAreas.forEach(area => {
    //     const cells = vendors.map(v => {
    //         const pct = scoreMap[v.name][area];
    //         return `<td><span class="pill ${scoreClass(pct)}">${pct}%</span></td>`;
    //     }).join('');
    //     $('#scoreTableBody').append(`<tr><td>${area}</td>${cells}</tr>`);
    // });
}

async function onChange(type){
    const token = App.getParam('tk');
    const id = App.getParam('id');
    const hasChange = App.getCookie('onChange');

    const subject = `[RFP Tool] ${draftData.client.name} Has Submitted Their Requirements Review`;
    if (!hasChange){
        const res = await fetch('/api/send-email?action=onReviewChange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                token: token,
                link: `${PAGES.req_review}${id}`,
                subject: subject
            })
        });
        const result = await res.json();
        if (result.error){console.log(result.error)}
        App.setCookie('onChange', true);
    }
}

async function loadRequirementData(reqId){
    let data;
    let root;
    const response = await fetch(`/api/supabase?action=getDraftRequirement&reqId=${reqId}`);
        const result = await response.json();
    
        if (result.error) {
            console.error(result.error);
            App.customError(App.OPERATION_FAILED);
            return;
        }
    
    if (result.data === null){
        location.href = '../submitted.html';
    }

    data = result.data.data;
    root = result.data;

    if (root.approved == 'Y'){
        //location.href = '../signed_off.html';
        $('#note').text('This requirement has already been sign-off. No futher changes can be made.');
        $('.note').css('background', '#f0f9ff');
        $('#main-section').remove();
    }

    populateData(data);
}

function populateData(data){
    const clientName = data.client.name === undefined || data.client.name == '__' ? '' : data.client.name;
    const companyName = data.client.company === undefined ? '' : data.client.company;
    const email = data.client.email === undefined || data.client.email == '__' ? '' : data.client.email;
    //const phone = data.client.phone === undefined || data.client.phone == '__' ? '' : data.client.phone;
    const country = data.client.country === undefined ? '' : data.client.country;
    //const headcount = data.client.headcount === undefined || data.client.headcount == '__' ? '' : data.client.headcount;
    //const timeline = data.client.timeline === undefined || data.client.timeline == '__' ? '' : data.client.timeline;
    const title = data.title === undefined ? '' : data.title;

    $('#clientName').val(clientName);
    $('#companyName').val(companyName);
    $('#email').val(email);
    //$('#phone').val(phone);
    $('#country').val(country);
    //$('#headcount').val(headcount);
    //$('#timeline').val(timeline);
    $('#title').val(title);

    const $tbody = $('#requirementsTable tbody');

    $.each(data.requirements, function (index, req) {
        let note = '';

        const recommendation = req.recommendation !== undefined ? req.recommendation : '';

        if (!areas.includes(req.area)) areas.push(req.area);

        $tbody.append(`
            <tr style="font-size:14px;" data-id="${index}">
                <td><input data-id="${index}" style="transform: scale(1.5); border:1px solid #ccc; border-radius:6px; margin-left:10px;cursor: pointer;" type="checkbox" name="mark-req"></td>
                <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${req.area}</td>
                <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${req.requirement} (${req.system_part})</td>
                <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${req.priority}</td>
                <td style="padding:8px; border-bottom:1px solid #e5e7eb;">
                    <select data-pos="${index}" class="recommendation">
                        <option value="">-select-</option>
                        <option>Remove</option>
                        <option>Amend</option>
                        <option>Keep</option>
                    </select>
                    <button title="add a comment"
                        class="comment-btn"
                        data-pos="${index}"
                        style="
                            background:#fff;
                            padding:4px 8px;
                            cursor:pointer;
                            font-size:12px;
                        ">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"
                                stroke="#000"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <span id="note_${index}"></span>
                </td>
            </tr>
        `);

        $('select[data-pos="' + index + '"]').val(recommendation);
    });

    requirements = data.requirements;
    draftData = data;

    areas.forEach(area => {
        $('#categoryFilter').append(
            `<option value="${area}">${area}</option>`
        );
    });

    enableSignOffBtn();

    $('.main').removeClass('hide');
    App.hideElement('loader');
}

function reloadRequirements(){
    const $tbody = $('#requirementsTable tbody');
    $tbody.empty();
    $.each(requirements, function (index, req) {
        const recommendation = req.recommendation !== undefined ? req.recommendation : '';

        if (!areas.includes(req.area)) areas.push(req.area);

        $tbody.append(`
            <tr style="font-size:14px;" data-id="${index}">
                <td><input data-id="${index}" style="transform: scale(1.5); border:1px solid #ccc; border-radius:6px; margin-left:10px;cursor: pointer;" type="checkbox" name="mark-req"></td>
                <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${req.area}</td>
                <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${req.requirement} (${req.system_part})</td>
                <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${req.priority}</td>
                <td style="padding:8px; border-bottom:1px solid #e5e7eb;">
                    <select data-pos="${index}" class="recommendation">
                        <option value="">-select-</option>
                        <option>Remove</option>
                        <option>Amend</option>
                        <option>Keep</option>
                    </select>
                    <button title="add a comment"
                        class="comment-btn"
                        data-pos="${index}"
                        style="
                            background:#fff;
                            padding:4px 8px;
                            cursor:pointer;
                            font-size:12px;
                        ">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"
                                stroke="#000"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <span id="note_${index}"></span>
                </td>
            </tr>
        `);

        $('select[data-pos="' + index + '"]').val(recommendation);
    });
}

function enableSignOffBtn(){
    let keepReqCount = 0;
    let amendReqCount = 0;
    
    $.each(requirements, function (index, req) {
        const recommendation = req.recommendation !== undefined ? req.recommendation : '';
        const comment = req.comment !== undefined ? req.comment : '';
        if (recommendation == 'Keep') keepReqCount++;

        if (recommendation == 'Amend' && comment == ''){
            $(`tr[data-id="${index}"]`).addClass('warning');
           
            $(`#note_${index}`).empty();
            $(`#note_${index}`).append(`<span style="cursor:pointer" title="a comment is required"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg></span>`);
            amendReqCount++;
        }else{
            $(`tr[data-id="${index}"]`).removeClass('warning');
            $(`#note_${index}`).empty();
        }
    });

    if (keepReqCount == requirements.length){
        $('#submitRequirements').removeClass('hide');
    }else{
        $('#submitRequirements').addClass('hide');
    }

    if (amendReqCount > 0){
        $('#saveDraft').addClass('hide');
    }else{
        $('#saveDraft').removeClass('hide');
    }
}