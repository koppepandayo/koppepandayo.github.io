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
    window.location.href = "https://discord-auth.koppepandayo07.workers.dev/auth/discord/login";
  });

  discordLogoutBtn.addEventListener("click", () => {
    const account = loadAccount();
    account.discord = null;
    saveAccount(account);
    refreshUI();
  });

  function base64urlToJson(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  }

  function consumeDiscordCallback() {
    const params = new URLSearchParams(window.location.search);
    const discordData = params.get("discord");
    const sig = params.get("sig");
    const error = params.get("discord_error");

    if (!discordData && !error) return false;

    window.history.replaceState({}, "", window.location.pathname);

    if (error) {
      window.alert("Discordログインに失敗しました: " + error);
      return true;
    }

    try {
      const payload = base64urlToJson(discordData);
      const account = loadAccount();
      account.discord = { id: payload.id, username: payload.username, avatar: payload.avatar, token: discordData + "." + sig };
      saveAccount(account);
    } catch (e) {
      window.alert("Discordログインの処理に失敗しました");
    }
    return true;
  }

  const cameFromDiscord = consumeDiscordCallback();
  refreshUI();
  if (cameFromDiscord) modal.classList.remove("hidden");
})();
