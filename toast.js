/**
 * toast.js
 * 
 * Reusable toast notification system for Xaytheon.
 */
(function() {
  function createToastContainer() {
    var container = document.getElementById('xaytheon-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'xaytheon-toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type) {
    var container = createToastContainer();
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');

    var text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', function() {
      toast.style.opacity = '0';
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    });
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    // Auto-remove toast after 4 seconds
    setTimeout(function() {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        setTimeout(function() {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }
    }, 4000);
  }

  // Expose toast function globally
  window.XAYTHEON_TOAST = {
    show: showToast,
    success: function(msg) { showToast(msg, 'success'); },
    error: function(msg) { showToast(msg, 'error'); },
    info: function(msg) { showToast(msg, 'info'); }
  };
})();
