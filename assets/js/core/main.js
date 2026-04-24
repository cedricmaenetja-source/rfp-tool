$(function(){
    $('.loader-container').hide();
    $('.active').show();
    $('.nav').html(`
        <a href="#" data-page="home">Home</a>
        <a href="#" data-page="requirements">Requirements</a>
        <a href="#" data-page="vendors-list">Vendors</a>
        <a href="#" data-page="configurations">Configurations</a>
    `);

    const links = document.querySelectorAll('.nav a');
    const pages = document.querySelectorAll('.page');

    links.forEach(link => {
        link.addEventListener('click', e => {
        e.preventDefault();

        const pageId = link.getAttribute('data-page');

        pages.forEach(page => page.classList.remove('active'));
        if (pageId) {
            document.getElementById(pageId)?.classList.add('active');
        }
        });
    });

    const modal = $("#popupModal");

    // Open modal when clicking Edit button
    $("#vendors-table").on("click", ".fa-edit", function () {
        const row = $(this).closest("tr");
        
        $.each(row.data(), function(key, value) {
            $('#editForm').append(`
                <div>
                    <label>Name:</label>
                    <input type="text" id="name">
                </div>
            `);
        });

        $('#editForm').append('<button type="submit">Save Changes</button>');

        // Fill modal inputs
        // $("#id").val(row.data("id"));
        // $("#name").val(row.data("name"));
        // $("#description").val(row.data("description"));
        // $("#hqLocation").val(row.data("hqLocation"));
        // $("#contactName").val(row.data("contactName"));
        // $("#email").val(row.data("contactName"));
        // $("#contactName").val(row.data("contactName"));

        modal.show();
    });

    // Close modal on X click
    $(".modal .close").on("click", function () {
        modal.hide();
    });

    // Close modal by clicking outside modal content
    $(window).on("click", function (e) {
        if ($(e.target).is(modal)) {
        modal.hide();
        }
    });

    // Handle form submit
    $("#editForm").on("submit", function (e) {
        e.preventDefault();
        const id = $("#userId").val();
        const name = $("#userName").val();
        const email = $("#userEmail").val();

        // Update table row (optional)
        const row = $(`#myTable tr[data-id="${id}"]`);
        row.find("td:nth-child(2)").text(name);
        row.find("td:nth-child(3)").text(email);

        alert(`User ${id} updated!`);
        modal.hide();
    });
});


function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}