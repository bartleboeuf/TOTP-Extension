// ------------------ Element References ------------------
const settingsBtn = document.getElementById("settingsBtn");
const accountsView = document.getElementById("accountsView");
const accountsDiv = document.getElementById("accounts");
const addAccountBtn = document.getElementById("addAccount");
const exportAccountsBtn = document.getElementById("exportAccounts");

const addAccountView = document.getElementById("addAccountView");
const importBtn = document.getElementById("importBtn");
const importManualBtn = document.getElementById("manualEntry");

const manualEntryView = document.getElementById("manualEntryView");
const nameInput = document.getElementById("nameInput");
const secretInput = document.getElementById("secretInput");
const toggleSecretBtn = document.getElementById("toggleSecret");
const digitsInput = document.getElementById("digitsInput");
const algorithmInput = document.getElementById("algorithmInput");
const periodInput = document.getElementById("periodInput");
const algorithmView = document.getElementById("algorithmView");
const periodView = document.getElementById("periodView");

const saveAccountBtn = document.getElementById("saveAccount");
const cancelAddBtn = document.getElementById("cancelAdd");
const deleteBtn = document.getElementById("deleteAccount");

const passwordEntryView = document.getElementById("passwordEntryView");
const passwordInput = document.getElementById("passwordInput");
const passwordSetBtn = document.getElementById("setPasswordButton");

// ------------------ Global Elements ------------------

let accounts = [];
let accountElements = new Map();
let lastTimeSlot = [];
let editingIndex = null;
var password;
var showNextCode;
var showServiceImages;
let draggedElement = null;

// ------------------ Button Event Listeners ------------------

settingsBtn.addEventListener("click", () => {
  try{
    browser.tabs.create({ url: browser.runtime.getURL('../Views/settings.html') });
  } catch (e) {
  }
  window.close();
});

addAccountBtn.addEventListener("click", () => showAddOptions());

exportAccountsBtn.addEventListener("click", () => {
  if (!accounts.length) {
    alert(browser.i18n.getMessage("ExportFailedText"));
    return;
  }

  const dataStr = JSON.stringify(accounts, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "totp-backup.json";
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => {
  try {
    browser.tabs.create({ url: browser.runtime.getURL('../Views/import.html') });
  } catch (e) {
  }
  window.close();
});

importManualBtn.addEventListener("click", () => showAddView());

toggleSecretBtn.addEventListener("click", () => {
  if (secretInput.type === "password") {
    secretInput.type = "text";
    toggleSecretBtn.textContent = "🙈";
  } else {
    secretInput.type = "password";
    toggleSecretBtn.textContent = "👁";
  }
});

deleteBtn.addEventListener("click", async () => {
  if (editingIndex !== null) {
    const acc = accounts[editingIndex];
    // Bestätigungsdialog
    const confirmed = confirm(browser.i18n.getMessage("confirmDeleteAccountText").replace("{accName}", acc.name));
    if (!confirmed) return;

    accounts.splice(editingIndex, 1);
    await saveAccounts(accounts, password);
    showAccountsView();
    renderAccounts();
  }
});

saveAccountBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const secret = secretInput.value.trim();
  const digits = parseInt(digitsInput.value);
  const algorithm = algorithmInput.value;
  const period = parseInt(periodInput.value);

  if (!name) return;
  if (!secret && editingIndex === null) return;

  if (editingIndex !== null) {
    const acc = accounts[editingIndex];
    acc.name = name;
    if (secret) acc.secret = secret;
    acc.digits = digits;
    acc.algorithm = algorithm;
    acc.period = period;
  } else {
    accounts.push(new Account(name, secret, name, name, undefined, digits, algorithm, 'TOTP', undefined, period));
  }

  await saveAccounts(accounts, password);
  browser.storage.local.remove("uiState");
  showAccountsView();
  renderAccounts();
});

cancelAddBtn.addEventListener("click", showAccountsView);


// ------------------ Functions -----------------

function waitForButtonClick(buttonElement, inputElement) {
  return new Promise((resolve) => {
    function cleanup(event) {
      buttonElement.removeEventListener("click", onClick);
      inputElement.removeEventListener("keydown", onKeyDown);
      resolve(event);
    }

    function onClick(event) {
      cleanup(event);
    }

    function onKeyDown(event) {
      if (event.key === "Enter") {
        cleanup(event);
      }
    }

    buttonElement.addEventListener("click", onClick);
    inputElement.addEventListener("keydown", onKeyDown);
  });
}

async function setPassword() {
  accountsView.style.display = "none";
  addAccountView.style.display = "none";
  manualEntryView.style.display = "none";
  passwordEntryView.style.display = "block";

  await waitForButtonClick(passwordSetBtn, passwordInput);
  
  accountsView.style.display = "flex";
  addAccountView.style.display = "none";
  manualEntryView.style.display = "none";
  passwordEntryView.style.display = "none";

  return passwordInput.value;
}

function showAddOptions() {
  accountsView.style.display = "none";
  addAccountView.style.display = "block";
  manualEntryView.style.display = "none";
  passwordEntryView.style.display = "none";
}

function showAddView(editIndex = null) {
  editingIndex = editIndex;
  accountsView.style.display = "none";
  addAccountView.style.display = "none";
  passwordEntryView.style.display = "none";
  manualEntryView.style.display = "block";
  algorithmView.style.display = "block";
  periodView.style.display = "block";

  if (editIndex !== null) {
    const acc = accounts[editIndex];

    if(acc.type === "HOTP"){
      algorithmView.style.display = "none";
      periodView.style.display = "none";
    }

    nameInput.value = acc.name;
    secretInput.value = acc.secret;
    digitsInput.value = acc.digits;
    algorithmInput.value = acc.algorithm || "SHA-1";
    periodInput.value = acc.period || 30;
    deleteBtn.style.display = "block";
    document.getElementById("newAccountLabel").textContent = browser.i18n.getMessage("editAccountText");
  } else {
    nameInput.value = "";
    secretInput.value = "";
    digitsInput.value = "6";
    algorithmInput.value = "SHA-1";
    periodInput.value = 30;
    deleteBtn.style.display = "none";
    document.getElementById("newAccountLabel").textContent = browser.i18n.getMessage("newAccountText");
  }

  secretInput.type = "password";
  toggleSecretBtn.textContent = "👁";
  saveUIState();
}

function showAccountsView() {
  editingIndex = null;
  addAccountView.style.display = "none";
  accountsView.style.display = "flex";
  manualEntryView.style.display = "none";
  passwordEntryView.style.display = "none";
  saveUIState();
}

function openEdit(index) {
  showAddView(index);
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".account:not(.dragging)")];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getLogoColors(initials) {
  const backgrounds = [
    "#2563eb",
    "#7c3aed",
    "#db2777",
    "#dc2626",
    "#ea580c",
    "#facc15",
    "#4ade80",
    "#22d3ee",
    "#f9a8d4"
  ];
  const hash = [...initials].reduce((value, character) => (
    (value * 31 + character.charCodeAt(0)) >>> 0
  ), 0);
  const background = backgrounds[hash % backgrounds.length];

  function relativeLuminance(hex) {
    const channels = [1, 3, 5].map(offset => {
      const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }

  const backgroundLuminance = relativeLuminance(background);
  const whiteContrast = 1.05 / (backgroundLuminance + 0.05);
  const darkText = "#111827";
  const darkContrast = (backgroundLuminance + 0.05) / (relativeLuminance(darkText) + 0.05);

  return {
    background,
    foreground: whiteContrast >= darkContrast ? "#ffffff" : darkText
  };
}

async function renderAccounts() {

  accountsDiv.innerHTML = "";

  accountsDiv.addEventListener("dragover", (e) => {
    e.preventDefault();

    const afterElement = getDragAfterElement(accountsDiv, e.clientY);

    const dragging = document.querySelector(".dragging");
    if (!dragging) return;

    if (afterElement == null) {
      accountsDiv.appendChild(dragging);
    } else {
      accountsDiv.insertBefore(dragging, afterElement);
    }
  });

  accountElements.clear();
  lastTimeSlot = [];
  lastTimeSlot = accounts.map(() => ({ current: null, next: null }));

  accounts.forEach((acc, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "account";
    wrapper.dataset.index = index;
    wrapper.draggable = true;
    wrapper.addEventListener("dragstart", () => {
      draggedElement = wrapper;
      wrapper.classList.add("dragging");
    });

    wrapper.addEventListener("dragend", async () => {
      wrapper.classList.remove("dragging");
      draggedElement = null;

      const newOrder = [...accountsDiv.querySelectorAll(".account")]
        .map(el => accounts[Number(el.dataset.index)]);

      accounts = newOrder;

      await saveAccounts(accounts, password);
      await renderAccounts();
    });

    const left = document.createElement("div");
    left.className = "account-left";

    const logoEl = document.createElement("div");
    logoEl.className = "account-logo";
    const serviceName = String(acc.issuer || acc.name || acc.label || "").trim();
    const initials = serviceName.slice(0, 2).toUpperCase();
    const logoColors = getLogoColors(initials);
    logoEl.textContent = initials;
    logoEl.style.backgroundColor = logoColors.background;
    logoEl.style.color = logoColors.foreground;
    logoEl.setAttribute("role", "img");
    logoEl.setAttribute("aria-label", serviceName || acc.name);

    const imageUrl = typeof acc.image === "string" &&
      (/^https?:\/\//i.test(acc.image) || /^data:image\/(?:avif|gif|jpeg|png|svg\+xml|webp);base64,/i.test(acc.image))
      ? acc.image
      : null;
    if (showServiceImages && imageUrl) {
      const imageEl = document.createElement("img");
      imageEl.src = imageUrl;
      imageEl.alt = "";
      if (/^https?:\/\//i.test(imageUrl)) imageEl.referrerPolicy = "no-referrer";
      imageEl.addEventListener("error", () => imageEl.remove());
      logoEl.appendChild(imageEl);
    }

    const right = document.createElement("div");
    right.className = "account-right";

    const content = document.createElement("div");
    content.className = "account-content";

    const nameEl = document.createElement("div");
    nameEl.className = "name";
    nameEl.textContent = acc.name;

    const labelEL = document.createElement("div");
    labelEL.className = "label";
    labelEL.textContent = acc.label;

    const codeEl = document.createElement("div");
    codeEl.className = "code";
    
    let copyFeedbackTimeout;
    const copyCode = () => {
      navigator.clipboard.writeText(codeEl.textContent);
      codeEl.classList.add("copied");
      clearTimeout(copyFeedbackTimeout);
      copyFeedbackTimeout = setTimeout(() => codeEl.classList.remove("copied"), 600);
    };
    left.addEventListener("click", copyCode);

    const nextCodeEl = document.createElement("div");
    nextCodeEl.className = "next-code";

    const timerEl = document.createElement("div");
    timerEl.className = "timer";

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", () => openEdit(index));

    content.appendChild(nameEl);
    if(labelEL.textContent !== nameEl.textContent)
      content.appendChild(labelEL);
    content.appendChild(codeEl);
    content.appendChild(nextCodeEl);
    content.appendChild(timerEl);

    left.appendChild(logoEl);
    left.appendChild(content);

    if(acc.type === "HOTP"){
      const nextCounterBtn = document.createElement("button");
      nextCounterBtn.className = "edit-btn";
      nextCounterBtn.textContent = "⟳";

      nextCounterBtn.addEventListener("click", async () => {
        acc.counter++;
        await saveAccounts(accounts, password);
      });

      right.appendChild(nextCounterBtn);
    }

    right.appendChild(editBtn);

    wrapper.appendChild(left);
    wrapper.appendChild(right);

    accountsDiv.appendChild(wrapper);

    accountElements.set(index, {
      codeEl,
      nextCodeEl,
      timerEl,
      currentCode: "",
      nextCode: ""
    });

  });

  await updateCodes(true);
}

async function updateCodes() {

  const now = Math.floor(Date.now() / 1000);

  for (let [index, acc] of accounts.entries()) {
    const el = accountElements.get(index);
    if (!el) continue;

    if(acc.type === "HOTP"){
      const hotpCode = await generateHOTP(acc.secret, acc.counter, acc.digits);
      if(el.codeEl.textContent !== hotpCode){
        el.codeEl.textContent = hotpCode;
      }
      continue;
    }

    const period = Number(acc.period) || 30;
    const currentSlot = Math.floor(now / period);
    const nextSlot = currentSlot + 1;
    const remaining = period - (now % period);

    if(!lastTimeSlot[index]){
      lastTimeSlot[index] = {current: null, next: null};
      lastTimeSlot[index].current = currentSlot;
      lastTimeSlot[index].next = nextSlot;
      el.currentCode = await generateTOTP(acc.secret, acc.digits, period, acc.algorithm);
      el.nextCode = await generateTOTP(acc.secret, acc.digits, period, acc.algorithm, 1);
      el.codeEl.textContent = el.currentCode;
      if(remaining <= 10 && showNextCode){
        el.nextCodeEl.textContent = browser.i18n.getMessage("nextCodeText") + el.nextCode;
      }
    }else{
      if(lastTimeSlot[index].current !== currentSlot){
        lastTimeSlot[index].current = currentSlot;
        lastTimeSlot[index].next = nextSlot;
        el.currentCode = await generateTOTP(acc.secret, acc.digits, period, acc.algorithm);
        el.nextCode = await generateTOTP(acc.secret, acc.digits, period, acc.algorithm, 1);
        el.codeEl.textContent = el.currentCode;
        if(showNextCode){
          el.nextCodeEl.textContent = remaining <= 10 ? browser.i18n.getMessage("nextCodeText") + el.nextCode : "";;
        }
      }else{

        const nextText = remaining <= 10 ? browser.i18n.getMessage("nextCodeText") + el.nextCode : "";
        if ((el.nextCodeEl.textContent !== nextText) && showNextCode){
          el.nextCodeEl.textContent = nextText;
        } 
      }
    }
    
    el.timerEl.textContent = remaining + browser.i18n.getMessage("timeTillNextCode"); // Timer immer aktualisieren
    
  }
}

function saveUIState() {
  const isAddView = manualEntryView.style.display === "block";

  const state = {
    currentView: isAddView ? "add" : "accounts",
    editingIndex,
    draft: isAddView
      ? {
          name: nameInput.value,
          secret: secretInput.value,
          digits: digitsInput.value,
          algorithm: algorithmInput.value,
          period: periodInput.value
        }
      : null
  };

  browser.storage.session.set({ uiState: state });
}

function restoreUIState(state) {
  if(state === undefined) return;
  if (state.currentView === "add") {
    showAddView(state.editingIndex);

    if (state.draft) {
      nameInput.value = state.draft.name || "";
      secretInput.value = state.draft.secret || "";
      digitsInput.value = state.draft.digits || 6;
      algorithmInput.value = state.draft.algorithm || "SHA-1";
      periodInput.value = state.draft.period || 30;
    }
  } else {
    showAccountsView();
  }
}

// ------------------ Run At Start ------------------

[nameInput, secretInput, digitsInput, algorithmInput, periodInput]
  .forEach(input => {
    input.addEventListener("input", saveUIState);
    input.addEventListener("change", saveUIState);
});

document.querySelectorAll('[data-i18n]').forEach(el => {
  const key = el.getAttribute('data-i18n');
  el.textContent = browser.i18n.getMessage(key);
});

browser.storage.session.get(["uiState"]).then(async result => {

  if(await isDarkMode()){
    document.body.classList.add("dark");   // Dark
  }

  switch (await getFontSize()){
    case "small":
      document.body.classList.add("small");
      break;
    case "medium":
      break;
    case "large":
      document.body.classList.add("large");
      break;
    default:
      break;
  }

  showNextCode = await isShowNextCode();
  showServiceImages = await isShowServiceImages();

  password = await getSessionPassword();
  accounts = await loadAccounts(password);

  await renderAccounts();
  restoreUIState(result.uiState);

  setInterval(updateCodes, 500);
});