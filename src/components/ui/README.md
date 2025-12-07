# Game UI Components

This directory contains fixed-position Vue components that overlay the 3D game canvas.

## Components

### SpeedIndicator.vue

Displays the player's current speed with:

- Large numeric speed display
- Progress bar showing speed relative to max
- Max speed reference

**Position:** Bottom-left
**Color Scheme:** Cyan/Blue

### ThrottleIndicator.vue

Shows the current throttle level with:

- Vertical bar fill visualization
- Percentage display
- Reference markers

**Position:** Bottom-left (next to speed)
**Color Scheme:** Orange/Yellow

### OrientationIndicator.vue

Displays ship orientation with:

- Attitude indicator (artificial horizon)
- Pitch, roll, and yaw values in degrees
- Visual roll indicator that changes color based on severity

**Position:** Top-right
**Color Scheme:** Green

### ControlsDisplay.vue

Static reference showing keyboard controls:

- Flight controls (WASD, Q/E)
- Thrust controls (Shift/Ctrl)

**Position:** Top-left
**Color Scheme:** Blue

## Design Pattern

All UI components follow this pattern:

1. **Fixed Positioning**: Components use `position: fixed` with specific pixel offsets
2. **Glass-morphism Style**: Semi-transparent backgrounds with backdrop blur
3. **Sci-fi Aesthetic**: Monospace fonts, glowing borders, neon colors
4. **Non-intrusive**: Transparent backgrounds don't block the 3D view
5. **Real-time Updates**: Props are updated at 30 FPS from the game engine

## Usage in GameView

```vue
<div class="game-container">
  <!-- 3D Canvas (background layer) -->
  <canvas ref="canvasRef" class="game-canvas"></canvas>

  <!-- UI Overlay (foreground layer) -->
  <ControlsDisplay />
  <SpeedIndicator :currentSpeed="speed" :maxSpeed="maxSpeed" />
  <ThrottleIndicator :throttle="throttle" />
  <OrientationIndicator :pitch="pitch" :roll="roll" :yaw="yaw" />
</div>
```

The game container uses relative positioning, canvas is absolute (background), and UI components are fixed (overlay).
