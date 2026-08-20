import type { PairingBridge } from "../../preload/pairing-preload";

declare global {
  interface Window {
    woope: PairingBridge;
  }
}

const form = document.querySelector<HTMLFormElement>("#pairing-form")!;
const input = document.querySelector<HTMLInputElement>("#code-input")!;
const submitButton = document.querySelector<HTMLButtonElement>("#submit-button")!;
const errorMessage = document.querySelector<HTMLParagraphElement>("#error-message")!;
const closeButton = document.querySelector<HTMLButtonElement>("#close-button")!;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_or_expired_code: "Kód je neplatný nebo vypršel. Vygeneruj si prosím nový na webu.",
  rate_limited: "Příliš mnoho pokusů. Zkus to prosím za chvíli znovu.",
  network_error: "Woope se nepodařilo kontaktovat. Zkontroluj připojení k internetu.",
  unknown: "Něco se nepovedlo. Zkus to prosím znovu.",
};

input.addEventListener("input", () => {
  input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  hideError();
});

closeButton.addEventListener("click", () => window.close());

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void submit();
});

async function submit(): Promise<void> {
  const code = input.value.trim();
  if (code.length !== 6) {
    showError("Kód má 6 znaků.");
    return;
  }

  setLoading(true);
  try {
    const result = await window.woope.submitPairingCode(code);
    if (!result.ok) showError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown);
  } finally {
    setLoading(false);
  }
}

function setLoading(loading: boolean): void {
  submitButton.disabled = loading;
  input.disabled = loading;
  submitButton.textContent = loading ? "Páruji..." : "Spárovat";
}

function showError(message: string): void {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function hideError(): void {
  errorMessage.hidden = true;
}
