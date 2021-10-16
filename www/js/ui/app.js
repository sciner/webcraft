export class UIApp {

    constructor($scope) {
        this.$scope = $scope;
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

}