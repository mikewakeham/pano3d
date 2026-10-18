(() => {
  const button = document.getElementById("copy-bibtex");
  const code = document.getElementById("bibtex-code");
  const status = document.getElementById("copy-status");
  const copyIcon = button.innerHTML;
  const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>';
  let resetTimer;

  button.addEventListener("click", async () => {
    clearTimeout(resetTimer);
    try {
      await navigator.clipboard.writeText(code.textContent);
      status.textContent = "";
      button.innerHTML = checkIcon;
      button.setAttribute("aria-label", "BibTeX copied");
      resetTimer = setTimeout(() => {
        button.innerHTML = copyIcon;
        button.setAttribute("aria-label", "Copy BibTeX");
      }, 2000);
    } catch {
      button.innerHTML = copyIcon;
      button.setAttribute("aria-label", "Copy BibTeX");
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = "Select and copy the citation manually.";
    }
  });
})();
