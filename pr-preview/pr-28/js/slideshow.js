(function () {
  var root = document.querySelector(".home-slideshow");
  if (!root) return;

  var slides = Array.prototype.slice.call(root.querySelectorAll(".home-slideshow__slide"));
  var dots = Array.prototype.slice.call(root.querySelectorAll(".home-slideshow__dot"));
  var prevBtn = root.querySelector(".home-slideshow__prev");
  var nextBtn = root.querySelector(".home-slideshow__next");
  if (slides.length < 2) return;

  var INTERVAL_MS = 6000;
  var index = 0;
  var timer = null;
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function show(newIndex) {
    slides[index].classList.remove("is-active");
    slides[index].setAttribute("aria-hidden", "true");
    dots[index].classList.remove("is-active");
    dots[index].setAttribute("aria-selected", "false");

    index = (newIndex + slides.length) % slides.length;

    slides[index].classList.add("is-active");
    slides[index].removeAttribute("aria-hidden");
    dots[index].classList.add("is-active");
    dots[index].setAttribute("aria-selected", "true");
  }

  function next() {
    show(index + 1);
  }

  function prev() {
    show(index - 1);
  }

  function start() {
    if (prefersReducedMotion || timer) return;
    timer = window.setInterval(next, INTERVAL_MS);
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  nextBtn.addEventListener("click", function () {
    next();
    stop();
    start();
  });
  prevBtn.addEventListener("click", function () {
    prev();
    stop();
    start();
  });
  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function () {
      show(i);
      stop();
      start();
    });
  });

  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  root.addEventListener("focusin", stop);
  root.addEventListener("focusout", start);

  start();
})();
