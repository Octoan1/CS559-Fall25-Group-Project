# Marble Puzzle — Three.js + cannon-es

A simple 3D marble puzzle demo using Three.js for rendering and cannon-es for physics.

Files:
- `index.html` — main page that loads `src/main.js`.
- `src/main.js` — initializes scene, physics, controls, and game logic.
- `styles.css` — minimal UI styling.
- `levels.json` — sample level data.

Run locally:
- With Python 3 (recommended):

```pwsh
# from project root
python -m http.server 8000
# then open http://localhost:8000 in your browser
```

- Or with Node (if you have http-server installed):

```pwsh
npx http-server -c-1
```

Controls:
- Arrow keys or WASD to tilt the board.
- Drag on the canvas (mouse/touch) to tilt on mobile.
- Press `Reset` to restart the marble.

Notes & next steps:
- This demo uses `cannon-es` via CDN for simple collision and rolling physics.
- You can extend `levels.json` and load different levels dynamically.
- Want keyboard-only or tilt-sensor (mobile) controls? I can add those.

Enjoy! If you'd like, I can:
- Add multiple levels and a level select UI.
- Improve visuals (textures, PBR materials).
- Add sound effects and particle effects on goal.
