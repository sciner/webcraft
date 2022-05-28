const SPRITE_SIZE   = 32;
const focuser       = document.getElementById('focuser');
const hover         = document.getElementById('hover');
const inventory     = document.getElementById('inventory');
const dropZone      = document.getElementById('dropZone');
const ctx           = inventory.getContext('2d');

// Load spitesheet
const image = new Image();
image.onload = function () {
    ctx.drawImage(image, 0, 0);
};
image.onError = function () {
    alert('image not found');
};
image.src = '/resource_packs/base/textures/default.png';

inventory.onmousemove = function(e) {
    let x = e.offsetX;
    let y = e.offsetY;
    x = Math.floor(x / SPRITE_SIZE);
    y = Math.floor(y / SPRITE_SIZE);
    let pos = y * SPRITE_SIZE + x;
    hover.style.left = x * SPRITE_SIZE + 'px';
    hover.style.top = y * SPRITE_SIZE + 'px';
}

inventory.onmousedown = function(e) {
    let x = e.offsetX;
    let y = e.offsetY;
    x = Math.floor(x / SPRITE_SIZE);
    y = Math.floor(y / SPRITE_SIZE);
    let pos = y * SPRITE_SIZE + x;
    document.getElementById('x').value = x;
    document.getElementById('y').value = y;
    document.getElementById('pos').value = pos;
    focuser.style.left = x * SPRITE_SIZE + 'px';
    focuser.style.top = y * SPRITE_SIZE + 'px';
}

// Canvas download
function downloadBlobPNG(blob, filename) {
    /// create an "off-screen" anchor tag
    let lnk = document.createElement('a'), e;
    /// the key here is to set the download attribute of the a tag
    lnk.download = filename;
    /// convert canvas content to data-uri for link. When download
    /// attribute is set the content pointed to by link will be
    /// pushed as "download" in HTML5 capable browsers
    lnk.href = URL.createObjectURL(blob);
    /// create a "fake" click-event to trigger the download
    if (document.createEvent) {
        e = document.createEvent('MouseEvents');
        e.initMouseEvent('click', true, true, window,
        0, 0, 0, 0, 0, false, false, false,
        false, 0, null);
        lnk.dispatchEvent(e);
    } else if (lnk.fireEvent) {
        lnk.fireEvent('onclick');
    }
}

// Optional.
// Show the copy icon when dragging over.  Seems to only work for chrome.
dropZone.addEventListener('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    let x = e.offsetX;
    let y = e.offsetY;
    x = Math.floor(x / SPRITE_SIZE);
    y = Math.floor(y / SPRITE_SIZE);
    hover.style.left = x * SPRITE_SIZE + 'px';
    hover.style.top = y * SPRITE_SIZE + 'px';
});

// Get file data on drop
dropZone.addEventListener('drop', function(e) {
    e.stopPropagation();
    e.preventDefault();
    let x = e.offsetX;
    let y = e.offsetY;
    x = Math.floor(x / SPRITE_SIZE);
    y = Math.floor(y / SPRITE_SIZE);
    console.log(x, y)
    var files = e.dataTransfer.files; // Array of all files
    for (let i = 0, file; file = files[i]; i++) {
        if (file.type.match(/image.*/)) {
            const filename = file.name.split('.')[0]
            var reader = new FileReader();
            reader.onload = function(e2) {
                // finished reading file data.
                var img = document.createElement('img');
                img.src = e2.target.result;
                img.onload = () => controller.new_sprites.add(img, filename, x, y)
            }
            reader.readAsDataURL(file); // start reading the file data.
        }
        break;
    }
});