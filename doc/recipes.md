# Recipes

## Regular recipes
TODO

## Special values
Instead of normal block names, in "item" fields special values can be used. They are automatically replaced with a set of all blocks of that category. Currently implemented: ```special:planks, special:wooden_slab, special:log, special:stem, special:wood, special:hyphae```

## Templates
Templates are stored in the same list as recipes. One template describes a group of similar recipes. A template differs from a regular recipe:
- it has ```"template": <template_name>``` instead of ```"id": <recipe_id>```
- the value of its result item is an object - a result template
- the value of at least one of its ingredient is an object - an ingredient template

In the result and ingredient templates, generally the following applies: 
- block names are not case-sensitive, unless they contain ```:```
- if a list of strings is expected, either a string or an array of strings can be specified
- unless stated otherwise, all properties are optional

### Result template
It's an object that describes which blocks are used as a result. One recipe for each result block is generated. The following properties are supported:
- ```suffix: String or Array(String)``` - mandatory. The suffixes of the blocks. All blocks with these suffixes will be found.
- ```ignore: String or Array(String)``` - the exact names of the result blocks that will be ignored (a blacklist).

For each block found, its name without the suffix - ```baseName``` is calculated. Different prefixes and suffixes are added to it to get the names of the ingredients.

### Ingredient templates
For each result block, based on its name and the ingredient template, some ingredient blocks are found. If for at least one ```"key"``` no ingredients are found, the recipe for that result isn't generated. The following properties are supported:
- ```prefix: String or Array(String)``` - the prefixes of the ingredient blocks that are added to ```baseName```
- ```suffix: String or Array(String)``` - same as above, but for suffixes. All possible combinations of a prefix and a suffix are tested. ```""``` can be specified as a prefix or a suffix.
- ```ignore: String or Array(String)``` - the exact names of the ingredient blocks that will be ignored (a blacklist).
- ```ignore_items: Boolean``` - if it's set to true, blocks with "item" property will be ignored;
- ```manual: Object```. The keys are result block names, and the values are lists of ingredient block names. If it's specified for some result block, then no auto-search is used for this block, and this list is used instead. ```ignore``` and ```ignore_items``` are not checked for these blocks.
- ```additional: Object```. Similar to above, but it doesn't disable auto-search, and used in addition to it.

See the examples in [../www/data/recipes.json](../www/data/recipes.json)