import * as App from "../app.js";

import { getRequirementsById, getVendors, getVendorsByIdList, updateVendorList, getAssignedVendorsById } from "../services/supabase.js";

let requirementData = null;

$(function(){
    if (!App.loggedIn()){
        location.href = App.pages.login;
        return;
    }

    App.hasInternet(location.href);

    const requirement = getParam('req');
    const reqId = requirement ? decodeURIComponent(JSON.parse(atob(requirement))) : null;
    
    if (reqId === null){
        // add 404 page
    }else{
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

    // Close panel
    $('#closeVendorPanel').click(function() {
        $('#vendorPanel').removeClass('active');
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

    // Search functionality
    $('#vendorSearch').on('input', function() {
        const search = $(this).val().toLowerCase();
        $('#vendorList .vendor-item').each(function() {
            const name = $(this).text().toLowerCase();
            $(this).toggle(name.includes(search));
        });
    });
});

// Show the panel
async function loadVendors() {
    let vendorCount = 0;
    $('#vendorList').empty();
    $('#vendorPanel').addClass('active');
    App.showElement('xloader');
    $('#xloader').append(App.xloader());
    App.hideElement('vendorList');

    const { data, error } = await getVendors();
    
    if (error) {
        console.error('Select failed:', error);
        alert('Failed to load data');
    }else{
        const vendors = App.validVendorsWithContactPerson(data);
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
}

async function sendVendorInvites(requirementData,ids){
    const vendors = requirementData.assigned_vendors ?? [];
   
    const idata = {
        'company': requirementData.client.company,
        'title': requirementData.title,
        'requirement_id': requirementData.id,
        'submission_url': [], // placeholder
        'invites': []
    };

    const { data, error } = await getVendorsByIdList(ids);
    if (error) {
        console.error('Sending invites failed:', error);
        alert('Failed to send invites');
    } else {
        data.forEach(vendor => {
            if (vendor.contact_person !== null){
                idata['invites'].push(vendor.contact_person.email);
                vendors.push({
                    'contact_person': vendor.contact_person,
                    'id': vendor.id,
                    'name': vendor.name
                });

                idata['submission_url'].push(`https://rfp-tool-d4ythyvqd-yungs-projects-9939417f.vercel.app/requirements_review.html?vid=${vendor.id}&req=${encodeURIComponent(btoa(JSON.stringify(requirementData.id)))}`);
            }
        });
    }

    if (vendors.length) requirementData.assigned_vendors = vendors;

    console.log(JSON.stringify(idata));

    if (idata['invites'].length){
        const { data, error } = await updateVendorList(requirementData);

        if (error) {
            console.error('Saving invites failed:', error);
            alert('Failed to save invites');
        }

        $.ajax({
            url: 'https://hooks.zapier.com/hooks/catch/25735666/uq8x4ke/',   
            type: 'POST',
            data: JSON.stringify(idata),         
            success: function (response) {
                console.log('Success:', response);
                alert('Invitations sent successfully!');
                location.reload();
            },
            error: function (xhr) {
                console.error('Error:', xhr.responseText);
                alert('Something went wrong');
            }
        });
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
                    d.toLocaleString('en-ZA', { month: 'short' }) + ' ' +
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
        $(`.sidebar`).append(`<div class="menu-item" onclick="showSection('${vendor.id}_vendor')">${vendor.name}</div>`);
        $(`.content`).append(`
            <!-- DOCUMENTS -->
            <div id="${vendor.id}_vendor" class="content-section">
                <h3>Requirement Tracker</h3>

                <table>
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
        `);

        await addRequirementsToTable(data, `${vendor.id}_vendor`, vendor.id);
    });

    $('.skeleton-container').addClass('hide');
    App.showElement('mainPage');
    $('#mainPage').css('display', 'block');
}

async function addRequirementsToTable(data, tableId, vendorId){
    let i = 0;
    data.requirements.forEach(function(key, value){
        const vendorFeedback = App.getVendorFeedback(data.assigned_vendors, vendorId);
        
        const feedback = (vendorFeedback.length && vendorFeedback[i] !== undefined) ? vendorFeedback[i].feedback : '';
        const comment = (vendorFeedback.length && vendorFeedback[i] !== undefined) ? vendorFeedback[i].comment : '';

        $(`#${tableId} table tbody`).append(`
            <tr>
                <td>${key.area}</td>
                <td>${key.requirement}</td>
                <td>${key.priority}</td>
                <td>${feedback}</td>
                <td>${comment}</td>
            </tr>
        `);

        i++;
    });
}
