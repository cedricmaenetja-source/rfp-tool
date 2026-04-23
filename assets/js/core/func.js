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
            location.href = `no_internet.html?r=${encodeURIComponent(redirect)}`;
        }
    }, 2000);
}

export function getUrlParameter(name) {
    return new URLSearchParams(window.location.search).get(name);
}