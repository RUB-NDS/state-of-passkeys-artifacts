// Verifier management functions

async function switchVerifier(verifierId, target) {
  try {
    const response = await fetch('/verifiers/api/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifierId: parseInt(verifierId, 10), target })
    });

    const data = await response.json();

    if (data.success) {
      window.location.reload();
    } else {
      alert(data.error || 'Failed to switch verifier');
    }
  } catch (error) {
    alert('Error switching verifier: ' + error.message);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Auth verifier select dropdown
  const authVerifierSelect = document.getElementById('auth-verifier-select');
  if (authVerifierSelect) {
    authVerifierSelect.addEventListener('change', async function() {
      const verifierId = this.value;
      if (verifierId) {
        await switchVerifier(verifierId, 'authentication');
      }
    });
  }

  // Reg verifier select dropdown
  const regVerifierSelect = document.getElementById('reg-verifier-select');
  if (regVerifierSelect) {
    regVerifierSelect.addEventListener('change', async function() {
      const verifierId = this.value;
      if (verifierId) {
        await switchVerifier(verifierId, 'registration');
      }
    });
  }
});
