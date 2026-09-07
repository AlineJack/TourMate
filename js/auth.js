/* =========================================================
   auth.js — logic for login.html only

   Firebase Authentication

   New accounts must verify their email before entering TourMate.
   Verified accounts log in normally; verification is not requested
   again after the email has been verified.
   ========================================================= */

(function () {

  const card = document.querySelector(".auth-card");

  if (card) {
    card.style.visibility = "hidden";
  }

  // Prevent initAuthUI() from attaching duplicate listeners.
  let uiInitialized = false;
  let registrationInProgress = false;

  /* ========================================================
     FIREBASE AUTH STATE
  ======================================================== */

  auth.onAuthStateChanged(function (firebaseUser) {

    if (firebaseUser) {

      // During a brand-new registration, do NOT redirect.
      // The registration flow must first send the verification email
      // and sign the user out before they can use the app.
      if (registrationInProgress) {
        if (card) {
          card.style.visibility = "visible";
        }

        if (!uiInitialized) {
          uiInitialized = true;
          initAuthUI();
        }

        return;
      }

      // Existing signed-in account. Only verified accounts may enter
      // the app. Once verified, normal logins never ask for verification.
      if (!firebaseUser.emailVerified) {

        auth.signOut().catch(function (error) {
          console.error("Sign-out for unverified account failed:", error);
        }).finally(function () {
          if (card) {
            card.style.visibility = "visible";
          }

          if (!uiInitialized) {
            uiInitialized = true;
            initAuthUI();
          }
        });

        return;
      }

      syncSessionFromFirebase(firebaseUser);
      window.location.href = "dashboard.html";
      return;
    }

    // No Firebase session.
    // IMPORTANT: A guest session may already exist when the user
    // arrives here from Profile -> "Create free account".
    // Do NOT redirect a guest back to the dashboard; the guest
    // must be able to see and submit the registration form.

    // Nobody signed in (or a guest is intentionally on this page)
    // — show the form.
    if (card) {
      card.style.visibility = "visible";
    }

    if (!uiInitialized) {
      uiInitialized = true;
      initAuthUI();
    }
  });

  /* ========================================================
     AUTH PAGE UI
  ======================================================== */

  function initAuthUI() {

    const tabLoginBtn = qs("#tabLoginBtn");
    const tabRegisterBtn = qs("#tabRegisterBtn");

    const loginForm = qs("#loginForm");
    const registerForm = qs("#registerForm");

    /* ======================================================
       TAB SWITCHING
    ====================================================== */

    function showTab(tab) {

      const isLogin = tab === "login";

      tabLoginBtn.classList.toggle("active", isLogin);
      tabRegisterBtn.classList.toggle("active", !isLogin);

      loginForm.classList.toggle("active", isLogin);
      registerForm.classList.toggle("active", !isLogin);
    }

    tabLoginBtn.addEventListener("click", function () {
      showTab("login");
    });

    tabRegisterBtn.addEventListener("click", function () {
      showTab("register");
    });

    // Open requested tab from URL.
    const params = new URLSearchParams(window.location.search);

    showTab(
      params.get("tab") === "register"
        ? "register"
        : "login"
    );

    /* ======================================================
       SHARED HELPERS
    ====================================================== */

    function setFieldError(id, message) {

      const el = qs("#" + id);

      if (el) {
        el.textContent = message || "";
      }
    }

    function setFormMessage(id, message, type) {

      const el = qs("#" + id);

      if (!el) return;

      const messageType = type || "error";

      el.textContent = message || "";
      el.classList.remove("error", "success");
      el.classList.add(messageType);
      el.classList.toggle("show", Boolean(message));
    }

    /* ---------- practical email validation ---------- */

    function isValidEmail(value) {

      return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(value);
    }

    /* ---------- button loading ---------- */

    function setButtonLoading(btn, loading, originalText) {

      if (!btn) return;

      btn.disabled = loading;

      btn.textContent = loading
        ? "Please wait…"
        : originalText;
    }

    /* ======================================================
       LOGIN
    ====================================================== */

    loginForm.addEventListener("submit", function (e) {

      e.preventDefault();

      setFormMessage("loginMessage", "");

      setFieldError("loginEmailError", "");
      setFieldError("loginPasswordError", "");

      const email = qs("#loginEmail").value.trim();
      const password = qs("#loginPassword").value;

      let hasError = false;

      /* ---------- validate email ---------- */

      if (!isValidEmail(email)) {

        setFieldError(
          "loginEmailError",
          "Enter a valid email address."
        );

        hasError = true;
      }

      /* ---------- validate password ---------- */

      if (!password) {

        setFieldError(
          "loginPasswordError",
          "Enter your password."
        );

        hasError = true;
      }

      if (hasError) {
        return;
      }

      const submitBtn =
        loginForm.querySelector("button[type=submit]");

      setButtonLoading(
        submitBtn,
        true,
        "Log in"
      );

      /* ---------- Firebase login ---------- */

      auth.signInWithEmailAndPassword(
        email,
        password
      )

        .then(function (userCredential) {

          const user = userCredential.user;

          // Make sure we have the latest verification status.
          return user.reload().then(function () {

            if (!user.emailVerified) {

              return auth.signOut().then(function () {

                setButtonLoading(
                  submitBtn,
                  false,
                  "Log in"
                );

                showTab("login");

                setFormMessage(
                  "loginMessage",
                  "Your email is not verified yet. Please verify the email address you used when creating your TourMate account, then log in again.",
                  "error"
                );

              });
            }

            // Verified accounts log in normally. No verification
            // email or verification screen is shown here.
            syncSessionFromFirebase(user);
            window.location.href = "dashboard.html";
          });
        })

        .catch(function (error) {

          setButtonLoading(
            submitBtn,
            false,
            "Log in"
          );

          switch (error.code) {

            case "auth/user-not-found":
            case "auth/wrong-password":
            case "auth/invalid-credential":

              setFormMessage(
                "loginMessage",
                "Incorrect email or password. Please try again."
              );

              break;

            case "auth/too-many-requests":

              setFormMessage(
                "loginMessage",
                "Too many failed attempts. Please wait a moment and try again."
              );

              break;

            case "auth/invalid-email":

              setFieldError(
                "loginEmailError",
                "Enter a valid email address."
              );

              break;

            default:

              console.error(
                "Login error:",
                error
              );

              setFormMessage(
                "loginMessage",
                "Something went wrong. Please try again."
              );
          }
        });
    });

    /* ======================================================
       REGISTER
    ====================================================== */

    registerForm.addEventListener("submit", function (e) {

      e.preventDefault();

      setFormMessage("registerMessage", "");

      [
        "registerNameError",
        "registerEmailError",
        "registerPasswordError",
        "registerConfirmError"
      ].forEach(function (id) {

        setFieldError(id, "");
      });

      const name =
        qs("#registerName").value.trim();

      const email =
        qs("#registerEmail").value.trim();

      const password =
        qs("#registerPassword").value;

      const confirm =
        qs("#registerConfirm").value;

      let hasError = false;

      /* ---------- validate name ---------- */

      if (name.length < 2) {

        setFieldError(
          "registerNameError",
          "Enter your name."
        );

        hasError = true;
      }

      /* ---------- validate email ---------- */

      if (!isValidEmail(email)) {

        setFieldError(
          "registerEmailError",
          "Enter a valid email address."
        );

        hasError = true;
      }

      /* ---------- validate password ---------- */

      if (password.length < 6) {

        setFieldError(
          "registerPasswordError",
          "Use at least 6 characters."
        );

        hasError = true;
      }

      /* ---------- confirm password ---------- */

      if (confirm !== password) {

        setFieldError(
          "registerConfirmError",
          "Passwords don't match."
        );

        hasError = true;
      }

      if (hasError) {
        return;
      }

      const submitBtn =
        registerForm.querySelector(
          "button[type=submit]"
        );

      setButtonLoading(
        submitBtn,
        true,
        "Create account"
      );

      /* ---------- Firebase registration ---------- */

      // Tell onAuthStateChanged not to redirect the brand-new user
      // while the verification email is being sent.
      registrationInProgress = true;

      auth.createUserWithEmailAndPassword(
        email,
        password
      )

        .then(function (userCredential) {

          const user = userCredential.user;

          // Firebase creates the Auth user first; then we require
          // email verification before allowing access to TourMate.
          return user.updateProfile({
            displayName: name
          })

          .catch(function (profileError) {

            console.error(
              "Profile update failed:",
              profileError
            );

            // Continue even if the display-name update fails.
          })

          .then(function () {

            return user.sendEmailVerification();
          })

          .then(function () {

            // A guest may already have saved trips on this device.
            // Transfer those trips to the new Firebase account before
            // ending the newly-created Firebase session.
            migrateGuestToursToOwner(user.uid);

            // Do not keep the new account signed in. The user must
            // verify the email first, then return to the Log in tab.
            return auth.signOut();
          })

          .then(function () {

            registrationInProgress = false;

            setButtonLoading(
              submitBtn,
              false,
              "Create account"
            );

            showTab("register");

            setFormMessage(
              "registerMessage",
              "Account created. We sent a verification link to " + email + ". Please verify your email, then use the Log in tab to enter TourMate.",
              "success"
            );

          })

          .catch(function (verificationError) {

            // The Firebase account may already exist, but the user
            // must not be allowed into the app without verification.
            console.error(
              "Registration verification step failed:",
              verificationError
            );

            registrationInProgress = false;

            return auth.signOut().catch(function (signOutError) {
              console.error(
                "Sign-out after verification failure failed:",
                signOutError
              );
            }).finally(function () {

              setButtonLoading(
                submitBtn,
                false,
                "Create account"
              );

              setFormMessage(
                "registerMessage",
                "Your account was created, but we could not send the verification email. Please try again later or use password reset/support to recover this account.",
                "error"
              );
            });
          });
        })

        .catch(function (error) {

          registrationInProgress = false;

          /*
             This catch handles failures that happen during actual
             account creation.
          */

          setButtonLoading(
            submitBtn,
            false,
            "Create account"
          );

          switch (error.code) {

            case "auth/email-already-in-use":

              setFormMessage(
                "registerMessage",
                "An account with that email already exists. Try logging in instead."
              );

              break;

            case "auth/invalid-email":

              setFieldError(
                "registerEmailError",
                "Enter a valid email address."
              );

              break;

            case "auth/weak-password":

              setFieldError(
                "registerPasswordError",
                "Use at least 6 characters."
              );

              break;

            case "auth/too-many-requests":

              setFormMessage(
                "registerMessage",
                "Too many attempts. Please wait a moment and try again."
              );

              break;

            default:

              console.error(
                "Registration error:",
                error
              );

              setFormMessage(
                "registerMessage",
                "Something went wrong. Please try again."
              );
          }
        });
    });

    /* ======================================================
       GUEST
    ====================================================== */

    qs("#guestBtn").addEventListener(
      "click",
      function () {

        /*
           Prevent a Firebase session and guest session from
           existing at the same time.
        */

        auth.signOut()

          .catch(function (error) {

            console.error(
              "Firebase sign-out before guest failed:",
              error
            );
          })

          .finally(function () {

            startGuestSession();

            window.location.href = "dashboard.html";
          });
      }
    );
  }

})();