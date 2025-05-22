// Handles left/right navigation for the component carousel on the project detail page
// Requires: #componentCarousel, #carouselLeftBtn, #carouselRightBtn

document.addEventListener('DOMContentLoaded', function() {
  const carousel = document.getElementById('componentCarousel');
  const leftBtn = document.getElementById('carouselLeftBtn');
  const rightBtn = document.getElementById('carouselRightBtn');

  function updateArrows() {
    if (!carousel) return;
    if (leftBtn) leftBtn.disabled = carousel.scrollLeft === 0;
    if (rightBtn) rightBtn.disabled = carousel.scrollLeft + carousel.offsetWidth >= carousel.scrollWidth - 1;
  }

  if (leftBtn) {
    leftBtn.addEventListener('click', function() {
      if (!carousel) return;
      carousel.scrollBy({ left: -carousel.offsetWidth, behavior: 'smooth' });
      setTimeout(updateArrows, 350);
    });
  }

  if (rightBtn) {
    rightBtn.addEventListener('click', function() {
      if (!carousel) return;
      carousel.scrollBy({ left: carousel.offsetWidth, behavior: 'smooth' });
      setTimeout(updateArrows, 350);
    });
  }

  if (carousel) {
    carousel.addEventListener('scroll', updateArrows);
    updateArrows();
  }
});
