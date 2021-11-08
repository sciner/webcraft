import {Helpers} from '../helpers.js';

export class DemoMapManager {

    constructor($scope, $timeout) {
        this.$scope         = $scope;
        this.$timeout       = $timeout;
        this.loading        = false;
        this.map_running    = false;
        this.list           = [];
    }

    load() {
        let that = this;
        that.loading = true;
        Helpers.loadJSON('./data/demo_maps.json', function(response) {
            that.$timeout(function() {
                that.list = response;
                that.loading = false;
            });
        });
    }

    run(item) {
        console.log(34567);
        let that = this;
        let $scope = this.$scope;
        $scope.settings.save();
        that.map_running = true;
        this.$timeout(function() {
            $scope.boot.saves.load(item.id, function(row) {
                $scope.Game.initGame(row, $scope.settings.form);
            }, function(err) {
                Helpers.loadJSON(item.url, function(row) {
                    that.$timeout(function(){
                        $scope.Game.initGame(row, $scope.settings.form);
                    });
                });
            });
        }, 0);
    }

}