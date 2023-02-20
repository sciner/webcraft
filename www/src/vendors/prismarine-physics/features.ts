// Load supported block styles
export let features = [];
await fetch('/src/vendors/prismarine-physics/lib/features.json').then(response => response.json()).then(json => {
    features = json;
});