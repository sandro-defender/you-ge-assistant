// Shared, dependency-free navigation. With JS disabled all links stay visible.
for (const header of document.querySelectorAll("[data-product-header]")) {
  const button = header.querySelector("[data-menu-toggle]");
  const nav = header.querySelector("nav");
  if (!button || !nav) continue;
  button.hidden = false;
  header.dataset.navReady = "true";
  const close = () => {
    header.dataset.menuOpen = "false";
    button.setAttribute("aria-expanded", "false");
  };
  close();
  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") !== "true";
    header.dataset.menuOpen = String(open);
    button.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });
  header.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      button.getAttribute("aria-expanded") === "true"
    ) {
      close();
      button.focus();
    }
  });
}
