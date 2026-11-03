// click a gallery picture to see it big; arrows step through the page's pictures, esc or a click closes
(function () {
  const links = Array.from(document.querySelectorAll(".strip a")).filter(a => a.querySelector("img"));
  if (!links.length) return;
  const box = document.createElement("div");
  box.className = "lightbox";
  box.hidden = true;
  box.innerHTML = '<img alt=""><button class="lb-prev" type="button" aria-label="previous">‹</button><button class="lb-next" type="button" aria-label="next">›</button>';
  document.body.appendChild(box);
  const img = box.querySelector("img");
  let at = 0;

  function show(i) {
    at = (i + links.length) % links.length;
    img.src = links[at].href;
    img.alt = links[at].querySelector("img").alt;
    box.hidden = false;
  }
  function close() { box.hidden = true; img.removeAttribute("src"); }

  links.forEach((a, i) => a.addEventListener("click", e => { e.preventDefault(); show(i); }));
  box.querySelector(".lb-prev").addEventListener("click", e => { e.stopPropagation(); show(at - 1); });
  box.querySelector(".lb-next").addEventListener("click", e => { e.stopPropagation(); show(at + 1); });
  box.addEventListener("click", close);
  document.addEventListener("keydown", e => {
    if (box.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(at - 1);
    else if (e.key === "ArrowRight") show(at + 1);
  });
})();
