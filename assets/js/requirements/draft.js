import * as App from "../app.js";
import { initAuth, getCurrentUser } from '../core/_auth.js';

let configurationFields;
let requirementInfo = {};
let requirementId;
let isApproved = false;

(async () => {
    const token = await initAuth();
    if (token.error){ window.location.href = App.pages.login;return;}
    
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = App.pages.login;
        return;
    }

    window._user = user.data;
    const reqId = App.getParam('id');
    const id = reqId ? reqId : null;
    if (id === null){
        location.href = App.pages.dashboard;
    }

    loadPage(id);
    requirementId = id;

    // async function loadConfigurations(){
    //     await getConfigurationFields();
    // }

    getConfigurationFields();
    
    //loadConfigurations();

    $('#country').on('change', async function() {
        updateData();
        await autoSaved();
    });
    
    $(document).on('change', '.requirement-select', async function() {
        const field = $(this).data('field');
        const pos = $(this).data('pos');
        const val = $(this).val();

        //if (requirementInfo.requirements[pos] === undefined) requirementInfo.requirements.push({});
        requirementInfo.requirements[pos][field] = val;
        
        updateData();
        await autoSaved();
    });

    $(document).on('focus', '.editable', function () {
        if ($(this).text().trim() === '__') {
            $(this).text('');
            $(this).removeClass('empty');
        }
    });

    $(document).on('blur', '.requirement-field', async function () {
        const val = $(this).text().trim();
        const pos = $(this).data('pos');

        requirementInfo.requirements[pos]['requirement'] = val;
        updateData();
        await autoSaved();
    });

    $(document).on('blur', '.editable', async function () {
        const id = $(this).attr('id');
        
        if (id == 'client_company'){
            if ($(this).text().trim() === ''){
                $(this).text('Company Name *');
                $(this).addClass('empty');
            }
        }else if (id == 'title'){
            if ($(this).text().trim() === ''){
                $(this).text('Title *');
                $(this).addClass('empty');
            }
        }else{
            if ($(this).text().trim() === '') {
                $(this).text('__');
                $(this).addClass('empty');
            }
        }

        updateData();
        await autoSaved();
        console.log(requirementInfo);
    });

    $(document).on('click', '.remove-requirement', function () {
        removeRow(this);
    }); 

    $('#sendToClientBtn').on('click', async function() {
        const email = requirementInfo.client !== undefined && requirementInfo.client.email !== undefined || requirementInfo.client.email != '' ? requirementInfo.client.email : '';
        const title = requirementInfo.title !== undefined && requirementInfo.title != '' ? requirementInfo.title : '';
        const company = requirementInfo.client !== undefined && requirementInfo.client.company !== undefined || requirementInfo.client.company != '' ? requirementInfo.client.company : '';
        const name = requirementInfo.client !== undefined && requirementInfo.client.name !== undefined || requirementInfo.client.name != '' ? requirementInfo.client.name : '';
        
        if (email != '' && title != '' && company != ''){
            App.swal.fire({
                title: "Are you sure?",
                text: `A link to review the requirements will be shared with ${email}`,
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Yes, share it!"
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const origin = window.location.origin;
                   
                    const res = await fetch('/api/send-email?action=clientReqReview', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            email: email, 
                            link: `${origin}/client/review.html?id=${id}`,
                            clientName: name,
                            userId: window._user.id,
                        })
                    });
                    const result = await res.json();
                    if (result.error){App.customError(result.error);return;}

                    App.swal.fire({
                        title: "Success",
                        text: "A link has been shared!",
                        icon: "success"
                    });

                    // $.ajax({
                    //     url: 'https://hooks.zapier.com/hooks/catch/25735666/uqhb60x/',   
                    //     type: 'POST',
                    //     data: JSON.stringify({
                    //         email: email,
                    //         review_url: `${origin}/client/review.html?id=${id}`,
                    //         title: title
                    //     }),         
                    //     success: function (response) {
                    //         App.swal.fire({
                    //             title: "Success",
                    //             text: "A link has been shared!",
                    //             icon: "success"
                    //         });
                    //     },
                    //     error: function (xhr) {
                    //         console.error('Error:', xhr.responseText);
                    //         App.customError(App.OPERATION_FAILED);
                    //     }
                    // });
                }
            });
        }else{
            App.customError('An email and title are required!');
        }
    });

    $('#markAsDoneBtn').on('click', async function() {
        if (requirementInfo.client === undefined || requirementInfo.title === undefined || requirementInfo.requirements === undefined){
            App.customError('All fields with * are required!');
            return;
        }

        App.swal.fire({
            title: "Ready to send to vendors?",
            text: "This can not be undone. Are you sure you want to proceed?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Yes, continue!"
            }).then(async (result) => {
            if (result.isConfirmed) {
                const res = await fetch("/api/supabase?action=addNewRequirement", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ requirement: requirementInfo, status: 'active'})
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

                const reqId = encodeURIComponent(btoa(JSON.stringify(result.data.id)));

                const response = await fetch("/api/supabase?action=removeDraftRequirement", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: id})
                });

                const r = await response.json();
                if (r.error){
                    console.error('Error:', r.error);
                    App.swal.fire({
                        title: "Error",
                        text: App.REQUEST_NOT_PROCESSED,
                    });
                    return;
                }

                App.swal.fire({
                    title: "Marked As Done!",
                    text: "Would you like to send to vendors now?",
                    icon: "success",
                    showCancelButton: true,
                    confirmButtonColor: "#3085d6",
                    cancelButtonColor: "#d33",
                    confirmButtonText: "Yes",
                    cancelButtonText: 'No'
                    }).then(async (result) => {
                        if (result.isConfirmed) {
                            location.href = `details.html?req=${reqId}`;
                        }else{
                            location.href = App.pages.dashboard;
                        }
                });
            }
        });
    });

    $(document).on('click', '#addRowBtn', function () {
        addRow();
    });

    $(document).on('click', '.editable-dropdown', function () {
        if (isApproved) return;

        let fields = [];
        const field = $(this).data('field');
        const pos = $(this).data('pos');
      
        const td = $(this);

        if (field == 'area'){
            fields = configurationFields.area;
        }

        if (field == 'priority'){
            fields = App.priorityList;
        }

        if (field == 'system_part'){
            fields = configurationFields.system_parts;
        }

        // Prevent duplicate dropdown
        if (td.find('select').length) return;

        const currentValue = td.text().trim();

        const select = $(`<select class="requirement-select" data-pos="${pos}" data-field="${field}"></select>`);
        select.append('<option value="">-select-</option>');
        fields.forEach(cat => {
            select.append(
            $('<option>', {
                value: cat,
                text: cat,
                selected: cat === currentValue
            })
            );
        });

        td.empty().append(select);
        select.focus();

        // Save on change or blur
        select.on('change blur', function () {
            const value = $(this).val();
            td.text(value).attr('data-value', value);
        });
    });
})();

$(function(){
    // if (!App.loggedIn()){
    //     location.href = App.pages.login;
    //     return;
    // }
    App.hasInternet(location.href);
});

async function autoSaved() {
  App.showElement('save-status');
  setTimeout(function(){
    App.hideElement('save-status');
  }, 1000);

  const res = await fetch("/api/supabase?action=updateDraftRequirement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requirementId, requirement: requirementInfo})
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

function updateData(){
    requirementInfo['client']['company'] = $('#client_company').text();
    requirementInfo['client']['name'] = $('#client_name').text();
    requirementInfo['client']['email'] = $('#client_email').text();
    requirementInfo['client']['phone'] = $('#client_phone').text();
    requirementInfo['client']['country'] = $('#country').val();
    requirementInfo['client']['headcount'] = $('#head_count').text();
    requirementInfo['client']['timeline'] = $('#client_timeline').text();
    requirementInfo['title'] = $('#title').text();
}

function disableFields(){
    if (!isApproved) return;

    $('#client_company').removeAttr('contenteditable');
    $('#client_name').removeAttr('contenteditable');
    $('#client_email').removeAttr('contenteditable');
    $('#client_phone').removeAttr('contenteditable');
    $('#country').prop('disabled', true);
    $('#title').removeAttr('contenteditable');
    $('#head_count').removeAttr('contenteditable');
    $('#client_timeline').removeAttr('contenteditable');
    
    $('#requirementsTable td').each(function() {
        $(this)
            .removeAttr('contenteditable')  
            .attr('contenteditable', 'false') 
            .off('input keydown paste')     
            .on('keydown paste input', function(e) {
                e.preventDefault();       
            });
    });

    $('.remove-requirement').prop('disabled', true);
    $('#addRowBtn').prop('disabled', true);
    $('#sendToClientBtn').prop('disabled', true);
    $('.note').removeClass('hide');
}

function updateRequirements(requirements){
    requirementInfo['requirements'] = requirements;
}

async function loadPage(id){
    let data;
    let root;

    const response = await fetch(`/api/supabase?action=getDraftRequirement&reqId=${id}`);
    const result = await response.json();

    if (result.error) {
        console.error(result.error);
        App.customError(App.OPERATION_FAILED);
        return;
    }

    if (result.data === null){
        location.href = App.pages.dashboard;
    } 

    data = result.data.data;
    root = result.data;
    
    let company = '';
    let name = '';
    let email = '';
    let phone = '';
    let country = '';
    let headcount = '';
    let timeline = '';
    let title = data.title === undefined ? '' : data.title;

    if (data.client !== undefined){
        company = data.client.company;
        name = data.client.name;
        email = data.client.email;
        phone = data.client.phone;
        country = data.client.country;
        headcount = data.client.headcount;
        timeline = data.client.timeline;
    }

    if (company != '') $('#client_company').text(company);
    if (name != '') $('#client_name').text(name);
    if (email != '') $('#client_email').text(email);
    if (phone != '') $('#client_phone').text(phone);
    if (country != '') $('#country').val(country);
    if (title != '') $('#title').text(title);
    if (headcount != '') $('#head_count').text(headcount);
    if (timeline != '') $('#client_timeline').text(timeline);

    if (root.approved == 'Y'){
        isApproved = true;
    }

    requirementInfo = {
        client: {
            company: company,
            name: name,
            email: email,
            phone: phone,
            country: country,
            headcount: headcount,
            timeline: timeline
        },
        title: title,
        requirements: data.requirements
    };

    reloadRequirement(data.requirements);

    // let i = 0;
    // data.data.requirements.forEach(req => {
    //     const hasNotes = req.comment !== undefined || req.recommendation !== undefined ? true : false;
    //     const comment = req.comment !== undefined ? req.comment : '';
    //     const recommendation = req.recommendation !== undefined ? req.recommendation : '';

    //     const notesIcon = hasNotes 
    //         ? `<i style="margin-right:10px" class="qtip tip-top" data-tip="${req.recommendation}: ${comment}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    //             xmlns="http://www.w3.org/2000/svg">
    //             <path d="M12 20h9"
    //                     stroke="#000"
    //                     stroke-width="2"
    //                     stroke-linecap="round"
    //                     stroke-linejoin="round"/>
    //             <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
    //                     stroke="#000"
    //                     stroke-width="2"
    //                     stroke-linecap="round"
    //                     stroke-linejoin="round"/>
    //             </svg></i>`
    //         : '';

    //     $('#requirementsTable tbody').append(`
    //         <tr>
    //             <td class="editable-dropdown" data-pos="${i}" data-field="area" data-value="${req.area}">${req.area}</td>
    //             <td contenteditable="true" class="requirement-field" data-pos="${i}">${req.requirement}</td>
    //             <td class="editable-dropdown" data-pos="${i}" data-field="priority" data-value="${req.priority}" contenteditable="true">${req.priority}</td>
    //             <td class="editable-dropdown" data-pos="${i}" data-field="system_part">${req.system_part}</td>
    //             <td>
    //                 ${notesIcon}
    //                 <button type="button" class="remove-requirement" data-pos="${i}" title="remove" style="color:red;cursor:pointer;border:1px solid var(--border-color);background:white">x</button>
    //             </td> 
    //         </tr>   
    //     `);
    //     i++;
    // });

    $('.skeleton-container').addClass('hide');
    App.showElement('mainPage');
    $('#mainPage').css('display', 'block');
}

function getRowColor(recommendation){
    const colors = {
        keep: '#22C55E',
        amend: '#FBBF24',
        remove: '#EF4444'
    };

    return colors[recommendation];
}

function addRow() {
    // const rowCount = $('#requirementsTable tbody tr').length;
    // const i = rowCount;
    // $('#requirementsTable tbody').append(`
    //     <tr>
    //         <td class="editable-dropdown" data-pos="${i}" data-field="area" data-value=""></td>
    //         <td contenteditable="true" class="requirement-field" data-pos="${i}"></td>
    //         <td class="editable-dropdown" data-pos="${i}" data-field="priority" contenteditable="true"></td>
    //         <td class="editable-dropdown" data-pos="${i}" data-field="system_part"></td>
    //         <td>
    //         <button type="button" class="remove-requirement" data-pos="${i}" title="remove" style="color:red;cursor:pointer;border:none;background:white">x</button>
    //         </td> 
    //     </tr>   
    // `);

    requirementInfo.requirements.push({
        area: '',
        requirement: '',
        priority: '',
        system_part: ''
    });

    reloadRequirement(requirementInfo.requirements);
}

async function removeRow(button) {
    const pos = $(button).data('pos');
   
    requirementInfo.requirements.splice(pos, 1);
    button.closest('tr').remove();

    reloadRequirement(requirementInfo.requirements);
    await autoSaved();
}

async function getConfigurationFields(){
    const response = await fetch(`/api/supabase?action=getFormFields`);
    const result = await response.json();

    if (result.error) {
        console.error(result.error);
        App.customError(App.OPERATION_FAILED);
        return;
    }
    
    configurationFields = result.data;
}

function reloadRequirement(requirements){
    $('#requirementsTable tbody').empty();

    let i = 0;
    requirements.forEach(req => {
        const hasNotes = req.comment !== undefined || req.recommendation !== undefined ? true : false;
        const comment = req.comment !== undefined ? req.comment : '';
        const recommendation = req.recommendation !== undefined ? req.recommendation : '';

        const notesIcon = hasNotes 
            ? `<i style="margin-right:10px" class="qtip tip-top" data-tip="${req.recommendation}: ${comment}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path d="M12 20h9"
                        stroke="#000"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"/>
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                        stroke="#000"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"/>
                </svg></i>`
            : '';

        $('#requirementsTable tbody').append(`
            <tr>
                <td class="editable-dropdown" data-pos="${i}" data-field="area" data-value="${req.area}">${req.area}</td>
                <td contenteditable="true" class="requirement-field" data-pos="${i}">${req.requirement}</td>
                <td class="editable-dropdown" data-pos="${i}" data-field="priority" data-value="${req.priority}" contenteditable="true">${req.priority}</td>
                <td class="editable-dropdown" data-pos="${i}" data-field="system_part">${req.system_part}</td>
                <td data-pos="${i}">${recommendation}</td>
                <td data-pos="${i}">${comment}</td>
                <td>
                    <button type="button" class="remove-requirement" data-pos="${i}" title="remove" style="color:red;cursor:pointer;border:1px solid var(--border-color);background:white;border:none">remove</button>
                </td> 
            </tr>   
        `);
        i++;
    });

    disableFields();
}