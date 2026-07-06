import * as App from "../app.js";
import { countryList } from "../utils/constants.js";

let formFields = {};
let fileContents = {};
let uploadedFileName = '';
let error = false;
let errorList = {
    headings: [],
    priority: [],
    area: [],
    system: []
};

$(function(){
    if (!App.loggedIn()){
        location.href = App.pages.login;
        return;
    }

    async function loadSumamaries() {
        await home();
    }

    App.hasInternet();

    loadSumamaries();
    updateDraftRequirementsCount();
    updateVendorsCount();
    updateCompletedRequirements();

    let currentStep = 1;

    function openWizard(){
        currentStep = 1;
        renderStep();
        $('#wizardModal').css('display', 'flex').hide().fadeIn();
    }

    async function renderStep() {
        $('.step').removeClass('active');
        $('.step').each(function(index){
            if(index < currentStep){
                $(this).addClass('active');
            }
        });

        if(currentStep === 1){
            $('.step-label').text('Step 1');
            $('.wizard-content h2').text('File Upload Requirements');
            $('.description').html(`
                Please use the sample structure below before uploading your file.<br>
                <small style="color:#888;">Note: Only Excel files (.xlsx, .xls) are accepted.</small>
            `);
            $('.card-group').html(`
                <div class="file-sample-box">
                    <p><strong>Required Columns (case sensetive):</strong></p>
                    <p>area | requirement | priority | system_part</p>

                    <a href="../../resources/template.xlsx" download id="downloadSample" class="sample-btn">
                        Download Sample File
                    </a>

                    <label class="upload-btn">
                        Choose File
                        <input type="file" id="excelFile" accept=".xlsx,.xls" hidden>
                    </label>

                    <div id="fileName" class="file-name">
                        No file selected
                    </div>
                </div>
            `);

            $('.card-group').removeClass('block');
            $('#backBtn').hide();
            $('#nextBtn').text('Next');

            if (uploadedFileName == '') $('#nextBtn').prop('disabled', true);
        }

        if(currentStep === 2){
            $('#nextBtn').prop('disabled', true);

            $('.step-label').text('Step 2');
            $('h2').text('Requirements Validations');
            $('.description').text('Running checks...');
            $('.card-group').html(`
                <div class="checklist-item" data-type="headings">
                    <span class="title">File Headers <span id="headings-error"></span></span>
                    <span class="status">❌</span>
                </div>
                <div class="checklist-item" data-type="area">
                    <span class="flash-text title" id="areaCheck">Area Listing <span id="area-error"></span></span>
                    <span class="status">❌</span>
                </div>
                <div class="checklist-item" data-type="priority">
                    <span id="priorityCheck" class="title">Priority Listing <span id="priority-error"></span></span>
                    <span class="status">❌</span>
                </div>
                <div class="checklist-item" data-type="system">
                    <span id="systemPartCheck" class="title">System Part Listing <span id="system-error"></span></span>
                    <span class="status">❌</span>
                </div>
            `);

            $('.card-group').addClass('block');

            const response = await fetch(`/api/supabase?action=getFormFields`);
            const result = await response.json();

            if (result.error) {
                console.error(result.error);
                App.customError(App.OPERATION_FAILED);
                return;
            }
            
            for (var requirement of fileContents){
                if (!requirement.area || !result.data.area.includes(requirement.area)){
                    error = true;
                    errorList['area'].push(requirement.area);
                }
            }
            
            $('#areaCheck').removeClass('flash-text');
            $('#priorityCheck').addClass('flash-text');
            if (!error){
                updateChecklist('area', true);
            }

            for (var requirement of fileContents){
                if (!requirement.priority || !App.priorityList.includes(requirement.priority)){
                    error = true;
                    errorList['priority'].push(requirement.priority);
                }
            }

            $('#priorityCheck').removeClass('flash-text');
            $('#systemPartCheck').addClass('flash-text');
            if (!error){
                updateChecklist('priority', true);
            }

            for (var requirement of fileContents){
                if (!requirement.system_part || !result.data.system_parts.includes(requirement.system_part)){
                    error = true;
                    errorList['system'].push(requirement.system_part);
                }
            }

            $('#systemPartCheck').removeClass('flash-text');
            if (!error){
                updateChecklist('system', true);
            }

            fileUploadErrors(errorList);

            if (!error){
                $('#nextBtn').prop('disabled', false);
            }

            $('#backBtn').show();
        }

        if(currentStep === 3){
            $('.step-label').text('Step 3');
            $('h2').text('Requirement Details');
            $('.description').text('Enter the company and contact person\'s details below.');
            $('.card-group').html(`
                <div class="form-section">
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" id="title" name="title" placeholder="Enter requirements title">
                    </div>
                    <div class="form-group">
                        <label>Company Name</label>
                        <input type="text" id="company_name" name="company_name" placeholder="Enter company name">
                    </div>

                    <div class="form-group">
                        <label>Headcount</label>
                        <input type="number" id="headcount" name="headcount" placeholder="Enter headcount">
                    </div>

                    <div class="form-group">
                        <label>Country</label>
                        <select id="country" name="country" style="width:50%">
                            <option value="">Select a country</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Contact Person's Name</label>
                        <input type="text" id="contact_name" name="contact_name" placeholder="Enter contact person's name">
                    </div>

                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="email" name="email" placeholder="Enter email address">
                    </div>
                </div>
            `);

            let options = countryList.map(country => 
                `<option value="${country}">${country}</option>`
            ).join('');

            $('#country').append(options);

            $('.card-group').removeClass('flex');
            $('#backBtn').hide();
            $('#nextBtn').text('Finish');
        }
    }

    $('#nextBtn').click(async function(){
        if(currentStep < 3){
            currentStep++;
            renderStep();
        } else {
            // complete
            var $btn = $(this);
           
            const title = $('#title').val();
            const companyName = $('#company_name').val();
            const headcount = $('#headcount').val();
            const country = $('#country').val();
            const contactName = $('#contact_name').val();
            const email = $('#email').val();

            const client = {
                company: companyName,
                name: contactName,
                country: country,
                headcount: headcount,
                email: email,
            };

            if ($btn.data('...')) return;
            $btn.data('...', true);
            $btn.append('<span class="spinner-btn-clicked"></span>');
            $btn.css('pointer-events', 'none');

            const res = await fetch("/api/supabase?action=insertDraftRequirement", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: uploadedFileName, requirement: {requirements: fileContents, client: client, title: title}})
            });

            const result = await res.json();
            if (result.error){
                resetBtn();
                console.error('Error:', result.error);
                App.swal.fire({
                    title: "Error",
                    text: App.REQUEST_NOT_PROCESSED,
                });
                return;
            }
            
            location.href = `../requirements/draft.html?id=${result.data.id}`;
        }

        function resetBtn(){
            $btn.data('loading', false);
            $btn.find('.spinner-btn-clicked').remove();
            $btn.css('pointer-events', 'auto');
            $btn.data('...', false);
        }
    });

    $('#backBtn').click(function(){
        fileContents = {};
        uploadedFileName = '';
        openWizard();
        // if(currentStep > 1){
        //     currentStep--;
        //     renderStep();
        // }
    });

    $(document).on('click','.card-modal-wizard',function(){
        $('.card-modal-wizard').removeClass('active');
        $(this).addClass('active');
    });

    $('#openWizard').click(function(){
        currentStep = 1;
        renderStep();
        $('#wizardModal').css('display', 'flex').hide().fadeIn();
    });

    $('#closeWizard').click(function(){
        currentStep = 1;
        error = false;
        uploadedFileName = '';
        fileContents = {};
        $('#wizardModal').fadeOut();
    });

    $(document).click(function(e){
        if($(e.target).is('#wizardModal')){
            // currentStep = 1;
            // renderStep();
            $('#wizardModal').fadeOut();
        }
    });

    $(document).on('change', '#excelFile', function () {
        error = false;
        const fileName = this.files[0]?.name || 'No file selected';
        
        $('#fileName').text(fileName);
        if (fileName.includes('.xls')){
            uploadedFileName = fileName;

            const file = this.files[0];
            if (file) {
                const validHeaders = ['area', 'requirement', 'priority', 'system_part'];
                
                let hasError = false;
                const reader = new FileReader();
                reader.onload = async function (e) {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];

                    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                    fileContents = json;
                    let i = 0;
                    
                    validHeaders.forEach(header => {
                        if (json[0][`${header}`] === undefined){
                            hasError = true;
                            errorList['headings'].push(header);
                        }
                        i++;
                    });

                    if (!hasError){
                        updateChecklist('headings', true);
                    }

                    if (!hasError){
                        // const res = await fetch("/api/supabase?action=insertDraftRequirement", {
                        //     method: "POST",
                        //     headers: { "Content-Type": "application/json" },
                        //     body: JSON.stringify({ filename: file.name, requirements: {requirements: json}})
                        // });

                        // const result = await res.json();
                        // if (result.error){
                        //     console.error('Error:', result.error);
                        //     App.swal.fire({
                        //         title: "Error",
                        //         text: App.REQUEST_NOT_PROCESSED,
                        //     });
                        //     return;
                        // }
                        
                        //location.href = `../requirements/draft.html?id=${result.data.id}`; 
                    }
                };

                reader.readAsArrayBuffer(file);
            }

            $('#nextBtn').prop('disabled', false);
            $('#nextBtn').trigger('click');
        }
    });

    function updateChecklist(type, isValid) {
        const item = $(`.checklist-item[data-type="${type}"] .status`);
        
        if(isValid) {
            item.text('✅').css('color', 'green');
        } else {
            item.text('❌').css('color', 'red');
        }
    }

    function fileUploadErrors(errorList){
        console.log('errorList', errorList);
        for (const type in errorList){
            if (errorList[type].length > 0) {
                errorList[type] = [...new Set(errorList[type])];
                $(`#${type}-error`).text(' - [' + errorList[type].join(', ') + ']').css('color', 'red');
            }else{
                updateChecklist(type, true);
            }
        }
    }

    renderStep();

    $(document).on('click', 'a[data-page]', async function (e) {
        const page = $(this).data('page');
        if (page == 'home'){
            await home();
        }

        if (page == 'requirements'){
            $('.header-tab[data-tab="drafts"]').trigger('click');
        }

        if (page == 'configurations'){
            const response = await fetch(`/api/supabase?action=getFormFields`);
            const result = await response.json();

            if (result.error) {
                console.error(result.error);
                App.customError(App.OPERATION_FAILED);
                return;
            }
            
            formFields = result.data;
            
            $('#areaFormFieldList').empty();
            $('#systemPartFormFieldList').empty();
            $('#vendorFeedbackFormFieldList').empty();

            for (var area of result.data.area){
                $('#areaFormFieldList').append(`
                    <div class="item-configurations">
                        <span>${area}</span>
                        <button class="remove-configurations" data-id="formFieldArea" data-field="${area}">×</button>
                    </div>
                `);
            }

            for (var part of result.data.system_parts){
                $('#systemPartFormFieldList').append(`
                    <div class="item-configurations">
                        <span>${part}</span>
                        <button class="remove-configurations" data-id="formFieldSystemPart" data-field="${part}">×</button>
                    </div>
                `);
            }

            for (var feedback of result.data.vendor_feedback){
                $('#vendorFeedbackFormFieldList').append(`
                    <div class="item-configurations">
                        <span>${feedback}</span>
                        <!--<button class="remove-configurations" data-id="formFieldVendorFeedback" data-field="${feedback}">×</button>-->
                    </div>
                `);
            }

            $('.tab[data-tab="all-areas-fields"]').trigger('click');
        }   

        $('.skeleton-grid-form-fields').addClass('hide');
        App.showElement('formFieldsPage');
        $('#formFieldsPage').css('display', 'grid');
    });

    $(document).on('click', 'span[data-tab]', async function (e) {
        const page = $(this).data('tab');
        if (page == 'drafts'){
            $(`#tab-drafts`).append(App.skeletonMainPanel);
            $('#tab-drafts table').addClass('hide');

            const response = await fetch(`/api/supabase?action=getAllDraftRequirement`);
            const result = await response.json();

            if (result.error) {
                console.error(result.error);
                App.customError(App.OPERATION_FAILED);
                return;
            }

            $('#tab-drafts table tbody').empty();
            result.data.forEach(draft => {
                let company = '';
                let name = '';
                let email = '';
                let phone = '';
                let country = '';
                const title = (draft.data.title === undefined) ? draft.filename : draft.data.title;
                
                if (draft.data.client !== undefined){
                    company = draft.data.client.company;
                    name = draft.data.client.name;
                    email = draft.data.client.email;
                    phone = draft.data.client.phone;
                    country = draft.data.client.country;
                }
                
                $('#tab-drafts table tbody').append(`
                    <tr>
                        <td>${company}</td>
                        <td><a href="../requirements/draft.html?id=${draft.id}">${title}</a></td>
                        <td>${name}</td>
                        <td>${email}</td>
                        <td>${phone}</td>
                        <td>${country}</td>
                    </tr>   
                `);
            });

            $('#tab-drafts table').removeClass('hide');
            $('#tab-drafts .skeleton-main').remove();
        }

        if (page == 'completed'){
            $(`#tab-completed`).append(App.skeletonMainPanel);
            $('#tab-completed table').addClass('hide');

            const response = await fetch(`/api/supabase?action=getCompletedRequirements`);
            const result = await response.json();

            if (result.error) {
                console.error(result.error);
                App.customError(App.OPERATION_FAILED);
                return;
            }
            
            $('#tab-completed table tbody').empty();
            result.data.forEach(requirement => {
                const company = requirement.client.company;
                const name = requirement.client.name;
                const email = requirement.client.email;
                const phone = (requirement.client.phone === 'undefined') ? '': requirement.client.phone;
                const country = requirement.client.country;
                const title = requirement.title;
                const createdAt = requirement.created_at;

                const d = new Date(createdAt);
                const formatted =
                    d.getDate().toString().padStart(2, '0') + ' ' +
                    d.toLocaleString('en-GB', { month: 'short' }) + ' ' +
                    d.getFullYear() + ' ' +
                    d.toTimeString().split(' ')[0];

                const reqId = encodeURIComponent(btoa(JSON.stringify(requirement.id)));
                
                $('#tab-completed table tbody').append(`
                    <tr>
                        <td>${formatted}</td>
                        <td>${company}</td>
                        <td><a href="../requirements/details.html?req=${reqId}" target="_blank">${title}</a></td>
                        <td>${name}</td>
                        <td>${email}</td>
                        <td>${phone}%</td>
                        <td>${country}</td>
                    </tr>   
                `);
            });

            $('#tab-completed table').removeClass('hide');
            $('#tab-completed .skeleton-main').remove();
        }
    });

    $(document).on('click', '.tab', function (e) {
        e.preventDefault();
        
        const tab = $(this).data('tab');

        $('.tab').removeClass('active');
        $(this).addClass('active');

        $('.tab-content').removeClass('active');
        $(`.tab-content[data-tab="${tab}"]`).addClass('active');
    });

    $(document).on('click', '.remove-configurations', async function() {
       const field = $(this).data('field');
       const id = $(this).data('id');
      
       if (id == 'formFieldArea'){
            formFields['area'] = formFields['area'].filter(item => item !== field);
            
            const res = await fetch("/api/supabase?action=updateAreaFormFields", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: formFields.id, fields: formFields['area']})
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

       if (id == 'formFieldSystemPart'){
            formFields['system_parts'] = formFields['system_parts'].filter(item => item !== field);

            const res = await fetch("/api/supabase?action=updateSystemPartsFormFields", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: formFields.id, fields: formFields['system_parts']})
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

       if (id == 'formFieldVendorFeedback'){
            formFields['vendor_feedback'] = formFields['vendor_feedback'].filter(item => item !== field);

            const res = await fetch("/api/supabase?action=updateSystemPartsFormFields", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: formFields.id, fields: formFields['vendor_feedback']})
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

        $(this).closest('.item-configurations').remove();
    });

    $(document).on('click', '.menu-item', async function() {
        const target = $(this).data('target');
        $('.menu-item').removeClass('active');
        $('.content-section').removeClass('active');

        $(this).addClass('active');

        $('.content-section[data-target="' + target + '"]').addClass('active');
        $('.tab[data-ref="' + target + '"]').trigger('click');
    });

    $('.add-configurations-btn').on('click', async function() {
        await updateFormValue(this);
    });

    $(document).on('click', '.header-tab', function () {
        const tab = $(this).data('tab');

        $('.header-tab').removeClass('active');
        $(this).addClass('active');

        $('.tab-content').removeClass('active');
        $('#tab-' + tab).addClass('active');
    });

    $(document).on('click', '#createNewRequirement', async function() {
        App.swal.fire({
            title: "How do you want to create the requirements?",
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: "File Upload",
            denyButtonText: `Manual Upload`
        }).then(async (result) => {
            if (result.isConfirmed) {
                //$('#wizardModal').css('display', 'flex').hide().fadeIn();
                openWizard();
                // const { value: file } = await App.swal.fire({
                //     title: "Select file",
                //     input: "file",
                //     inputAttributes: {
                //         "accept": ".xls,.xlsx",
                //         "aria-label": "Upload an .excel file"
                //     }
                //     });
                //     if (file) {
                //         const validHeaders = ['area', 'requirement', 'priority', 'system_part'];
                //         let hasError = false;
                //         const reader = new FileReader();
                //         reader.onload = async function (e) {
                //             const data = new Uint8Array(e.target.result);
                //             const workbook = XLSX.read(data, { type: 'array' });

                //             const sheetName = workbook.SheetNames[0];
                //             const sheet = workbook.Sheets[sheetName];

                //             const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

                //             let i = 0;
                //             console.log(json);
                //             validHeaders.forEach(header => {
                //                if (json[0][`${header}`] === undefined){
                //                 App.customError(`Invalid File Headers. The valid file headers are [${validHeaders}].`);
                //                 hasError = true;
                //                 return;
                //                }
                //                 i++;
                //             });

                //             if (!hasError){
                //                 // const { data, error} = await insertDraftRequirement(
                //                 //     file.name, {
                //                 //     requirements: json
                //                 // });

                //                 // if (error) {
                //                 //     console.error('Select failed:', error);
                //                 //     App.customError(App.OPERATION_FAILED);
                //                 //     return;
                //                 // }

                //                 const res = await fetch("/api/supabase?action=insertDraftRequirement", {
                //                     method: "POST",
                //                     headers: { "Content-Type": "application/json" },
                //                     body: JSON.stringify({ filename: file.name, requirements: {requirements: json}})
                //                 });

                //                 const result = await res.json();
                //                 if (result.error){
                //                     console.error('Error:', result.error);
                //                     App.swal.fire({
                //                         title: "Error",
                //                         text: App.REQUEST_NOT_PROCESSED,
                //                     });
                //                     return;
                //                 }
                                
                //                 location.href = `../requirements/draft.html?d=${btoa(JSON.stringify(json))}&id=${result.data.id}`; 
                //             }
                //         };

                //         reader.readAsArrayBuffer(file);
                //     }
            } else if (result.isDenied) {
                location.href = '../requirements/new.html';
            }
        });
    });

    async function updateFormValue(button) {
        const card = button.closest('.card-configurations');
        const input = card.querySelector('input');
        const list = card.querySelector('.list-configurations');

        const value = input.value.trim();
        if (!value) return;

        const item = document.createElement('div');
        item.className = 'item-configurations';
        item.innerHTML = `
        <span>${value}</span>
            <button class="remove-configurations" data-id="${input.id}" data-field="${value}">×</button>
        `;

        if (input.id == 'formFieldArea'){
            formFields['area'].push(value);
            
            const res = await fetch("/api/supabase?action=updateAreaFormFields", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: formFields.id, fields: formFields['area']})
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
        
        if (input.id == 'formFieldSystemPart'){
            formFields['system_parts'].push(value);

            const res = await fetch("/api/supabase?action=updateSystemPartsFormFields", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: formFields.id, fields: formFields['system_parts']})
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

        if (input.id == 'formFieldVendorFeedback'){
            formFields['vendor_feedback'].push(value);

            const res = await fetch("/api/supabase?action=updateSystemPartsFormFields", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: formFields.id, fields: formFields['vendor_feedback']})
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

        list.appendChild(item);
        input.value = '';
        input.focus();
    }

    // addRequirementsWizard();

    // function addRequirementsWizard(){
        
    // }
});

async function updateDraftRequirementsCount(){
    const response = await fetch(`/api/supabase?action=getAllDraftRequirement`);
    const result = await response.json();

    if (result.error) {
        console.error(result.error);
        App.customError(App.OPERATION_FAILED);
        return;
    }

    $('#tot_draft_req').text(result.data.length);
}

async function updateVendorsCount(){
    const response = await fetch(`/api/supabase?action=getVendors`);
    const result = await response.json();

    if (result.error) {
        console.error(result.error);
        App.customError(App.OPERATION_FAILED);
        return;
    }

    $('#tot_vendors').text(result.data.length);
}

async function updateCompletedRequirements(){
    const response = await fetch(`/api/supabase?action=getCompletedRequirements`);
    const result = await response.json();

    if (result.error) {
        console.error(result.error);
        App.customError(App.OPERATION_FAILED);
        return;
    }

    $('#tot_completed_req').text(result.data.length);
}

async function home(){
    let mustHaveResponses = {};
    let couldHaveResponses = {};
    let shouldHaveResponses = {};

    const response = await fetch('/api/supabase?action=getActiveRequirements');
    const result = await response.json();

    if (result.error) {
        console.error(result.error);
        App.customError(App.OPERATION_FAILED);
        return;
    }
    
    $('#tot_active_req').text(result.data.length);

    $(`.sidebar`).empty();
    $(`.content`).empty();

    $('.sidebar').append(`
        <h4 class="sidebar-header">
            ACTIVE REQUIREMENTS
        </h4>
        <div class="menu-item active" data-target="main-summary">What's Happening</div>`
    );
    
    $('.content').append(`
        <div data-target="main-summary" class="content-section active">
    <h3>What's Happening</h3>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">

        <!-- Vendor response completion -->
        <div style="background:#f8f7f5;border:1px solid #e2e0db;border-radius:10px;padding:16px 18px;">
        <p style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8a8880;margin:0 0 10px;">Vendor response completion</p>

        <div id="vendor-completion-list">
            <!-- JS populates rows here -->
        </div>
        </div>

        <!-- Needs attention -->
        <div style="background:#f8f7f5;border:1px solid #e2e0db;border-radius:10px;padding:16px 18px;">
        <p style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8a8880;margin:0 0 10px;">Needs attention</p>

        <div id="attention-list">
            <!-- JS populates rows here -->
        </div>
        </div>

    </div>

    <!-- Pipeline status -->
    <div style="background:#f8f7f5;border:1px solid #e2e0db;border-radius:10px;padding:16px 18px;">
        <p style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8a8880;margin:0 0 12px;">Pipeline status</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <div style="background:#fff;border:1px solid #e2e0db;border-radius:8px;padding:12px 16px;flex:1;min-width:90px;text-align:center;">
            <div id="stat-active" style="font-size:22px;font-weight:600;color:#111827;">0</div>
            <div style="font-size:11.5px;color:#8a8880;margin-top:3px;">client review</div>
        </div>
        <div style="background:#fff;border:1px solid #e2e0db;border-radius:8px;padding:12px 16px;flex:1;min-width:90px;text-align:center;">
            <div id="stat-awaiting" style="font-size:22px;font-weight:600;color:#111827;">0</div>
            <div style="font-size:11.5px;color:#8a8880;margin-top:3px;">awaiting client</div>
        </div>
        <div style="background:#fff;border:1px solid #e2e0db;border-radius:8px;padding:12px 16px;flex:1;min-width:90px;text-align:center;">
            <div id="stat-scoring" style="font-size:22px;font-weight:600;color:#111827;">0</div>
            <div style="font-size:11.5px;color:#8a8880;margin-top:3px;">ready to score</div>
        </div>
        <div style="background:#fff;border:1px solid #e2e0db;border-radius:8px;padding:12px 16px;flex:1;min-width:90px;text-align:center;">
            <div id="stat-completed" style="font-size:22px;font-weight:600;color:#111827;">0</div>
            <div style="font-size:11.5px;color:#8a8880;margin-top:3px;">completed</div>
        </div>
        <div style="background:#FAEEDA;border:1px solid #FAC775;border-radius:8px;padding:12px 16px;flex:1;min-width:90px;text-align:center;">
            <div id="stat-attention" style="font-size:22px;font-weight:600;color:#633806;">0</div>
            <div style="font-size:11.5px;color:#854F0B;margin-top:3px;">needs attention</div>
        </div>
        </div>
    </div>

    </div>
    `);

    result.data.forEach(function(key, value){
        const d = new Date(key.created_at);
        const formatted =
            d.getDate().toString().padStart(2, '0') + ' ' +
            d.toLocaleString('en-GB', { month: 'short' }) + ' ' +
            d.getFullYear() + ' ' +
            d.toTimeString().split(' ')[0];
        
        const reqId = encodeURIComponent(btoa(JSON.stringify(key.id)));
        $(`.sidebar`).append(`<div class="menu-item" data-target="${key.id}_summary">${key.title}</div>`);
        $(`.content`).append(`
            <!-- DOCUMENTS -->
            <div id="${key.id}_summary_content" class="content-section" data-target="${key.id}_summary">
                <div class="tabs" id="${key.id}_summary_tabs">
                    <button class="tab active" data-tab="${key.id}_all" data-ref="${key.id}_summary">All Areas</button>
                </div>
                <div class="tab-content active" data-tab="${key.id}_all">
                    <table id="${key.id}_summary-table">
                        <thead>
                            <tr style="background:green">
                                <th>Area</th>
                                <th>Could-Have</th>
                                <th>Must-Have</th>
                                <th>Should-Have</th>
                                <th>Grand Total</th>
                            </tr>
                        </thead>
                        <tbody>
                        </tbody>
                    </table>
                </div>
                <div class="tab-content" data-tab="${key.id}_Must-Have-Gaps">
                    <div class="table-wrapper">
                    <a href="#" onclick="exportExcel('Gaps-table_${key.id}', '${key.title}_vendor_responses')" class="exportExcel" data-id="${key.id}_Match_Score-table"><span>export to excel</span> <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor" width="14" data-norma="icon" class="sc-65b8e41b-7 dexKYZ"><path fill-rule="evenodd" clip-rule="evenodd" d="M17.66 17a.75.75 0 0 1-.75-.76V8.15L6.87 18.2a.75.75 0 1 1-1.06-1.06L15.85 7.09h-8.1a.75.75 0 0 1 0-1.5h9.9a.75.75 0 0 1 .76.75v9.9c0 .42-.34.75-.75.75Z"></path></svg></a>
                        <table id="Gaps-table_${key.id}" style="margin-top:10px">
                            <thead></thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
                <div class="tab-content" data-tab="${key.id}_Match_Scores">
                    <div class="table-wrapper">
                        <!--<div style="margin:0px 0px 10px">
                            <a href="${App.pages.presentation}/?req=${key.id}" id="${key.id}_View_Dashboard" target="_blank"><span>view in dashboard</span> <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor" width="14" data-norma="icon" class="sc-65b8e41b-7 dexKYZ"><path fill-rule="evenodd" clip-rule="evenodd" d="M17.66 17a.75.75 0 0 1-.75-.76V8.15L6.87 18.2a.75.75 0 1 1-1.06-1.06L15.85 7.09h-8.1a.75.75 0 0 1 0-1.5h9.9a.75.75 0 0 1 .76.75v9.9c0 .42-.34.75-.75.75Z"></path></svg></a>
                        </div>-->
                        <a href="#" onclick="exportExcel('Match_Score-table_${key.id}', '${key.title}_vendor_match_scores')" class="exportExcel" data-id="${key.id}_Match_Score-table"><span>export to excel</span> <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor" width="14" data-norma="icon" class="sc-65b8e41b-7 dexKYZ"><path fill-rule="evenodd" clip-rule="evenodd" d="M17.66 17a.75.75 0 0 1-.75-.76V8.15L6.87 18.2a.75.75 0 1 1-1.06-1.06L15.85 7.09h-8.1a.75.75 0 0 1 0-1.5h9.9a.75.75 0 0 1 .76.75v9.9c0 .42-.34.75-.75.75Z"></path></svg></a>
                        <table id="Match_Score-table_${key.id}" style="margin-top:10px">
                            <thead></thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `);
        
        summaries(key.id, `${key.id}_summary`);
        if (key.assigned_vendors !== null && key.assigned_vendors !== undefined){
            mustHaveResponses = vendorResponsesByPriority(key.assigned_vendors, key.requirements, App.MUST_HAVE);
            couldHaveResponses = vendorResponsesByPriority(key.assigned_vendors, key.requirements, App.COULD_HAVE);
            shouldHaveResponses = vendorResponsesByPriority(key.assigned_vendors, key.requirements, App.SHOULD_HAVE);
            
            let headerRow = `<tr><th rowspan="2" class="sticky-col">Vendor Responses</th>`;
            let subHeaderRow = `<tr>`;

            key.assigned_vendors.forEach(vendor => {
                headerRow += `
                    <th colspan="3" style="text-align:center">
                        ${vendor.name}
                    </th>
                `;

                subHeaderRow += `
                    <th>${App.COULD_HAVE}</th>
                    <th>${App.MUST_HAVE}</th>
                    <th>${App.SHOULD_HAVE}</th>
                `;
            });

            headerRow += `</tr>`;
            subHeaderRow += `</tr>`;

            $(`#Gaps-table_${key.id} thead`).append(headerRow + subHeaderRow);
        }

        generateTabs(key.id, key.assigned_vendors, mustHaveResponses, couldHaveResponses, shouldHaveResponses, key.requirements);
    });

    renderMainSummary(result.data);

    $('.skeleton-container').addClass('hide');
    App.showElement('mainPage');
    $('#mainPage').css('display', 'block');
}

async function generateTabs(reqId, vendors, mustHaveResponses, couldHaveResponses, shouldHaveResponses, requirements){
    const response = await fetch(`/api/supabase?action=getFormFields`);
    const result = await response.json();

    if (result.error) {
        console.error(result.error);
        App.customError(App.OPERATION_FAILED);
        return;
    }
    
    // add tabs
    for (var part of result.data.system_parts){
        $(`#${reqId}_summary_tabs`).append(`<button class="tab" data-tab="${reqId}_${part}">${part}</button>`);
    }

    if (vendors !== null){
        $(`#${reqId}_summary_tabs`).append(`<button class="tab" data-tab="${reqId}_Must-Have-Gaps">Response Count</button>`);
        const $tbody = $(`#Gaps-table_${reqId} tbody`);
        
        for (var feedback of result.data.vendor_feedback){
            const $row = $('<tr></tr>');
            $row.append(`<td class="sticky-col">${feedback}</td>`);
            vendors.forEach(vendor => {
                const mustHave = (mustHaveResponses[vendor.name] === undefined || mustHaveResponses[vendor.name][feedback] === undefined) ? 0 : mustHaveResponses[vendor.name][feedback];
                const couldHave = (couldHaveResponses[vendor.name] === undefined || couldHaveResponses[vendor.name][feedback] === undefined) ? 0 : couldHaveResponses[vendor.name][feedback];
                const shouldHave = (shouldHaveResponses[vendor.name] === undefined || shouldHaveResponses[vendor.name][feedback] === undefined) ? 0 : shouldHaveResponses[vendor.name][feedback];
               
                $row.append(`<td style="text-align:center"><strong>${couldHave}</strong></td>`);
                $row.append(`<td style="text-align:center"><strong>${mustHave}</strong></td>`);
                $row.append(`<td style="text-align:center"><strong>${shouldHave}</strong></td>`);
            });

            $tbody.append($row);
        }

        generateMatchScoreTable(reqId, vendors, result.data, requirements);
    }

    // Object.entries(mustHaveResponses).forEach(([key, value]) => {
    //     console.log(key, value);
    // });

    // add content for each tab
    let i = 1;
    for (var part of result.data.system_parts){
        const id = `${reqId}_summary-table-${i}`;
        $(`#${reqId}_summary_content`).append(`
        <div class="tab-content" data-tab="${reqId}_${part}">
            <table id="${id}">
                <thead>
                    <tr style="background:green">
                        <th>Area</th>
                        <th>Could-Have</th>
                        <th>Must-Have</th>
                        <th>Should-Have</th>
                        <th>Grand Total</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        </div>`);

        summaryTabContent(reqId, id, part);
        i++;
    }
}

function renderMainSummary(requirements) {
  const $completion = $('#vendor-completion-list').empty();
  const $attention  = $('#attention-list').empty();

  let statActive = 0, statAwaiting = 0, statScoring = 0, statCompleted = 0, statAttention = 0;

  requirements.forEach(req => {
    const vendors     = req.assigned_vendors ?? [];
    const total       = vendors.length;
    const responded   = vendors.filter(v => v.feedback && v.feedback.length).length;
    const allIn       = total > 0 && responded === total;
    const noneIn      = total > 0 && responded === 0;
    const isApproved  = req.approved === 'Y';
    const pct         = total > 0 ? Math.round((responded / total) * 100) : 0;

    // Pipeline counts
    if (isApproved)        statCompleted++;
    else if (allIn)        statScoring++;
    else if (req.status === 'awaiting_client') statAwaiting++;
    else                   statActive++;

    // Completion row
    $completion.append(`
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0ede8;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:500;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${req.title}</div>
          <div style="font-size:11.5px;color:#8a8880;margin-top:2px;">${vendors.map(v => v.name).join(', ') || '—'}</div>
        </div>
        <div style="width:80px;flex-shrink:0;">
          <div style="height:4px;border-radius:2px;background:#e2e0db;">
            <div style="height:100%;width:${pct}%;border-radius:2px;background:#111827;"></div>
          </div>
        </div>
        <div style="font-size:12px;color:#8a8880;min-width:36px;text-align:right;">${responded} / ${total}</div>
      </div>
    `);

    // Attention items
    if (noneIn && !isApproved) {
      statAttention++;
      $attention.append(attentionRow('red', `${req.title} — no vendors have responded`, `${total} vendor${total > 1 ? 's' : ''} assigned`));
    } else if (allIn && !isApproved) {
      $attention.append(attentionRow('blue', `${req.title} — ready to score`, 'All responses in'));
    } else if (!allIn && !noneIn && !isApproved) {
      statAttention++;
      $attention.append(attentionRow('amber', `${req.title} — ${total - responded} vendor${(total - responded) > 1 ? 's' : ''} pending`, `${responded} of ${total} responded`));
    }
  });

  if ($attention.children().length === 0) {
    $attention.append(`<div style="font-size:13px;color:#8a8880;padding:12px 0;">All requirements are on track.</div>`);
  }

  $('#stat-active').text(statActive);
  $('#stat-awaiting').text(statAwaiting);
  $('#stat-scoring').text(statScoring);
  $('#stat-completed').text(statCompleted);
  $('#stat-attention').text(statAttention);
}

function attentionRow(color, text, meta) {
  const dots  = { red: '#E24B4A', amber: '#BA7517', blue: '#378ADD' };
  const dot   = dots[color] ?? '#888';
  return `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f0ede8;">
      <div style="width:6px;height:6px;border-radius:50%;background:${dot};margin-top:5px;flex-shrink:0;"></div>
      <div>
        <div style="font-size:13px;color:#111827;line-height:1.45;">${text}</div>
        <div style="font-size:11.5px;color:#8a8880;margin-top:2px;">${meta}</div>
      </div>
    </div>
  `;
}

function generateMatchScoreTable(reqId, vendors, data, requirements){
    let allSystemParts = [];
    allSystemParts.push(App.ALL_IN_ONE);
    for (var part of data.system_parts){
        allSystemParts.push(part);
    }

    $(`#${reqId}_summary_tabs`).append(`<button class="tab" data-tab="${reqId}_Match_Scores">Match Scores</button>`);
    const $thead = $(`#Match_Score-table_${reqId} thead`);
    const $matchScorerow = $('<tr></tr>');
    $matchScorerow.append(`<th class="sticky-col">Area</th>`);
    vendors.forEach(vendor => {
         $matchScorerow.append(`<th>${vendor.name}</th>`);
    });

    $thead.append($matchScorerow);

    const $tbody = $(`#Match_Score-table_${reqId} tbody`);
    
    for (var part of allSystemParts){
        const $row = $('<tr></tr>');
        $row.append(`<td class="sticky-col">${part}</td>`);

        vendors.forEach(vendor => {
            if (vendor.feedback !== null){
                let score = 0;
                
                const solutionMultiplier = App.getSolutionMultipliers(vendor.feedback, data.vendor_feedback, App.solutionMultiplier);
                $.each(requirements, function(index, value) {
                    if (part == App.ALL_IN_ONE){
                        score += App.priorityWeighting[value.priority] * solutionMultiplier[index];
                    }else{
                        if (part == value.system_part){
                            score += App.priorityWeighting[value.priority] * solutionMultiplier[index];
                        }
                    }
                });

                let percentage = (score / (requirements.length * 1.5)) * 100;
                if (Number.isNaN(percentage)) percentage = 0;
                
                percentage = parseInt(percentage);
                $row.append(`<td>${percentage}%</td>`);
            }
        });

        $tbody.append($row);
    }
}

function vendorFeedbackGrouped(vendors){
    let groupedFeedback = {};
    vendors.forEach(vendor => {
        const vendorFeedback = App.getVendorFeedback(vendors, vendor.id);
        Object.entries(vendorFeedback).forEach(([key, value]) => {
            if (groupedFeedback[vendor.id] === null || groupedFeedback[vendor.id] === undefined){
                groupedFeedback[vendor.id] = [];
            }

            if (!groupedFeedback[vendor.id].includes(value.feedback)) groupedFeedback[vendor.id].push(value.feedback);
        });
    });
   
    return groupedFeedback;
}

function vendorResponsesByPriority(vendors, requirements, type){
    let responses = {};

    vendors.forEach(vendor => {
        const vendorFeedback = App.getVendorFeedback(vendors, vendor.id);
        Object.entries(vendorFeedback).forEach(([index, value]) => {
            const priority = requirements[index].priority;
            const feedback = value.feedback;

            if (responses[vendor.name] === null || responses[vendor.name] === undefined){
                responses[vendor.name] = {};
            }

            if (responses[vendor.name][feedback] === null || responses[vendor.name][feedback] === undefined){
                responses[vendor.name][feedback] = 0;
            }

            if (priority == type){
                responses[vendor.name][feedback]++;
            }
        });
    });
    
    return responses;
}

function summaryAreaByPriority(requirements){
    let summary = {};

    let i = 0;
    requirements.forEach(function(key, value){
        if (summary[key.area] === null || summary[key.area] === undefined){
            summary[key.area] = {};
        }

        if (summary[key.area][key.priority] === null || summary[key.area][key.priority] === undefined){
            summary[key.area][key.priority] = 0;
        }

        summary[key.area][key.priority]++;

        i++;
    });

    const sortedList = Object.fromEntries(
        Object.entries(summary).sort(([a], [b]) => a.localeCompare(b))
    );

    return sortedList;
}

async function summaries(reqId, tableId){
    const vendorsFeedback = {};
    let grandTotalMustHave = 0;
    let grandTotalCouldHave = 0;
    let grandTotalShouldHave = 0;
    const mustHaveMultiplier = 1.5;
    const couldHaveMultiplier = 1;
    const shouldHaveMultiplier = 1.25;
    
    const response = await fetch(`/api/supabase?action=getRequirementsById&reqId=${reqId}`);
    const result = await response.json();

    if (result.error) {
        console.error(result.error);
        App.customError(App.OPERATION_FAILED);
        return;
    }

    const sortedList = summaryAreaByPriority(result.data.requirements);
    Object.entries(sortedList).forEach(([key, value]) => {
        const couldHave = (sortedList[key]['Could-Have'] === undefined) ? '' : sortedList[key]['Could-Have'];
        const mustHave = (sortedList[key]['Must-Have'] === undefined) ? '' : sortedList[key]['Must-Have'];
        const shouldHave = (sortedList[key]['Should-Have'] === undefined) ? '' : sortedList[key]['Should-Have'];
        
        const c = (couldHave != '') ? couldHave : 0;
        const m = (mustHave != '') ? mustHave : 0;
        const s = (shouldHave != '') ? shouldHave : 0;
        const total = c + m + s;

        grandTotalMustHave += m;
        grandTotalCouldHave += c;
        grandTotalShouldHave += s;

        $(`#${tableId}-table tbody`).append(`
            <tr>
                <td>${key}</td>
                <td style="text-align:center">${couldHave}</td>
                <td style="text-align:center">${mustHave}</td>
                <td style="text-align:center">${shouldHave}</td>
                <td style="text-align:center;background:lightgray">${total}</td>
            </tr>
        `);
    });

    $(`#${tableId}-table tbody`).append(`
        <tr style="background:#eee;font-weight:bold">
            <td>Grand Total</td>
            <td style="text-align:center">${grandTotalCouldHave}</td>
            <td style="text-align:center">${grandTotalMustHave}</td>
            <td style="text-align:center">${grandTotalShouldHave}</td>
            <td style="text-align:center;background:lightgray">${grandTotalCouldHave + grandTotalMustHave + grandTotalShouldHave}</td>
        </tr>
    `);

    const couldHaveMaxPoints = grandTotalCouldHave * couldHaveMultiplier;
    const mustHaveMaxPoints = grandTotalMustHave * mustHaveMultiplier;
    const shouldHaveMaxPoints = grandTotalShouldHave * shouldHaveMultiplier;
    const totalMaxPoints = couldHaveMaxPoints + mustHaveMaxPoints + shouldHaveMaxPoints;

    $(`#${tableId}-table tbody`).append(`
        <tr><td colspan="5"></td></tr>
        <tr style="background:#fff2cc;font-weight:bold">
            <td>MAX Points - All</td>
            <td style="text-align:center"><span title="${grandTotalCouldHave} x ${couldHaveMultiplier}">${couldHaveMaxPoints}<span></td>
            <td style="text-align:center"><span title="${grandTotalMustHave} x ${mustHaveMultiplier}">${mustHaveMaxPoints.toFixed(2)}</span></td>
            <td style="text-align:center"><span title="${grandTotalShouldHave} x ${shouldHaveMultiplier}">${shouldHaveMaxPoints.toFixed(2)}</span></td>
            <td style="text-align:center;">${totalMaxPoints}</td>
        </tr>
    `);
}

async function summaryTabContent(reqId, tableId, systemPart){
    const summary = {};
    const vendorsFeedback = {};
    let grandTotalMustHave = 0;
    let grandTotalCouldHave = 0;
    let grandTotalShouldHave = 0;
    const mustHaveMultiplier = 1.5;
    const couldHaveMultiplier = 1;
    const shouldHaveMultiplier = 1.25;

    const response = await fetch(`/api/supabase?action=getRequirementsById&reqId=${reqId}`);
    const result = await response.json();

    if (result.error) {
        console.error(result.error);
        App.customError(App.OPERATION_FAILED);
        return;
    }

    result.data.requirements.forEach(function(key, value){
        if (key.system_part == systemPart){
            if (summary[key.area] === null || summary[key.area] === undefined){
                summary[key.area] = {};
            }

            if (summary[key.area][key.priority] === null || summary[key.area][key.priority] === undefined){
                summary[key.area][key.priority] = 0;
            }

            summary[key.area][key.priority]++;
        }
    });

    const sortedList = Object.fromEntries(
        Object.entries(summary).sort(([a], [b]) => a.localeCompare(b))
    );

    Object.entries(sortedList).forEach(([key, value]) => {
        const couldHave = (sortedList[key]['Could-Have'] === undefined) ? '' : sortedList[key]['Could-Have'];
        const mustHave = (sortedList[key]['Must-Have'] === undefined) ? '' : sortedList[key]['Must-Have'];
        const shouldHave = (sortedList[key]['Should-Have'] === undefined) ? '' : sortedList[key]['Should-Have'];
        
        const c = (couldHave != '') ? couldHave : 0;
        const m = (mustHave != '') ? mustHave : 0;
        const s = (shouldHave != '') ? shouldHave : 0;
        const total = c + m + s;

        grandTotalMustHave += m;
        grandTotalCouldHave += c;
        grandTotalShouldHave += s;

        $(`#${tableId} tbody`).append(`
            <tr>
                <td>${key}</td>
                <td style="text-align:center">${couldHave}</td>
                <td style="text-align:center">${mustHave}</td>
                <td style="text-align:center">${shouldHave}</td>
                <td style="text-align:center;background:lightgray">${total}</td>
            </tr>
        `);
    });

    $(`#${tableId} tbody`).append(`
        <tr style="background:#eee;font-weight:bold">
            <td>Grand Total</td>
            <td style="text-align:center">${grandTotalCouldHave}</td>
            <td style="text-align:center">${grandTotalMustHave}</td>
            <td style="text-align:center">${grandTotalShouldHave}</td>
            <td style="text-align:center;background:lightgray">${grandTotalCouldHave + grandTotalMustHave + grandTotalShouldHave}</td>
        </tr>
    `);

    const couldHaveMaxPoints = grandTotalCouldHave * couldHaveMultiplier;
    const mustHaveMaxPoints = grandTotalMustHave * mustHaveMultiplier;
    const shouldHaveMaxPoints = grandTotalShouldHave * shouldHaveMultiplier;
    const totalMaxPoints = couldHaveMaxPoints + mustHaveMaxPoints + shouldHaveMaxPoints;

    $(`#${tableId} tbody`).append(`
        <tr><td colspan="5"></td></tr>
        <tr style="background:#fff2cc;font-weight:bold">
            <td>MAX Points - All</td>
            <td style="text-align:center"><span title="${grandTotalCouldHave} x ${couldHaveMultiplier}">${couldHaveMaxPoints}<span></td>
            <td style="text-align:center"><span title="${grandTotalMustHave} x ${mustHaveMultiplier}">${mustHaveMaxPoints.toFixed(2)}</span></td>
            <td style="text-align:center"><span title="${grandTotalShouldHave} x ${shouldHaveMultiplier}">${shouldHaveMaxPoints.toFixed(2)}</span></td>
            <td style="text-align:center;">${totalMaxPoints}</td>
        </tr>
    `);
}