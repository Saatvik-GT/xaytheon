window.addEventListener('DOMContentLoaded', function() {

  var bookmarkList = document.getElementById('bookmark-list');

  var bookmarks = JSON.parse(localStorage.getItem('bookmarkedRepos')) || [];

  if (bookmarks.length === 0) {
    bookmarkList.innerHTML =
      '<div class="muted">No bookmarked repositories yet.</div>';
    return;
  }

  function renderBookmarks() {

    bookmarkList.innerHTML = '';

    bookmarks.forEach(function(repo, index) {

      var repoCard =
        '<div class="repo-item">' +

          '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">' +

            '<div>' +

              '<div class="repo-name">' +
                '<a href="' + repo.url + '" target="_blank">' +
                  repo.name +
                '</a>' +
              '</div>' +

              '<div class="repo-desc">' +
                (repo.description || 'No description available.') +
              '</div>' +

              '<div class="repo-meta">' +
                '<span>' + (repo.language || 'Unknown') + '</span>' +
              '</div>' +

            '</div>' +

            '<button class="bookmark-btn remove-btn" data-index="' + index + '">' +
              '❌ Remove' +
            '</button>' +

          '</div>' +

        '</div>';

      bookmarkList.innerHTML += repoCard;

    });

  }

  renderBookmarks();

  bookmarkList.addEventListener('click', function(event) {

    if (event.target.classList.contains('remove-btn')) {

      var index = event.target.dataset.index;

      bookmarks.splice(index, 1);

      localStorage.setItem(
        'bookmarkedRepos',
        JSON.stringify(bookmarks)
      );

      renderBookmarks();

    }

  });

});