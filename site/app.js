const motion = document.documentElement.classList.contains("motion");

const status = document.createElement("p");
status.className = "sr-only";
status.setAttribute("role", "status");
document.body.append(status);

for (const button of document.querySelectorAll("[data-copy]")) {
  let reset;
  button.addEventListener("click", async () => {
    clearTimeout(reset);
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = "Copied";
      status.textContent = "Copied to the clipboard.";
      reset = setTimeout(() => (button.textContent = "Copy"), 2000);
    } catch {
      getSelection().selectAllChildren(button.previousElementSibling);
      button.textContent = "Selected";
      status.textContent = "Couldn't copy. The text is selected: press Ctrl+C or Command+C.";
    }
  });
}

const review = document.querySelector(".review");

function playReview() {
  review.classList.remove("waiting");
  for (const animation of review.getAnimations({ subtree: true })) {
    animation.currentTime = 0;
    animation.play();
  }
}

if (motion && review) {
  review.querySelector(".replay").addEventListener("click", playReview);
  if ("IntersectionObserver" in window) {
    review.classList.add("waiting");
    const seen = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      seen.disconnect();
      playReview();
    }, { threshold: 0.35 });
    seen.observe(review);
  }
}

function tick(el) {
  const target = Number(el.textContent.replace(/,/g, ""));
  if (!Number.isFinite(target) || target === 0) return;
  const holder = el.querySelector("[data-bake]") ?? el;
  const start = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - start) / 700);
    holder.textContent = Math.round(target * (1 - (1 - t) ** 3)).toLocaleString("en-US");
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

if (motion && "IntersectionObserver" in window) {
  const counters = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      counters.unobserve(entry.target);
      tick(entry.target);
    }
  });
  for (const el of document.querySelectorAll("[data-count]")) counters.observe(el);
}
