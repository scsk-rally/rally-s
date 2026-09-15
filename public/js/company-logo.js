(function (global) {
  'use strict';
  var cache = new Map();
  function fittedSource(url) {
    if (cache.has(url)) return cache.get(url);
    var result = new Promise(function (resolve) {
      var source = new Image();
      source.crossOrigin = 'anonymous';
      source.onload = function () {
        try {
          // Bound pixel work for large uploads; keep the original file unchanged.
          var scale = Math.min(1, 1200 / Math.max(source.naturalWidth, source.naturalHeight));
          var width = Math.max(1, Math.round(source.naturalWidth * scale));
          var height = Math.max(1, Math.round(source.naturalHeight * scale));
          var canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          var context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(source, 0, 0, width, height);
          var pixels = context.getImageData(0, 0, width, height).data;
          function white(i) { return pixels[i] >= 245 && pixels[i + 1] >= 245 && pixels[i + 2] >= 245 && pixels[i + 3] > 8; }
          // Only trim white when all four corners are white, never a colored backdrop.
          var whiteBackground = [0, (width - 1) * 4, (height - 1) * width * 4, (width * height - 1) * 4].every(white);
          var left = width, top = height, right = -1, bottom = -1;
          for (var y = 0; y < height; y++) for (var x = 0; x < width; x++) {
            var i = (y * width + x) * 4;
            if (pixels[i + 3] <= 8 || (whiteBackground && white(i))) continue;
            left = Math.min(left, x); right = Math.max(right, x);
            top = Math.min(top, y); bottom = Math.max(bottom, y);
          }
          if (right < left || bottom < top) return resolve(url);
          var padding = Math.max(2, Math.ceil(Math.max(right - left + 1, bottom - top + 1) * 0.015));
          left = Math.max(0, left - padding); top = Math.max(0, top - padding);
          right = Math.min(width - 1, right + padding); bottom = Math.min(height - 1, bottom + padding);
          if (left === 0 && top === 0 && right === width - 1 && bottom === height - 1) return resolve(url);
          var output = document.createElement('canvas');
          output.width = right - left + 1; output.height = bottom - top + 1;
          output.getContext('2d').drawImage(canvas, left, top, output.width, output.height, 0, 0, output.width, output.height);
          resolve(output.toDataURL('image/png'));
        } catch (error) { resolve(url); }
      };
      source.onerror = function () { resolve(url); };
      source.src = url;
    });
    cache.set(url, result);
    return result;
  }
  global.EfukuriCompanyLogo = {
    apply: function (image, url) {
      image.dataset.logoSource = url;
      if (!url) { image.removeAttribute('src'); return Promise.resolve(); }
      image.src = url;
      return fittedSource(url).then(function (source) {
        // Upload/remove/edit actions can overtake a slow image request.
        if (image.dataset.logoSource === url) image.src = source;
      });
    }
  };
})(window);
