const leetMap = {
    'a': '4', 'b': '8', 'e': '3',
    'g': '6', 'i': '1', 'l': '1',
    'o': '0',
    's': '5', 't': '7',
    'z': '2'
};

function translateToLeet(text) {
    return text
        .toLowerCase()
        .split('')
        .map(char => leetMap[char] || char)
        .join('');
}

// Simple 1D Perlin Noise implementation
const perlin1D = (function () {
    const p = new Uint8Array(512);
    const permutation = new Uint8Array(256);
    for (let i = 0; i < 256; i++) permutation[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    for (let i = 0; i < 512; i++) p[i] = permutation[i % 256];

    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (t, a, b) => a + t * (b - a);
    const grad = (hash, x) => (hash & 1 ? -x : x);

    return function (x) {
        const X = Math.floor(x) & 255;
        x -= Math.floor(x);
        const u = fade(x);
        return lerp(u, grad(p[X], x), grad(p[X + 1], x - 1)) * 2;
    };
})();

module.exports = {
    translateToLeet,
    perlin1D
};
