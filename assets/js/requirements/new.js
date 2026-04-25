import * as App from "../app.js";
import { getFormFields, insertDraftRequirement } from "../services/supabase.js";

let configurationFields;

let requirementInfo = {
    client:{},
    requirements: []
};

$(function(){
    if (!App.loggedIn()){
        location.href = App.pages.login;
        return;
    }

    App.hasInternet(location.href);

    $('#markAsDoneBtn').prop('disabled', true);

    getConfigurationFields();

    $('.skeleton-container').addClass('hide');
    App.showElement('mainPage');
    $('#mainPage').css('display', 'block');

    $(document).on('click', '#addRowBtn', function () {
        addRow();
    });

    $('#markAsDoneBtn').on('click', async function() {
        const {data, error} = await insertDraftRequirement('', requirementInfo);
        if (error){
            App.customError(App.OPERATION_FAILED);
            return;
        }

        App.swal.fire("Saved!", "", "success")
        .then((result) => {
            location.href = `${App.pages.draft}?id=${data.id}`;
        });
    });

    $('#country').on('change', async function() {
        updateData();
        // await autoSaved();
    });

    $(document).on('change', '.requirement-select', async function() {
        const field = $(this).data('field');
        const pos = $(this).data('pos');
        const val = $(this).val();

        //if (requirementInfo.requirements[pos] === undefined) requirementInfo.requirements.push({});
        requirementInfo.requirements[pos][field] = val;
        
        updateData();
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
        console.log(requirementInfo);
    });

    $(document).on('click', '.remove-requirement', function () {
        removeRow(this);
    }); 

    $(document).on('click', '.editable-dropdown', function () {
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
});

async function getConfigurationFields(){
    const {data, error} = await getFormFields();
    if (error) {
        App.customError(App.OPERATION_FAILED);
        console.error('Fetching requirement data failed (generateTabs):', error);
        return;
    }
    
    configurationFields = data;
}

async function removeRow(button) {
    const pos = $(button).data('pos');
   
    requirementInfo.requirements.splice(pos, 1);
    button.closest('tr').remove();

    reloadRequirement(requirementInfo.requirements);
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

    if ((requirementInfo['client']['company'] === undefined || requirementInfo['client']['company'] == '' || requirementInfo['client']['company'] == 'Company Name *')
        || (requirementInfo['title'] === undefined || requirementInfo['title'] == '' || requirementInfo['title'] == 'Title *')
        || (requirementInfo['client']['email'] === undefined || requirementInfo['client']['email'] == '' || requirementInfo['client']['email'] === '__')
        || (requirementInfo['client']['name'] === undefined || requirementInfo['client']['name'] == '' || requirementInfo['client']['name'] === '__')
        || (requirementInfo.requirements.length == 0)){
        
        $('#markAsDoneBtn').prop('disabled', true);
    }else{
        $('#markAsDoneBtn').prop('disabled', false);
    }
}

function addRow() {
    requirementInfo.requirements.push({
        area: '',
        requirement: '',
        priority: '',
        system_part: ''
    });

    reloadRequirement(requirementInfo.requirements);
}

function reloadRequirement(requirements){
    $('#requirementsTable tbody').empty();

    let i = 0;
    requirements.forEach(req => {
        $('#requirementsTable tbody').append(`
            <tr>
                <td class="editable-dropdown" data-pos="${i}" data-field="area" data-value="${req.area}">${req.area}</td>
                <td contenteditable="true" class="requirement-field" data-pos="${i}">${req.requirement}</td>
                <td class="editable-dropdown" data-pos="${i}" data-field="priority" data-value="${req.priority}" contenteditable="true">${req.priority}</td>
                <td class="editable-dropdown" data-pos="${i}" data-field="system_part">${req.system_part}</td>
                <td>
                    <button type="button" class="remove-requirement" data-pos="${i}" title="remove" style="color:red;cursor:pointer;border:1px solid var(--border-color);background:white;border:none">remove</button>
                </td> 
            </tr>   
        `);
        i++;
    });

    if (requirements.length == 0){
        $('#markAsDoneBtn').prop('disabled', true);
    }else{
        $('#markAsDoneBtn').prop('disabled', false);
    }
}