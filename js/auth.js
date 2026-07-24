/* =========================================================
   auth.js — logic for login.html only
   ========================================================= */

(function () {
  // someone already signed in? this page has nothing left for them
  if (getSession()) {
    window.location.href = "dashboard.html";
    return;
  }

  const tabLoginBtn = qs("#tabLoginBtn");
  const tabRegisterBtn = qs("#tabRegisterBtn");
  const loginForm = qs("#loginForm");
  const registerForm = qs("#registerForm");

  function showTab(tab) {
    const isLogin = tab === "login";
    tabLoginBtn.classList.toggle("active", isLogin);
    tabRegisterBtn.classList.toggle("active", !isLogin);
    loginForm.classList.toggle("active", isLogin);
    registerForm.classList.toggle("active", !isLogin);
  }

  tabLoginBtn.addEventListener("click", () => showTab("login"));
  tabRegisterBtn.addEventListener("click", () => showTab("register"));

  // open on whichever tab the link asked for (defaults to login)
  const params = new URLSearchParams(window.location.search);
  showTab(params.get("tab") === "register" ? "register" : "login");

  /* ---------- shared little helpers ---------- */

  function setFieldError(id, message) {
    qs("#" + id).textContent = message || "";
  }

  function setFormMessage(id, message) {
    const el = qs("#" + id);
    el.textContent = message || "";
    el.classList.toggle("show", Boolean(message));
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /* ---------- login ---------- */

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    setFormMessage("loginMessage", "");
    setFieldError("loginEmailError", "");
    setFieldError("loginPasswordError", "");

    const email = qs("#loginEmail").value.trim();
    const password = qs("#loginPassword").value;

    let hasError = false;
    if (!isValidEmail(email)) {
      setFieldError("loginEmailError", "Enter a valid email address.");
      hasError = true;
    }
    if (!password) {
      setFieldError("loginPasswordError", "Enter your password.");
      hasError = true;
    }
    if (hasError) return;

    const user = findUserByEmail(email);
    if (!user || user.password !== password) {
      setFormMessage("loginMessage", "Incorrect email or password. Please try again.");
      return;
    }

    startUserSession(user);
    window.location.href = "dashboard.html";
  });

  /* ---------- register ---------- */

  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    setFormMessage("registerMessage", "");
    ["registerNameError", "registerEmailError", "registerPasswordError", "registerConfirmError"].forEach(
      (id) => setFieldError(id, "")
    );

    const name = qs("#registerName").value.trim();
    const email = qs("#registerEmail").value.trim();
    const password = qs("#registerPassword").value;
    const confirm = qs("#registerConfirm").value;

    let hasError = false;
    if (name.length < 2) {
      setFieldError("registerNameError", "Enter your name.");
      hasError = true;
    }
    if (!isValidEmail(email)) {
      setFieldError("registerEmailError", "Enter a valid email address.");
      hasError = true;
    }
    if (password.length < 6) {
      setFieldError("registerPasswordError", "Use at least 6 characters.");
      hasError = true;
    }
    if (confirm !== password) {
      setFieldError("registerConfirmError", "Passwords don't match.");
      hasError = true;
    }
    if (hasError) return;

    if (findUserByEmail(email)) {
      setFormMessage("registerMessage", "An account with that email already exists. Try logging in instead.");
      return;
    }

    const user = createUser({ name, email, password });
    startUserSession(user);
    window.location.href = "dashboard.html";
  });

  /* ---------- guest ---------- */

  qs("#guestBtn").addEventListener("click", () => {
    startGuestSession();
    window.location.href = "dashboard.html";
  });
})();
