export class BBModel_DropPaste {

    /** 
     * @param { import("../game.js").GameClass } game
     */
    constructor(game) {

        this.game = game;

        var dropZone = document.getElementById('qubatchRenderSurface');
        // Optional.   Show the copy icon when dragging over.  Seems to only work for chrome.
        dropZone.addEventListener('dragover', function(e) {
            e.stopPropagation();
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        // Get file data on drop
        dropZone.addEventListener('drop', function(e) {
            e.stopPropagation();
            e.preventDefault();
            var files = e.dataTransfer.files; // Array of all files
            for (var i=0, file; file=files[i]; i++) {
                if(file.name.endsWith('.bbmodel')) {
                    console.log(file)
                    var reader = new FileReader();
                    reader.onload = function(e2) {
                        var result = JSON.parse(this.result);
                        console.log(result)
                        // finished reading file data.
                        // var img = document.createElement('img');
                        // img.src= e2.target.result;
                        // document.body.appendChild(img);
                    }
                    reader.readAsText(file); // start reading the file data.
                }
            }
        });

    }

}