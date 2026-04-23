export function getVendorFeedback(vendors, vendorId) {
    let feedback = [];

    if (vendors === null) return feedback;
    vendors.forEach(async vendor => {
        if (vendor.id == vendorId && vendor.feedback !== undefined){
            feedback = vendor.feedback;
            return;
        }
    });

    return feedback;
}

export function isVenderAssigned(vendors, vendorId) {
    let assigned = false;
    if (!vendors) return assigned;

    vendors.forEach(async vendor => {
        if (vendor.id == vendorId){
            assigned = true;
            return;
        }
    });

    return assigned;
}

export function validVendorsWithContactPerson(vendors) {
    let validVendors = [];
    vendors.forEach(vendor => {
        if (vendor.contact_person !== null){
            validVendors.push({
                'contact_person': vendor.contact_person,
                'id': vendor.id,
                'name': vendor.name,
                'system_parts': vendor.system_parts
            });
        }
    });

    return validVendors;
}

export function vendorHasSystemPart(requirements, vendorSystemParts) {
    let hasSystemPart = false;
    if (vendorSystemParts === null) return hasSystemPart;
    
    for (let i = 0; i < requirements.length; i++){
        console.log('data', vendorSystemParts);
        if (vendorSystemParts !== undefined && vendorSystemParts.includes(requirements[i].system_part)){
            hasSystemPart = true;
            break;
        }
    }

    return hasSystemPart;
}

export function loader(){
    return `
    <style>
        .xloader {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background-color: gray;
            box-shadow: 32px 0 gray, -32px 0 gray;
            position: absolute;
            animation: flash 0.5s ease-out infinite alternate;
        }

            @keyframes flash {
            0% {
                background-color: #FFF2;
                box-shadow: 32px 0 #FFF2, -32px 0 gray;
            }
            50% {
                background-color: gray;
                box-shadow: 32px 0 #FFF2, -32px 0 #FFF2;
            }
            100% {
                background-color: #FFF2;
                box-shadow: 32px 0 gray, -32px 0 #FFF2;
            }
        }
    </style>
    <span class="xloader"></span>
    `;
}

export function showElement(id){
    $(`#${id}`).removeClass('hide');
    $(`#${id}`).addClass('show');
}

export function hideElement(id){
    $(`#${id}`).removeClass('show');
    $(`#${id}`).addClass('hide');
}

export function categories(){
    return [
        "Onboarding",
        "Self-service",
        "Contract changes",
        "Absence, Leave, Time & Attendance",
        "Offboarding",
        "Probation and Perfomance",
        "Talent Development",
        "Compensation Manager",
        "Reporting",
        "Integration"
    ];
}

export function hasInternet(redirect = 'index.html'){
    setInterval(() => {
        if (!navigator.onLine) {
            location.href = `../no_internet.html?r=${encodeURIComponent(redirect)}`;
        }
    }, 2000);
}

export function getUrlParameter(name) {
    return new URLSearchParams(window.location.search).get(name);
}

export function skeletonMainPanel(){
    return `
        <div class="skeleton-main">
            <div class="skeleton-main-line skeleton"></div>
            <div class="skeleton-main-line skeleton"></div>
            <div class="skeleton-main-line skeleton"></div>
            <div class="skeleton-main-line skeleton short"></div>
        </div>`;
}

export function getSolutionMultipliers(vendorFeedback, vendorFormFields, scoring) {
    let multipliers = [];
    if (vendorFeedback === undefined) return multipliers;

    vendorFeedback.forEach(async vendor => {
        const feedback = vendor.feedback;

        for (var i = 0; i < vendorFormFields.length; i++){
            if (vendorFormFields[i] === feedback){
                multipliers.push(scoring[i]);
                break;
            }
        }

    });

    return multipliers;
}

export function getMatchScores(allSystemParts, vendors, vendorFormFields, requirements, priorityWeighting, solutionMultiplier){
    let scores = [];

    vendors.forEach(vendor => {
        if (vendor.feedback !== null){
            scores[vendor.id] = {};

            for (var part of allSystemParts){
                let score = 0;
                const solutionScoring = getSolutionMultipliers(vendor.feedback, vendorFormFields, solutionMultiplier);
                $.each(requirements, function(index, value) {
                    if (part == 'All-in-one'){
                        score += priorityWeighting[value.priority] * solutionScoring[index];
                    }else{
                        if (part == value.system_part){
                            score += priorityWeighting[value.priority] * solutionScoring[index];
                        }
                    }
                });

                let percentage = (score / (requirements.length * 1.5)) * 100;
                percentage = parseInt(percentage);
                scores[vendor.id][part] = {
                    score: score,
                    vendor: vendor.name,
                    percentage: percentage
                }; 
            }
        }
    });

    return scores;
}