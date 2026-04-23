import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

export { Swal };

export function error(error){
    Swal.fire({
        icon: "error",
        title: "Oops...",
        text: error,
    });
}