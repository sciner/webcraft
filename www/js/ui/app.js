export class UIApp {

    constructor($scope) {
        this.$scope = $scope;

        // Clipboard
        window.Clipboard = (function(window, document, navigator) {
            var textArea, copy;
            function isOS() {
                return navigator.userAgent.match(/ipad|iphone/i);
            }
            function createTextArea(text) {
                textArea = document.createElement('textArea');
                textArea.value = text;
                document.body.appendChild(textArea);
            }
            function selectText() {
                var range, selection;
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
            copy = function(text) {
                createTextArea(text);
                selectText();
                copyToClipboard();
            };
            return {
                copy: copy
            };
        })(window, document, navigator);

    }

    logout() {
        localStorage.removeItem('username');
        localStorage.removeItem('session_id');
        this.$scope.current_window.show('hello');
    }

    showError(message) {
        // Multilingual messages
        if(message in this.$scope.lang) {
            message = this.$scope.lang[message];
        }
        alert(message);
    }

    isLogged() {
        return !!this.getSession();
    }

    //
    getSession() {
        if(!this.$scope.Game.session_id) {
            return null;
        }
        return {
            session_id: this.$scope.Game.session_id,
            username: this.$scope.Game.username
        }
    }

}