const button = document.querySelector("button"),
  toast = document.querySelector(".toast");
(closeIcon = document.querySelector(".close")),
  (progress = document.querySelector(".progress"));

let timer1, timer2;

export function showToast(status = 'success'){
  toast.classList.add("active");
  progress.classList.add("active");

  timer1 = setTimeout(() => {
    toast.classList.remove("active");
  }, 5000); 

  timer2 = setTimeout(() => {
    progress.classList.remove("active");
  }, 5300);
}

export function closeToast() {
  toast.classList.remove("active");

  setTimeout(() => {
    progress.classList.remove("active");
  }, 300);

  clearTimeout(timer1);
  clearTimeout(timer2);
}

export function initToast(){
    $('body').append(`
        <div class="toast active">
  
        <div class="toast-content">
            <i class="fas fa-solid fa-check check"></i>

            <div class="toast-message">
            <span class="text text-1">Success</span>
            <span class="text text-2">Your changes has been saved</span>
            </div>
        </div>
        <i class="fa-solid fa-xmark close"></i>

        <!-- Remove 'active' class, this is just to show in Codepen thumbnail -->
        <div class="progress active"></div>
        </div>
    `);
}