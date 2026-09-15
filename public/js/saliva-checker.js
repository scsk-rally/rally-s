(function () {
  'use strict';
  var params = new URLSearchParams(window.location.search);
  var returnNav = document.getElementById('salivaMenuReturn');
  if (returnNav && params.get('fromMenu') === '1') returnNav.hidden = false;
}());
