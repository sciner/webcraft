/**
 * String formater - aka C#
 */
export default function (app) {
    app.filter('textfilter', [function() {
        return function (input) {
        if (arguments.length > 1) {
            // If we have more than one argument (insertion values have been given)
            var str = input;
            // Loop through the values we have been given to insert
            for (var i = 1; i < arguments.length; i++) {
            // Compile a new Regular expression looking for {0}, {1} etc in the input string
            var reg = new RegExp("\\{" + (i-1) + "\\}");
            // Perform the replace with the compiled RegEx and the value
            str = str.replace(reg, arguments[i]);
            }
            return str;
        }
        
        return input;
        };
    }]);
    /**
     * filter to allow html
     */
    app.filter("trust", ['$sce', function($sce) {
        return function(htmlCode){
          return $sce.trustAsHtml(htmlCode);
        }
      }]);
}