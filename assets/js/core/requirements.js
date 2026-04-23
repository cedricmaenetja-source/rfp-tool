import { getActiveRequirements } from "../services/supabase.js";

$(function () {

  loadRequirements();

  async function loadRequirements(){
    const tbody = $('#mytable tbody');

    const { data, error } = await getActiveRequirements();
    if (error) {
        console.error('Select failed:', error);
        alert('Failed to load data');
    } else {
        data.forEach(function(key, value){
            console.log(key);
            const d = new Date(key.created_at);
            const formatted =
                d.getDate().toString().padStart(2, '0') + ' ' +
                d.toLocaleString('en-GB', { month: 'short' }) + ' ' +
                d.getFullYear() + ' ' +
                d.toTimeString().split(' ')[0];
            
            const reqId = encodeURIComponent(btoa(JSON.stringify(key.id)));

            tbody.append(`
                <tr>
                    <td><button class="add-btn-white" title="edit vendor">+</button></td>
                    <td><span title="${d}">${formatted}</span></td>
                    <td>${key.client.company}</td>
                    <td><a href="../requirements/details.html?req=${reqId}" target="_blank">${key.title}</a></td>
                    <td>${key.client.name}</td>
                    <td>${key.client.email}</td>
                    <td>${key.client.phone}</td>
                    <td>${key.client.country}</td>
                </tr>
            `);
        });
    }

    function format(d) {
        // `d` is the original data object for the row
        return (
            '<dl>' +
            '<dt>Full name:</dt>' +
            '<dd>' +
            d.name +
            '</dd>' +
            '<dt>Extension number:</dt>' +
            '<dd>' +
            d.extn +
            '</dd>' +
            '<dt>Extra info:</dt>' +
            '<dd>And any further details here (images etc)...</dd>' +
            '</dl>'
        );
    }

    var t = $('#mytable').DataTable({
        responsive: {
            details: {
            type: 'column',
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

    // t.on('click', 'tbody td.dt-control', function (e) {
    //     let tr = e.target.closest('tr');
    //     let row = table.row(tr);
    
    //     if (row.child.isShown()) {
    //         // This row is already open - close it
    //         row.child.hide();
    //     }
    //     else {
    //         // Open this row
    //         row.child(format(row.data())).show();
    //     }
    // });

}

});
