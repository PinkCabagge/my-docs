document.addEventListener("DOMContentLoaded", function () {
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      target.classList.add("highlight");
      setTimeout(() => target.classList.remove("highlight"), 2000);
    }
  }
});
