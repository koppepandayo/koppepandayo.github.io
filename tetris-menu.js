(function () {
  "use strict";

  const ACCOUNT_KEY = "koppepandayo-tetris-account";

  const accountBtn = document.getElementById("account-btn");
  const accountSummary = document.getElementById("account-summary");
  const modal = document.getElementById("account-modal");
  const closeBtn = document.getElementById("account-close");
  const usernameInput = document.getElementById("username-input");
  const usernameSave = document.getElementById("username-save");
  const discordDisconnected = document.getElementById("discord-disconnected");
  const discordConnected = document.getElementById("discord-connected");
  const discordLoginBtn = document.getElementById("discord-login-btn");
  const discordLogoutBtn = document.getElementById("discord-logout-btn");
  const discordAvatar = document.getElementById("discord-avatar");
  const discordName = document.getElementById("discord-name");

  function loadAccount() {
    try {
      return JSON.parse(localStorage.getItem(ACCOUNT_KEY)) || { username: "", discord: null };
    } catch (e) {
      return { username: "", discord: null };
    }
  }

  function saveAccount(account) {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  }

  function refreshUI() {
    const account = loadAccount();
    usernameInput.value = account.username || "";

    if (account.discord) {
      discordDisconnected.classList.add("hidden");
      discordConnected.classList.remove("hidden");
      discordAvatar.src = account.discord.avatar;
      discordName.textContent = account.discord.username;
      accountSummary.textContent = account.discord.username;
    } else {
      discordDisconnected.classList.remove("hidden");
      discordConnected.classList.add("hidden");
      accountSummary.textContent = account.username || "ゲスト";
    }
  }

  accountBtn.addEventListener("click", () => {
    modal.classList.remove("hidden");
  });

  closeBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  usernameSave.addEventListener("click", () => {
    const account = loadAccount();
    account.username = usernameInput.value.trim().slice(0, 20);
    saveAccount(account);
    refreshUI();
  });

  discordLoginBtn.addEventListener("click", () => {
    discordLoginBtn.textContent = "準備中です (近日対応)";
    discordLoginBtn.disabled = true;
  });

  discordLogoutBtn.addEventListener("click", () => {
    const account = loadAccount();
    account.discord = null;
    saveAccount(account);
    refreshUI();
  });

  refreshUI();
})();
