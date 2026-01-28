// Passkey registration and authentication functions
// Uses @simplewebauthn/browser which is loaded via CDN

function showPasskeyStatus(type, message) {
  const statusDiv = document.getElementById('passkey-status');
  const alertDiv = document.getElementById('passkey-alert');
  const messageSpan = document.getElementById('passkey-message');

  if (!statusDiv || !alertDiv || !messageSpan) return;

  statusDiv.style.display = 'block';
  alertDiv.className = 'alert alert-' + (type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info');
  messageSpan.textContent = message;
}

function showFlag(flag, message) {
  // Legacy function for backwards compatibility
  const flagDisplay = document.getElementById('flag-display');
  const capturedFlag = document.getElementById('captured-flag');
  const flagMessage = document.getElementById('flag-message');

  if (!flagDisplay || !capturedFlag) return;

  flagDisplay.style.display = 'block';
  capturedFlag.textContent = flag;
  if (flagMessage && message) {
    flagMessage.textContent = message;
  }
}

function showReward(reward, onDismiss) {
  // Show the reward modal with flag card and confetti
  if (typeof showRewardModal === 'function') {
    showRewardModal(reward, onDismiss);
  } else {
    // Fallback if modal not available
    console.log('Reward:', reward);
    if (onDismiss) onDismiss();
  }
}

async function passkeyRegister(options = {}) {
  const { name } = options;

  try {
    showPasskeyStatus('info', 'Starting passkey registration...');

    // Get registration options from server
    const optionsResponse = await fetch('/api/passkey/registration/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      throw new Error(error.error || 'Failed to get registration options');
    }

    const { options: registrationOptions, verifier } = await optionsResponse.json();

    showPasskeyStatus('info', `Using verifier: ${verifier.id} (${verifier.algorithm})`);

    // Create credential using WebAuthn API
    const credential = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: registrationOptions });

    showPasskeyStatus('info', 'Verifying registration...');

    // Verify with server
    const verifyResponse = await fetch('/api/passkey/registration/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, name })
    });

    const result = await verifyResponse.json();

    // Check for reward even if verification failed (exploit detection)
    if (result.reward) {
      showPasskeyStatus('success', result.error || 'Exploit detected!');
      showReward(result.reward, () => {
        window.location.reload();
      });
      return result;
    }

    if (!result.verified) {
      throw new Error(result.error || 'Verification failed');
    }

    showPasskeyStatus('success', `Passkey "${result.passkey.name}" registered successfully!`);

    // Show reward modal if present (don't auto-refresh)
    if (result.reward) {
      showReward(result.reward, () => {
        // Refresh page when user dismisses the modal
        window.location.reload();
      });
    } else {
      // No reward, can refresh to show new passkey
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }

    return result;

  } catch (error) {
    console.error('Passkey registration error:', error);

    // Handle user cancellation
    if (error.name === 'NotAllowedError') {
      showPasskeyStatus('error', 'Registration was cancelled or not allowed');
    } else {
      showPasskeyStatus('error', error.message || 'Registration failed');
    }

    throw error;
  }
}

async function passkeyAuthenticate(options = {}) {
  const { username, discoverable = true, conditionalUI = false, twoFactor = false } = options;

  try {
    if (!conditionalUI) {
      showPasskeyStatus('info', 'Starting passkey authentication...');
    }

    // Get authentication options from server
    const optionsResponse = await fetch('/api/passkey/authentication/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      throw new Error(error.error || 'Failed to get authentication options');
    }

    const { options: authOptions, verifier } = await optionsResponse.json();

    if (!conditionalUI) {
      showPasskeyStatus('info', `Using verifier: ${verifier.id}`);
    }

    // Authenticate using WebAuthn API
    let credential;
    if (conditionalUI) {
      // Conditional UI / Autofill
      credential = await SimpleWebAuthnBrowser.startAuthentication({
        optionsJSON: authOptions,
        useBrowserAutofill: true
      });
    } else {
      credential = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: authOptions });
    }

    showPasskeyStatus('info', 'Verifying authentication...');

    // Verify with server
    const verifyResponse = await fetch('/api/passkey/authentication/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    });

    const result = await verifyResponse.json();

    // Check for reward even if verification failed (exploit detection)
    if (result.reward) {
      showPasskeyStatus('success', result.error || 'Exploit detected!');
      showReward(result.reward, () => {
        // Redirect to flags page when user dismisses the modal
        window.location.href = '/flags';
      });
      return result;
    }

    if (!result.verified) {
      throw new Error(result.error || 'Verification failed');
    }

    showPasskeyStatus('success', `Welcome back, ${result.user.username}!`);

    // Show reward modal if present (successful verification with exploit)
    if (result.reward) {
      showReward(result.reward, () => {
        // Redirect to flags page when user dismisses the modal
        window.location.href = '/flags';
      });
      return result;
    }

    // Redirect to home page
    setTimeout(() => {
      window.location.href = '/flags';
    }, 1000);

    return result;

  } catch (error) {
    console.error('Passkey authentication error:', error);

    // Handle user cancellation
    if (error.name === 'NotAllowedError') {
      if (!conditionalUI) {
        showPasskeyStatus('error', 'Authentication was cancelled or not allowed');
      }
    } else if (error.name === 'AbortError') {
      // Conditional UI was aborted, ignore
    } else {
      showPasskeyStatus('error', error.message || 'Authentication failed');
    }

    throw error;
  }
}

// Check if WebAuthn is supported
function isWebAuthnSupported() {
  return window.PublicKeyCredential !== undefined;
}

// Check if conditional UI is available
async function isConditionalUIAvailable() {
  if (!isWebAuthnSupported()) return false;
  if (typeof PublicKeyCredential.isConditionalMediationAvailable !== 'function') return false;
  return await PublicKeyCredential.isConditionalMediationAvailable();
}
