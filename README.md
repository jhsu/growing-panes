# growing-panes

An AngularJS directive for limiting the number of views shown.

## Usage


To show only the two deepest states at a time:

```javascript
$stateProvider
.state('home', {
  url: '/home',
  templateUrl: '/templates/home.html',
  data: {depth: 1},
})
.state('home.details', {
  url: '/details',
  templateUrl: '/templates/home.details.html',
  data: {depth: 2},
})
.state('home.details.form', {
  url: '/form',
  templateUrl: '/templates/home.details.form.html',
  data: {depth: 3},
})
;
```

```html
<div growing-panes>
  <div ui-view class="container"></div>
</div>
```

The limited number of views to show can be adjusted by setting `paneLimit` in
the data to a different value (the default is `2`).

## Dependencies

- angular.js
- ui-router
