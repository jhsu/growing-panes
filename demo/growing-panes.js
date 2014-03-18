var growingPanes = angular.module('growing-panes', ['ui.router']);

growingPanes.directive('growingPanes', [function() {
  return {
    template: '<div ng-transclude></div>',
    transclude: true,
    controller: ['$scope', '$state', function($scope, $state) {
      var paneLimitDefault = 2;
      $scope.depth = 1;
      $scope.paneLimit = paneLimitDefault;

      var handleState = function(state) {
        // Is there an automatic way to determine depth?
        if (state.data) {
          if (state.data.depth) $scope.depth = state.data.depth;
          if (state.data.paneLimit) $scope.paneLimit = state.data.paneLimit;
        }
        if (!state.data || !state.data.paneLimit) {
          $scope.paneLimit = paneLimitDefault;
        }

      };
      handleState($state.current);

      $scope.$on("$stateChangeSuccess", function(event, toState) {
        handleState(toState);
      });

    }],
  };
}]);

growingPanes.directive('pane', [function() {
  return {
    transclude: true,
    link: function(scope, element, attrs) {
      scope.paneName = attrs.name;
    },
    template: '<div class="pane {{paneName}}-pane" ng-class="paneClass()" ng-show="showPane()"><div ng-transclude></div></div>',
    controller: ['$scope', function($scope) {
      if (!$scope.paneDepth) {
        $scope.paneDepth = 1;
      } else {
        $scope.paneDepth = $scope.paneDepth + 1;
      }

      $scope.paneClass = function() {
        return 'pane-depth-' + $scope.depth;
      };

      $scope.showPane = function() {
        return ($scope.depth - $scope.paneDepth) < $scope.paneLimit;
      };
    }],
  };
}]);
