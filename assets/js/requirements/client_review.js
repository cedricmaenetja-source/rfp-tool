import * as App from "../app.js";

let requirements = [];
let draftData = {};
let isSaving = false;
let areas = [];
const warningColor = '#D32F2F33';

$(function(){
    $('.input-row input, select, #title').prop('disabled', true);
    $('#categoryFilter').prop('disabled', false);
    $('#recommendationOptions').prop('disabled', false);

    const id = App.getParam('id');
    const reqId = id ? id : null;

    if (reqId === null){
        location.href = 'https://udder.rocks'
    }

    loadRequirementData(reqId);
    
    // async function loadFormFields(){
    //     const {data, error} = await getFormFields();
    //     if (error) {
    //         console.error('Insert failed:', error);
    //         App.customError(App.OPERATION_FAILED);
    //         return;
    //     }

    //     //$('#areaInput').empty();
    //     for (var area of data.area){
    //         $('#areaInput').append(`<option>${area}</option>`);
    //     }

    //     for (var part of data.system_parts){
    //         $('#systemPartInput').append(`<option>${part}</option>`);
    //     }
    // }

    //loadFormFields();

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

    $('#saveDraft').on('click', function(){
        const subject = `Recommendations have been added - ${draftData.title} (${draftData.client.company}).`;

        App.swal.fire({
            title: "Success!",
            text: "Your draft has been saved!",
            icon: "success"
        });

        $.ajax({
            url: 'https://hooks.zapier.com/hooks/catch/25735666/uehldfq/',   
            type: 'POST',
            data: JSON.stringify({
                subject: subject,
                body: 'Recommendation have been added. Please login to the admin portal to view.'
            }),         
            success: function (response) {
                App.setCookie('onChange', true);
            },
            error: function (xhr) {
                console.error('Error:', xhr.responseText);
                App.customError('Ooops, something went wrong. Please try again later.');
            }
        });
    });

    $('#categoryFilter').on('change', function(){
        const selected = $(this).val().toLowerCase();

        $('#requirementsTable tbody tr').each(function(){
            const category = $(this).find('td:first').text().toLowerCase();

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

                $.ajax({
                    url: 'https://hooks.zapier.com/hooks/catch/25735666/uehldfq/',   
                    type: 'POST',
                    data: JSON.stringify({
                        subject: `Requirement Signed-Off - ${draftData.title} (${draftData.client.company})`,
                        body: 'This requirement has been signed-off. Login to the admin portal to view.'
                    }),         
                    success: function (response) {
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
                            title: "Sign-off successful"
                        });

                        setTimeout(function(){
                            location.href = '../thank_you.html';
                        }, 4000);
                    },
                    error: function (xhr) {
                        console.error('Error:', xhr.responseText);
                        App.customError('Ooops, something went wrong. Please try again later.');
                        $(this).prop('disabled', false);
                    }
                });
            } 
        });

        // const clientName = $('#clientName').val().trim();
        // const email = $('#email').val().trim();
        // const companyName = $('#companyName').val().trim();
        // const title = $('#title').val().trim();

        // if (requirements.length === 0) {
        //   alert('Please add at least one requirement.');
        //   $(this).prop('disabled', false).html('Submit Requirements');
        //   return;
        // }

        // if (!clientName || !email || !companyName || !title) {
        //   alert('All fields with * are required.');
        //   $(this).prop('disabled', false).html('Submit Requirements');
        //   return;
        // }

        // const payload = {
        //   client: {
        //     name: $('#clientName').val(),
        //     company: $('#companyName').val(),
        //     email: $('#email').val(),
        //     phone: $('#phone').val(),
        //     country: $('#country').val(),
        //     headcount: $('#headcount').val(),
        //     timeline: $('#timeline').val(),
        //   },
        //   title: $('#title').val(),
        //   requirements,
        //   submittedAt: new Date().toISOString()
        // };

        // console.log('Submitted:', payload);
        // if (text == 'Approve Requirements'){
        //     const {data, error} = await updateRequirementStatus(reqId, 'approved');
        //     if (error) {
        //         console.error('Insert failed:', error);
        //         alert('Failed to load data');
        //         $(this).prop('disabled', false).html(text);
        //         return;
        //     }

        //     $.ajax({
        //         url: 'https://hooks.zapier.com/hooks/catch/25735666/uliuuvi/',   
        //         type: 'POST',
        //         data: JSON.stringify(payload),         
        //         success: function (response) {
        //             console.log('Success:', response);
        //             location.href = 'thank_you.html';
        //         },
        //         error: function (xhr) {
        //             console.error('Error:', xhr.responseText);
        //         alert('Something went wrong');
        //             $(this).prop('disabled', false).html(text);
        //         }
        //     });
        // }else{
        //     const {data, error} = await addNewRequirement(payload);
        //     if (error) {
        //         console.error('Insert failed:', error);
        //         App.customError(App.OPERATION_FAILED);
        //         $(this).prop('disabled', false).html('Submit Requirements');
        //         return;
        //     } 
            
        //     payload['review_url'] = `${location.href}?req=${encodeURIComponent(btoa(JSON.stringify(data.id)))}`;
            
        //     $.ajax({
        //         url: 'https://hooks.zapier.com/hooks/catch/25735666/uqhb60x/',   
        //         type: 'POST',
        //         data: JSON.stringify(payload),         
        //         success: function (response) {
        //             console.log('Success:', response);
        //             location.href = 'thank_you.html';
        //         },
        //         error: function (xhr) {
        //             console.error('Error:', xhr.responseText);
        //         alert('Something went wrong');
        //             $(this).prop('disabled', false).html('Submit Requirements');
        //         }
        //     });
        // }

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

        //onChange('recommendation');
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

function onChange(type){
    const hasChange = App.getCookie('onChange');

    const subject = `A new ${type} has been added - ${draftData.title} (${draftData.client.company}).`;
    if (!hasChange){
        $.ajax({
            url: 'https://hooks.zapier.com/hooks/catch/25735666/uehldfq/',   
            type: 'POST',
            data: JSON.stringify({
                subject: subject,
                body: 'A new recommendation has been loaded. Please login to the admin portal to view.'
            }),         
            success: function (response) {
                App.setCookie('onChange', true);
            },
            error: function (xhr) {
                console.error('Error:', xhr.responseText);
                App.customError('Ooops, something went wrong. Please try again later.');
            }
        });
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
        location.href = '../signed_off.html';
    }

    populateData(data);
}

function populateData(data){
    const clientName = data.client.name === undefined || data.client.name == '__' ? '' : data.client.name;
    const companyName = data.client.company === undefined ? '' : data.client.company;
    const email = data.client.email === undefined || data.client.email == '__' ? '' : data.client.email;
    const phone = data.client.phone === undefined || data.client.phone == '__' ? '' : data.client.phone;
    const country = data.client.country === undefined ? '' : data.client.country;
    const headcount = data.client.headcount === undefined || data.client.headcount == '__' ? '' : data.client.headcount;
    const timeline = data.client.timeline === undefined || data.client.timeline == '__' ? '' : data.client.timeline;
    const title = data.title === undefined ? '' : data.title;

    $('#clientName').val(clientName);
    $('#companyName').val(companyName);
    $('#email').val(email);
    $('#phone').val(phone);
    $('#country').val(country);
    $('#headcount').val(headcount);
    $('#timeline').val(timeline);
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