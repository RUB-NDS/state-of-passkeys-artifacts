// Instance management functions

document.addEventListener('DOMContentLoaded', function() {
  // New instance button
  const newInstanceBtn = document.getElementById('new-instance-btn');
  if (newInstanceBtn) {
    newInstanceBtn.addEventListener('click', async function() {
      if (!confirm('Create a new instance? This will log you out and create fresh data.')) {
        return;
      }

      try {
        const response = await fetch('/api/instance/new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
          alert(`New instance created: ${data.instanceId}`);
          window.location.reload();
        } else {
          alert('Failed to create new instance');
        }
      } catch (error) {
        alert('Error creating new instance: ' + error.message);
      }
    });
  }

  // Reset instance button
  const resetInstanceBtn = document.getElementById('reset-instance-btn');
  if (resetInstanceBtn) {
    resetInstanceBtn.addEventListener('click', async function() {
      if (!confirm('Reset this instance? This will restore all data to default values and log you out.')) {
        return;
      }

      try {
        const response = await fetch('/api/instance/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
          alert('Instance reset to defaults');
          window.location.reload();
        } else {
          alert('Failed to reset instance');
        }
      } catch (error) {
        alert('Error resetting instance: ' + error.message);
      }
    });
  }

  // Delete instance button
  const deleteInstanceBtn = document.getElementById('delete-instance-btn');
  if (deleteInstanceBtn) {
    deleteInstanceBtn.addEventListener('click', async function() {
      if (!confirm('Delete this instance and create a new one? All data will be permanently lost.')) {
        return;
      }

      try {
        const response = await fetch('/api/instance', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
          alert(`Instance deleted. New instance created: ${data.newInstanceId}`);
          window.location.reload();
        } else {
          alert('Failed to delete instance');
        }
      } catch (error) {
        alert('Error deleting instance: ' + error.message);
      }
    });
  }

  // Switch instance button
  const switchInstanceBtn = document.getElementById('switch-instance-btn');
  const switchInstanceInput = document.getElementById('switch-instance-input');

  if (switchInstanceBtn && switchInstanceInput) {
    switchInstanceBtn.addEventListener('click', async function() {
      const instanceId = switchInstanceInput.value.trim();

      if (!instanceId) {
        alert('Please enter an instance ID');
        return;
      }

      // Basic UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(instanceId)) {
        alert('Invalid instance ID format. Please enter a valid UUID.');
        return;
      }

      try {
        const response = await fetch('/api/instance/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceId })
        });

        const data = await response.json();

        if (data.success) {
          const message = data.created
            ? `Switched to new instance: ${data.instanceId}`
            : `Switched to existing instance: ${data.instanceId}`;
          alert(message);
          window.location.reload();
        } else {
          alert(data.error || 'Failed to switch instance');
        }
      } catch (error) {
        alert('Error switching instance: ' + error.message);
      }
    });

    // Allow Enter key to submit
    switchInstanceInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        switchInstanceBtn.click();
      }
    });
  }

  // Copy instance ID button
  const copyInstanceBtn = document.getElementById('copy-instance-btn');
  const currentInstanceId = document.getElementById('current-instance-id');

  if (copyInstanceBtn && currentInstanceId) {
    copyInstanceBtn.addEventListener('click', async function() {
      try {
        await navigator.clipboard.writeText(currentInstanceId.textContent);
        const icon = this.querySelector('i');
        icon.className = 'bi bi-check';
        setTimeout(() => {
          icon.className = 'bi bi-clipboard';
        }, 1000);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    });
  }
});
