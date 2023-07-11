export const ClipboardHelper : any = (function() {
    var textArea : any, copy : any;
    function isOS() {
        return navigator.userAgent.match(/ipad|iphone/i);
    }
    function createTextArea(text : string) {
        textArea = document.createElement('textArea');
        textArea.value = text;
        document.body.appendChild(textArea);
    }
    function selectText() {
        var range : Range, selection : Selection | null;
        if (isOS()) {
            range = document.createRange();
            range.selectNodeContents(textArea);
            selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            textArea.setSelectionRange(0, 999999);
        } else {
            textArea.select();
        }
    }
    function copyToClipboard() {        
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
    copy = function(text : string) {
        // navigator.clipboard.writeText(this.url);
        createTextArea(text);
        selectText();
        copyToClipboard();
    };
    return {
        copy: copy
    };
})();