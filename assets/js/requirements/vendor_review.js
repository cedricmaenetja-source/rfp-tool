import { getRequirementsById, updateVendorList } from "../services/supabase.js";
import * as App from "../app.js";

let requirementsData = null;

$(function(){
    const requirementId = App.getParam('req');
    const vendorId = App.getParam('vid') ?? null;
    const decodedRequirementId = requirementId ? decodeURIComponent(JSON.parse(atob(requirementId))) : null;
    
    if (decodedRequirementId === null || vendorId === null){
        location.href = App.pages.proposal_submitted;
    }else{
        getRequirementsData(decodedRequirementId)
            .then(data => {
                requirementsData = data;
                validateVendor(vendorId);
                checkSubmission(vendorId);
                loadData();
            })
            .catch(err => {
                console.error('Promise failed:', err);
                App.customError(App.OPERATION_FAILED);
                $('#loader').hide();
            });

        // loadData(decodedRequirementId);
    }

    $('#saveDecisions').on('click', async function () {
        let isError = false;
        let feedback = [];

        await $('.form-field').each(async function() {
            const type = $(this).data('type');
            const pos = $(this).data('pos');
            const value = $(this).val();

            var comment = $('textarea[data-type="comment"][data-pos="' + pos + '"]').val();
            
            if (type == 'feedback' && value == ''){
                App.customError(`You must provide feedback to requirement number ${pos + 1}.`);
                isError = true;
                return;
            }

            if (type == 'feedback' && (value == 'Meets the requirement with workarounds / use of an additional 3rd-party application' || 
                value == 'Meets the requirement via core platform, minor gaps') && comment == ''){
                App.customError(`A comment is required on requirement number ${pos + 1}.`);
                isError = true;
                return;
            }

            feedback.push({
                feedback: value,
                comment: comment
            });
        });

        $(this).prop('disabled', true);

        if (!isError){
            if (feedback){
                // get fresh data before updating
                getRequirementsData(decodedRequirementId)
                .then(data => {
                    for (const vendor of data.assigned_vendors) {
                        if (vendor.id == vendorId){
                            if (vendor.feedback === undefined){
                                vendor.feedback = [];
                            }

                            vendor.feedback = feedback;
                        }
                    };
                   
                    updateFeedback(data);
                    console.log(data.assigned_vendors);
                })
                .catch(err => {
                    console.error('Promise failed:', err);
                    App.customError(App.OPERATION_FAILED);
                    $(this).prop('disabled', false);
                });
            }
        }
    });
});

async function updateFeedback(requirementData){
    const { data, error } = await updateVendorList(requirementData);
    if (error) {
        console.error('Updating requirement data failed (updateFeedback):', error);
        alert('Failed to fetch data');
        return;
    }

    location.href = App.pages.thank_you;
}

async function validateVendor(id){
    const assigned = App.isVenderAssigned(requirementsData.assigned_vendors, id);  
    
    if (!assigned){
        location.href = 'https://udder.rocks';
    }
}

async function checkSubmission(vendorId){
    let submissions = App.getVendorFeedback(requirementsData.assigned_vendors, vendorId)
    
    if (submissions.length) location.href = `${App.pages.proposal_submitted}?id=${vendorId}`;
}

async function getRequirementsData(id){
    const { data, error } = await getRequirementsById(id);

    if (error) {
        console.error('Fetching requirement data failed (getRequirementsById):', error);
        App.customError(App.FAILED_TO_LOAD_DATA);
        return;
    }

    return data;
}

async function loadData() {
    let data = requirementsData;

    $('#title').text(`${data.title} - ${data.client.company}`);
    $('#company_info').html(`Head Count: ${data.client.headcount ?? ''} | Timeline: ${data.client.timeline ?? ''}`)

    let index = 0;
    data.requirements.forEach(function(key, value){
        $('#requirementsTable').append(`
            <tr>
              <td>${index + 1}.</td>
              <td>${key.area}</td>
                <td>${key.requirement}</td>
                <td>${key.priority}</td>
              <td>
                <select data-type="feedback" class="form-field" data-pos="${index}">
                <option value="">Select</option>
                    <option>
                        Fully meets the requirement via core platform
                    </option>
                    <option>
                        Meets the requirement via core platform, minor gaps
                    </option>
                    <option>
                        Meets the requirement with workarounds / use of an additional 3rd-party application
                    </option>
                    <option>
                        Partially meets the requirement, substantial gaps
                    </option>
                    <option>
                        Fails to meet the requirement, or unable to provide
                    </option>
                </select>
              </td>
              <td><textarea data-type="comment" data-pos="${index}"></textarea></td>
            </tr>
        `);

        index++;
    });

    $('#loader').hide();
    $('table').removeClass('hide');
}