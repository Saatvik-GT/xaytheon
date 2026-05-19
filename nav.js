function initMobileNavigation() {
  var navbars = document.querySelectorAll('.navbar');

  for (var i = 0; i < navbars.length; i++) {
    var navbar = navbars[i];
    if (navbar.getAttribute('data-mobile-nav-ready') === 'true') continue;

    var toggle = navbar.querySelector('.hamburger');
    var menu = navbar.querySelector('.nav-menu');

    if (!toggle || !menu) continue;

    navbar.setAttribute('data-mobile-nav-ready', 'true');

    setupMobileNavigation(toggle, menu);
  }
}

function setupMobileNavigation(toggle, menu) {
  function closeMenu() {
    menu.classList.remove('active');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', function() {
    var isOpen = menu.classList.toggle('active');
    toggle.classList.toggle('active', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  menu.addEventListener('click', function(event) {
    if (event.target.classList.contains('nav-link')) {
      closeMenu();
    }
  });

  window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      closeMenu();
      toggle.focus();
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  initMobileNavigation();

  var observer = new MutationObserver(function() {
    initMobileNavigation();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
});
