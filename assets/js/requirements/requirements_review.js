import { getRequirementsById, updateVendorList } from "./supabase.js";
import { isVenderAssigned, getVendorFeedback } from "./func.js";

let requirementsData = null;

$(function(){
    const requirementId = getParam('req');
    const vendorId = getParam('vid') ?? null;
    const decodedRequirementId = requirementId ? decodeURIComponent(JSON.parse(atob(requirementId))) : null;
    
    if (decodedRequirementId === null || vendorId === null){
        // add 404 page
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
            });

        // loadData(decodedRequirementId);
    }

    $('#saveDecisions').on('click', async function () {
        let isError = false;
        let feedback = [];
        let feedbackProvided = {};

        await $('.form-field').each(async function() {
            const dataId = $(this).data('id');
            const value = $(this).val();
            
            const elParts = dataId.split('_');
            const i = elParts[0];
            const type = elParts[1];
            
            if (type == 'feedback' && value == ''){
                alert(`You must provide feedback to requirement number ${i + 1}.`);
                isError = true;
                return;
            }

            feedbackProvided[type] = value;
            feedback[i] = feedbackProvided;
        });

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

    location.href = 'thank_you.html';
}

async function validateVendor(id){
    const assigned = isVenderAssigned(requirementsData.assigned_vendors, id);  
    
    if (!assigned){
        location.href = 'https://udder.rocks';
    }
}

async function checkSubmission(vendorId){
    let submissions = getVendorFeedback(requirementsData.assigned_vendors, vendorId)
    
    if (submissions.length) location.href = `submitted.html?id=${vendorId}`;
}

async function getRequirementsData(id){
    const { data, error } = await getRequirementsById(id);

    if (error) {
        console.error('Fetching requirement data failed (getRequirementsById):', error);
        alert('Failed to fetch data');
        return;
    }

    return data;
}

async function loadData() {
    let data = requirementsData;

    $('#title').text(`${data.title} - ${data.client.company}`);
    $('#company_info').html(`Head Count: ${data.client.headcount} | Timeline: ${data.client.timeline}`)

    let index = 0;
    data.requirements.forEach(function(key, value){
        $('#requirementsTable').append(`
            <tr>
              <td>${index + 1}.</td>
              <td>${key.area}</td>
                <td>${key.requirement}</td>
                <td>${key.priority}</td>
              <td>
                <select data-id="${index}_feedback" class="form-field">
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
              <td><textarea data-id="${index}_comment" class="form-field"></textarea></td>
            </tr>
        `);

        index++;
    });
}