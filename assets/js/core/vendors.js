import * as App from "../app.js";
import { addVendor, getVendors, getVendorByName, getFormFields } from "../services/supabase.js";

$(function () {
    loadTable();

    $('#add-btn-vendor').click(async function() {
        $('#vendorPanel').addClass('active');
    });

    $('#closeVendorPanel').click(function() {
        $('#vendorPanel').removeClass('active');
    });

    $('#addVendorBtn').click(async function() {
        await saveNewVendor();
    });

    // $('#addRow').click(function() {
        
    // });

    async function loadTable(){
        await loadVendors();

        var t = $('#vendors-table').DataTable({
            responsive: {
                details: {
                type: 'column'
                }
            },
            pageLength: 10,
            columnDefs: [{
                className: 'dt-control',
                orderable: false,
                targets: 0
            }],
            order: [1, 'asc']
        });
    }

    $('.multi-select__control').on('click', function () {
      $(this).closest('.multi-select').toggleClass('open');
    });

    $(document).on('change', '.multi-select input[type="checkbox"]', function () {
      const $multi = $(this).closest('.multi-select');
      const values = [];

      $multi.find('input:checked').each(function () {
        values.push($(this).parent().text().trim());
      });

      $multi.find('.multi-select__placeholder').text(
        values.length ? values.join(', ') : 'Select system options *'
      );
    });

    $(document).on('click', function (e) {
      if (!$(e.target).closest('.multi-select').length) {
        $('.multi-select').removeClass('open');
      }
    });

    getSystemPartList();
});

async function loadVendors(){
    $('#vendors-table tbody').empty();
    const tbody = $('#vendors-table tbody');

    const { data, error } = await getVendors();

    if (error) {
        console.error('Select failed:', error);
        App.customError(App.OPERATION_FAILED);
        return;
    }

    if (data !== null){
        data.forEach(function(key, value){
            const description = key.description ?? '';
            const hqLocation = key.hq_location ?? '';

            const contactPerson = key.contact_person;
            const contactName = contactPerson?.name ?? '';
            const email = contactPerson?.email ?? '';
            const phone = contactPerson?.phone ?? '';
            const verified = (key.verified) ? 'Yes' : 'No';

            tbody.append(`
                <tr data-id="${key.id}">
                        <td><button class="add-btn-white" title="edit vendor">+</button></td>
                        <td>${key.name}</td>
                        <td>${description}</td>
                        <td>${hqLocation}</td>
                        <td>${contactName}</td>
                        <td>${email}</td>
                        <td>${phone}</td>
                        <td>${verified}</td>
                </tr>
            `);
        });
    }
}

function addRowToVendorsTable(){
    var table = new DataTable('#vendors-table');
    var rowNode = table.row
        .add([
            '<button class="add-btn-white" title="edit vendor">+</button>',
            companyName,
            description,
            hq_location,
            contact_person,
            email_address,
            phone_number,
            'No'
        ])
        .draw()
        .node();

        $(rowNode)
            .css('color', 'red')
            .animate({ color: 'black' });
    
}

async function saveNewVendor(){
    const companyName = $('#company_name').val();
    const description = $('#description').val();
    const hq_location = $('#hq_location').val();
    const contact_person = $('#contact_person').val();
    const email_address = $('#email_address').val();
    const phone_number = $('#phone_number').val();
    const systemParts = [];

    $('.multi-select__dropdown')
        .find('input[type="checkbox"]:checked')
        .each(function () {
        systemParts.push($(this).val());
    });

    if (!companyName || !contact_person || !email_address || systemParts.length == 0){
        App.customError('Fields marked with * are required fields.');
        return;
    }

    $("#addVendorBtn").prop("disabled", true);
    App.showElement('addVendorSpinner');

    const payload = {
        name: companyName, 
        description: description, 
        hq_location: hq_location, 
        contact_person: {
            name: contact_person,
            email: email_address,
            phone: phone_number
        },
        system_parts: systemParts
    };
    
    getVendorByName(payload['name'])
        .then(async data => {
            if (data.data !== null && data.data.length){
                App.customError('A vendor with that name already exists.');
                return;
            }

            const { idata, error } = await addVendor(payload);
            if (error) {
                console.error('Adding failed:', error);
                App.customError(App.OPERATION_FAILED);
                return;
            }

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
                title: "Saved successfully"
            });

            $('#vendorPanel').removeClass('active');
            $("#addVendorBtn").prop("disabled", false);
            App.hideElement('addVendorSpinner');
            $('.form-fields input').val('');
            $('.form-fields textarea').text('');

            $(`#vendors`).append(App.skeletonMainPanel);
            $('#vendors-table').addClass('hide');
            await loadVendors();
            $('#vendors-table').removeClass('hide');
            $('#vendors .skeleton-main').remove();
        })
        .catch(err => {
            console.log(err);
            return { data: null, err };
        });
}

async function getSystemPartList(){
    const {data, error} = await getFormFields();
    if (error) {
        console.error('Adding failed:', error);
        App.customError(App.OPERATION_FAILED);
        return;
    }

    for (var part of data.system_parts){
        $('.multi-select__dropdown').append(`<label><input type="checkbox" value="${part}"> ${part}</label>`);
    }
}