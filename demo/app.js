window.GrowingPanes = angular.module('GrowingPanes', [
  'ngRoute', 'ngAnimate', 'ui.router',
  'growing-panes'
]);

GrowingPanes.config(function($stateProvider, $urlRouterProvider){

  $urlRouterProvider.otherwise("home");

  $stateProvider
  .state('home', {
    url: '/home',
    templateUrl: './home.html',
    controller: ['$scope', '$state', function($scope, $state) {
      $scope.state = $state;
    }],
    data: {depth: 1},
  })
  .state('home.details', {
    url: '/details',
    templateUrl: './home.details.html',
    data: {depth: 2},
  })
  .state('home.details.form', {
    url: '/form',
    templateUrl: './home.details.form.html',
    data: {depth: 3},
  })
  .state('home.details.form.preview', {
    url: '/preview',
    templateUrl: './home.details.form.preview.html',
    data: {depth: 4, paneLimit: 3},
  })
  ;
}).run([function() {
}]
);
