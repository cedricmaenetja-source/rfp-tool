import * as App from "../app.js";

//import { getRequirementsById, getVendors, getVendorsByIdList, updateVendorList, getAssignedVendorsById, updateRequirementStatus } from "../services/supabase.js";

let requirementData = null;
let formFields = {};

$(function(){
    if (!App.loggedIn()){
        location.href = App.pages.login;
        return;
    }

    App.hasInternet(location.href);

    const requirement = getParam('req');
    const reqId = requirement ? decodeURIComponent(JSON.parse(atob(requirement))) : null;
    
    if (reqId === null){
        location.href = 'https://udder.rocks';
    }else{
        getFormFields();

        async function getRequirements(reqId) {
            await loadRequirements(reqId);
        }

        getRequirements(reqId);
        
        async function getAssignedVendors(reqId) {
            await loadAssignedVendors(reqId);
        }

        getAssignedVendors(reqId);
    }

    $('.add-btn-vendor').click(async function() {
        await loadVendors();
    });

    $('#closeVendorPanel').click(function() {
        $('#vendorPanel').removeClass('active');
    });

    $('#markAsDoneBtn').click(function() {
        App.swal.fire({
            title: "Are you sure?",
            text: "This requirement will be marked as completed. You won't be able to revert this!",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Yes!"
        }).then(async (result) => {
            if (result.isConfirmed) {
                const res = await fetch("/api/supabase?action=updateRequirementStatus", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: reqId, status: 'completed'})
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

                App.swal.fire({
                    title: "Success!",
                    text: "The requirement has been marked as completed.",
                    icon: "success"
                }).then((result) => {
                    location.reload();
                });
            }
        });
    });

    // Invite button
    $('#inviteVendorsBtn').click(async function() {
        const selected = $('#vendorList input:checked').map(function() {
            return $(this).val();
        }).get();

        if (selected.length === 0) {
            alert("Please select at least one vendor!");
            return;
        }

        console.log("Inviting vendors:", selected);
        getRequirementsById(reqId)
            .then(async data => {
                await sendVendorInvites(data.data, selected);
            })
            .catch(err => {
                console.error('Promise failed:', err);
            });

        $('#vendorPanel').removeClass('active');
    });

    $(document).on('click', '.resendInvitation', async function() {
        const id = $(this).data('id');

        App.swal.fire({
            title: "Are you sure you want to re-send the invite?",
            showCancelButton: true,
            confirmButtonText: "Yes",
        }).then((result) => {
            if (result.isConfirmed) {
                getRequirementsById(reqId)
                .then(async data => {
                    await sendVendorInvites(data.data, [id], true);
                })
                .catch(err => {
                    console.error('Promise failed:', err);
                    App.customError(App.OPERATION_FAILED);
                });
            } 
        });
    });

    // Search functionality
    $('#vendorSearch').on('input', function() {
        const search = $(this).val().toLowerCase();
        $('#vendorList .vendor-item').each(function() {
            const name = $(this).text().toLowerCase();
            $(this).toggle(name.includes(search));
        });
    });

    $('#generateReportBtn').on('click', function(){
        const reqId = getParam('req');
        if (reqId === null) return;
        
        const reportUrl = `report.html?req=${reqId}`;
        window.open(reportUrl, '_blank');
    });
});

function showSection(id) {
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
      document.getElementById(id).classList.add('active');
      event.target.classList.add('active');
    }

function renderPipeline(vendors, requirements) {
    vendors = vendors ?? [];
    const total     = vendors.length;
    const responded = vendors.filter(v => v.feedback && v.feedback.length).length;
    const pending   = total - responded;

    // Tiles
    $('#pipe-total').text(total);
    $('#pipe-responded').text(responded);
    $('#pipe-pending').text(pending);

    // Top match score (if scores are available on the vendor object)
    const scores = vendors
    .filter(v => v.match_score !== undefined)
    .map(v => parseInt(v.match_score));

    if (scores.length) {
    $('#pipe-top-score').text(Math.max(...scores) + '%');
    } else {
    $('#pipe-score-tile').hide();
    }

    // Vendor rows
    const $list = $('#pipeline-vendor-list').empty();
    const $attn = $('#pipeline-attention').empty();

    if (total === 0) {
    $list.html('<p style="font-size:13px;color:#8a8880;padding:4px 0;">No vendors assigned yet.</p>');
    $attn.html('<p style="font-size:13px;color:#8a8880;padding:4px 0;">No vendors assigned yet.</p>');
    return;
    }

    vendors.forEach(function(vendor) {
        const hasResponded = vendor.feedback && vendor.feedback.length > 0;
        const initials     = vendor.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        const pct          = hasResponded ? 100 : 0;
        const pill         = hasResponded
            ? '<span class="status-pill pill-done">Responded</span>'
            : '<span class="status-pill pill-pending">Pending</span>';

        $list.append(`
            <div class="vendor-row">
            <div class="vendor-avatar">${initials}</div>
            <div class="vendor-info">
                <div class="vendor-name">${vendor.name}</div>
                <div class="vendor-meta">${vendor.contact_person.email ?? ''}</div>
            </div>
            <div class="vendor-prog-wrap">
                <div class="vendor-prog-bg">
                <div class="vendor-prog-fill" style="width:${pct}%"></div>
                </div>
            </div>
            ${pill}
            </div>
        `);

        if (!hasResponded) {
            $attn.append(attentionItem('#E24B4A', `${vendor.name} has not responded yet`, `Invite sent to ${vendor.contact_person.email ?? 'unknown'}`));
        }
        });

        if (responded === total && total > 0) {
        $attn.append(attentionItem('#378ADD', 'All vendors have responded', 'Ready to review and score'));
        }

        if ($attn.children().length === 0) {
            $attn.html('<p style="font-size:13px;color:#8a8880;padding:4px 0;">Nothing needs attention right now.</p>');
        }

        const $vendorMenu = $('#vendor-menu-items').empty();
        vendors.forEach(function(vendor) {
        $vendorMenu.append(`
            <div class="menu-item" onclick="showSection('vendor_${vendor.id}')">
            ${vendor.name}
            </div>
        `);
    });
}

function attentionItem(dotColor, text, meta) {
    return `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f0ede8;">
        <div style="width:6px;height:6px;border-radius:50%;background:${dotColor};margin-top:5px;flex-shrink:0;"></div>
        <div>
        <div style="font-size:13px;color:#111827;line-height:1.45;">${text}</div>
        <div style="font-size:11.5px;color:#8a8880;margin-top:2px;">${meta}</div>
        </div>
    </div>
    `;
}

async function getFormFields(){
    const response = await fetch(`/api/supabase?action=getFormFields`);
    const result = await response.json();

    if (result.error) {
        console.error(result.error);
        App.customError(App.OPERATION_FAILED);
        return;
    }
    
    formFields = result.data;
}

async function getRequirementsById(reqId){
    const response = await fetch(`/api/supabase?action=getRequirementsById&reqId=${reqId}`);
    const result = await response.json();
    return result;
}

// Show the panel
async function loadVendors() {
    let vendorCount = 0;
    $('#vendorList').empty();
    $('#vendorPanel').addClass('active');
    App.showElement('xloader');
    $('#xloader').append(App.xloader());
    App.hideElement('vendorList');

    const response = await fetch(`/api/supabase?action=getVendors`);
    const result = await response.json();

    if (result.error) {
        console.error(result.error);
        App.customError(App.OPERATION_FAILED);
        return;
    }
    
    const vendors = App.validVendorsWithContactPerson(result.data);
    vendors.forEach(vendor => {
        const isAssigned = App.isVenderAssigned(requirementData.assigned_vendors, vendor.id);
        const hasSystemParts = App.vendorHasSystemPart(requirementData.requirements, vendor.system_parts);
        if (!isAssigned && hasSystemParts){
            const checkbox = `
                <div class="vendor-item">
                <label>
                    <input type="checkbox" id="${vendor.id}vendor" value="${vendor.id}" /> ${vendor.name}
                </label>
                </div>
            `;
            $('#vendorList').append(checkbox);
            vendorCount++;
        }
    });

    App.hideElement('xloader');
    App.showElement('vendorList');

    if (vendorCount == 0){
        $('#vendorList').append('<span style="font-size:12px;color:gray">No vendors found!</span>');
    }

    $('#vendorSearch').val('');
}

async function sendVendorInvites(requirementData,ids, resend = false){
    const vendors = requirementData.assigned_vendors ?? [];
   
    const idata = {
        'company': requirementData.client.company,
        'title': requirementData.title,
        'requirement_id': requirementData.id,
        'submission_url': [], 
        'invites': []
    };

    const res = await fetch("/api/supabase?action=getVendorsByIdList", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids})
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

    result.data.forEach(vendor => {
        if (vendor.contact_person !== null){
            idata['invites'].push(vendor.contact_person.email);
            vendors.push({
                'contact_person': vendor.contact_person,
                'id': vendor.id,
                'name': vendor.name
            });

            idata['submission_url'].push(`${App.pages.vendor_review}?vid=${vendor.id}&req=${encodeURIComponent(btoa(JSON.stringify(requirementData.id)))}`);
        }
    });

    if (vendors.length) requirementData.assigned_vendors = vendors;

    console.log(JSON.stringify(idata));
    const Toast = App.swal.mixin({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.onmouseenter = App.swal.stopTimer;
            toast.onmouseleave = App.swal.resumeTimer;
        }
    });

    Toast.fire({
        icon: "success",
        title: "Invitation(s) sent successfully!"
    });

    if (idata['invites'].length){
        if (!resend){
            const res = await fetch("/api/supabase?action=updateVendorList", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: requirementData})
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

        $.ajax({
            url: App.zapierVendorInvitationsWebhook,   
            type: 'POST',
            data: JSON.stringify(idata),         
            success: async function (response) {
                console.log('Success:', response);
            },
            error: function (xhr) {
                console.error('Error:', xhr.responseText);
                App.customError(App.OPERATION_FAILED);
            }
        });

        if (!resend) setTimeout(location.reload(), 4000);
        
    }else{
        console.log('No invites to send.');
    }
}

async function loadRequirements(requirementId) {
    const { data, error } = await getRequirementsById(requirementId);
    if (error) {
        console.error('Select failed (getRequirementsById):', error);
        alert('Failed to load data');
        return;
    }
    
    requirementData = data;
    if (data.status == App.COMPLETED){
        //$('.add-btn-vendor').addClass('hide');
        $('#markAsDoneBtn').prop('disabled', true);
        //$('.note').removeClass('hide');
    }
    
    Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
            Object.entries(value).forEach(([k, v]) => {
                const el = $(`#${key}_${k}`);
                if (el.length) {
                el.text(v);
                }
            });
            return;
        }

        const el = $(`#${key}`);
        if (el.length) {
            if (key == 'created_at'){
                const d = new Date(value);
                const formatted =
                    d.getDate().toString().padStart(2, '0') + ' ' +
                    d.toLocaleString('en-GB', { month: 'short' }) + ' ' +
                    d.getFullYear() + ' ' +
                    d.toTimeString().split(' ')[0];
                
                value = formatted;
            }

            el.text(value);
        }
    });
}

async function loadAssignedVendors(requirementId){
    const { data, error } = await getRequirementsById(requirementId);
    if (error) {
        console.error('Fetching requirement data failed (getRequirementsById):', error);
        alert('Failed to fetch data');
        return;
    }

    //$(`.sidebar`).append(`<div class="menu-item active" onclick="showSection('requirements')">Requirements Summary</div>`);
    data.requirements.forEach(function(key, value){
        $('#requirements table tbody').append(`
            <tr>
                <td>${key.area}</td>
                <td>${key.requirement}</td>
                <td width="15%">${key.priority}</td>
                <td width="15%">${key.system_part}</td>
            </tr>
        `);
    });
   
    const vendors = data.assigned_vendors ?? [];
    vendors.forEach(async vendor => {
        $(`.sidebar`).append(`<div class="menu-item" onclick="showSection('${vendor.id}_summary')">${vendor.name}</div>`);
        $(`.content`).append(`
            <!-- DOCUMENTS -->
            <div id="${vendor.id}_summary" class="content-section">
                <div class="vendor-responses">
                    <h3>Requirement Tracker</h3>
                    <hr/>
                    <button class="btn-outline resendInvitation" data-id="${vendor.id}">✉ Re-Send Invite</button>
                    <table id="${vendor.id}_vendor">
                        <thead>
                            <tr>
                                <th>Area</th>
                                <th>Description</th>
                                <th>Priority</th>
                                <th>Vendor Feedback</th>
                                <th>Vendor Comments</th>
                            </tr>
                        </thead>
                        <tbody>
                        </tbody>
                    </table>
                </div>
                <div class="vendor-responses">
                    <h3>List of requirements not fully met</h3>
                    <hr/>
                    <table id="${vendor.id}_not_met">
                        <thead>
                            <tr>
                                <th>Area</th>
                                <th>Description</th>
                                <th>Response</th>
                            </tr>
                        </thead>
                        <tbody>
                        </tbody>
                    </table>
                </div>
                <div class="vendor-responses">
                    <h3>Count of responses per area</h3>
                    <hr/>
                    <table id="${vendor.id}_per_area">
                        <thead></thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        `);

        await addRequirementsToTable(data, vendor.id, vendor.id);
    });

    if (data.status == App.COMPLETED){
        $('.resendInvitation').prop('disabled', true);
    }

    renderPipeline(data.assigned_vendors, data.requirements);
    $('.skeleton-container').addClass('hide');
    App.showElement('mainPage');
    $('#mainPage').css('display', 'block');
}

async function addRequirementsToTable(data, tableId, vendorId){
    let i = 0;
    let responsesCount = {};
    let perAreaHeaders = '';
    let areas = [];
    let responsesPerArea = {};

    formFields.vendor_feedback.forEach(feedback => {
        perAreaHeaders += `<th>${feedback}</th>`;
    });

    data.requirements.forEach(function(key, value){
        responsesCount[i] = {
            'area': key.area,
            'responses': []
        };

        areas.push(key.area);

        const vendorFeedback = App.getVendorFeedback(data.assigned_vendors, vendorId);
        const feedback = (vendorFeedback.length && vendorFeedback[i] !== undefined) ? vendorFeedback[i].feedback : '';
        const comment = (vendorFeedback.length && vendorFeedback[i] !== undefined) ? vendorFeedback[i].comment : '';

        $(`#${tableId}_vendor tbody`).append(`
            <tr>
                <td>${key.area}</td>
                <td>${key.requirement}</td>
                <td>${key.priority}</td>
                <td>${feedback}</td>
                <td>${comment}</td>
            </tr>
        `);

        if (feedback != formFields.vendor_feedback[0]){
            $(`#${tableId}_not_met tbody`).append(`
                <tr>
                    <td>${key.area}</td>
                    <td>${key.requirement}</td>
                    <td>${feedback}</td>
                </tr>
            `);
        }

        formFields.vendor_feedback.forEach(f => {
            const count = (feedback != '' && feedback === f) ? 1 : 0;
            responsesCount[i]['responses'].push(count);
        });

        i++;
    });

    $(`#${tableId}_per_area thead`).append(`
        <tr>
            <th>Area</th>
            ${perAreaHeaders}
            <th>Count</th>
        </tr>
    `);

    $.each(responsesCount, function(index, item) {
        if (item.area in responsesPerArea){
            $.each(item.responses, function(i, response) {
                responsesPerArea[`${item.area}`][i] += response;
            });
        }else{
            responsesPerArea[`${item.area}`] = [];
            $.each(item.responses, function(i, response) {
                responsesPerArea[`${item.area}`].push(response);
            });
        }
    });

    console.info('responsesCount', responsesPerArea);

    let sum = {};
    let count = 0;
    Object.keys(responsesPerArea).forEach(key => {
        let total = 0;
        let row = `<td>${key}</td>`;

        $.each(responsesPerArea[key], function(i, response) {
            row += `<td style="text-align:center">${response}</td>`;
            total += response;
        });

        row += `<td style="text-align:center">${total}</td>`;

        $(`#${tableId}_per_area tbody`).append(`
            <tr>${row}</tr>
        `);

        count++;
    });

    // $.each(responsesCount, function(index, item) {
    //     let total = 0;
    //     let row = `<td>${item.area}</td>`;

    //     $.each(item.responses, function(i, response) {
    //         console.log("Response", i, response);
    //         row += `<td style="text-align:center">${response}</td>`;
    //         total += response;
    //     });

    //     row += `<td style="text-align:center">${total}</td>`;

    //     $(`#${tableId}_per_area tbody`).append(`
    //         <tr>${row}</tr>
    //     `);

    //     count++;
    // });
}
