# hyperAnalytics
Data transformations on arrays of uniform objects.

#### 0.11.0

Breaking changes:
1. The default `headerify` behavior is now an unopinionated pass-through.
2. The `headerify` module has been upgraded to an API.
 
To force the internal modules to use the previous behavior, issue the following statement before use:

```javascript
headerify.transform = headerify.capitalize;
```

For backwards compatibility, the following deprecated usage still works as before, providing the expected capitalize behavior:

```javascript
header = headerify(field);
```

However, the new usage is used internally by the data source modules:

```javascript
header = headerify.transform(field);
```

This uses the `transform` method, which by default is set to the unopinionated `headerify.passthrough` which returns its input.
