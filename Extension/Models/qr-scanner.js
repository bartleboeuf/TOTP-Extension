function processImageForQR(img) {
  try {
    // Versuche mehrere Varianten: skaliert und rotierte Versionen
    const maxDim = 1000; // maximal zu verarbeitende Kantenlänge
    const origW = img.width;
    const origH = img.height;
    const scale = Math.min(1, maxDim / Math.max(origW, origH));

    const off = document.createElement('canvas');
    off.width = Math.round(origW * scale);
    off.height = Math.round(origH * scale);
    const ctx = off.getContext('2d');

    // Canvas für Debug-Ausgabe in der UI
    let debugCanvas = document.getElementById('qrDebugCanvas');
    if (!debugCanvas) {
      debugCanvas = document.createElement('canvas');
      debugCanvas.id = 'qrDebugCanvas';
      debugCanvas.style.maxWidth = '100%';
      debugCanvas.style.border = '1px solid #ccc';
      debugCanvas.style.marginTop = '8px';
    }

    let found = null;
    const rotations = [0, 90, 180, 270];
    for (let r = 0; r < rotations.length; r++) {
      const rot = rotations[r];
      // Set canvas size for rotation
      if (rot === 90 || rot === 270) {
        off.width = Math.round(origH * scale);
        off.height = Math.round(origW * scale);
      } else {
        off.width = Math.round(origW * scale);
        off.height = Math.round(origH * scale);
      }

      // Clear and draw rotated image
      ctx.save();
      ctx.clearRect(0, 0, off.width, off.height);
      if (rot === 0) {
        ctx.drawImage(img, 0, 0, off.width, off.height);
      } else {
        // rotate about center
        ctx.translate(off.width / 2, off.height / 2);
        ctx.rotate((rot * Math.PI) / 180);
        if (rot === 90) ctx.drawImage(img, -off.height / 2, -off.width / 2, off.height, off.width);
        else if (rot === 180) ctx.drawImage(img, -off.width / 2, -off.height / 2, off.width, off.height);
        else if (rot === 270) ctx.drawImage(img, -off.height / 2, -off.width / 2, off.height, off.width);
      }
      ctx.restore();

      try {
        const imageData = ctx.getImageData(0, 0, off.width, off.height);
        console.debug('jsQR attempt', { width: off.width, height: off.height, rotation: rot });
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        // Zeichne Debug-Canvas
        debugCanvas.width = off.width;
        debugCanvas.height = off.height;
        const dctx = debugCanvas.getContext('2d');
        dctx.putImageData(imageData, 0, 0);

        if (code && code.data) {
          // optional: markiere erkannte Position
          if (code.location) {
            dctx.strokeStyle = 'red';
            dctx.lineWidth = 3;
            const drawLine = (a, b) => { dctx.beginPath(); dctx.moveTo(a.x, a.y); dctx.lineTo(b.x, b.y); dctx.stroke(); };
            drawLine(code.location.topLeftCorner, code.location.topRightCorner);
            drawLine(code.location.topRightCorner, code.location.bottomRightCorner);
            drawLine(code.location.bottomRightCorner, code.location.bottomLeftCorner);
            drawLine(code.location.bottomLeftCorner, code.location.topLeftCorner);
          }
          found = code;
          break;
        }
      } catch (ex) {
        console.warn('Error while running jsQR on rotated image', ex);
      }
    }

    if (found && found.data) {
      return found.data;
    } else {
      console.error('no qr-code found in picture');
    }
  } catch (err) {
    console.error(err.message);
  }
}