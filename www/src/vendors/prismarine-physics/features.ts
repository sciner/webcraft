// Load supported block styles
export let features = [];
await fetch('/src/prismarine-physics/lib/features.json').then(response => response.json()).then(json => {
    features = json;
});