// Load supported block styles
export let features = [];
await fetch('/vendors/prismarine-physics/lib/features.json').then(response => response.json()).then(json => {
    features = json;
});