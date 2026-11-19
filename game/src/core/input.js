// Keyboard and mouse, read once a frame. Keys are tracked by physical code so the layout does not
// matter; one-shot actions (Enter, Escape, E, Space) are queued and taken by the game loop.

const ONE_SHOT = {
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Escape: 'pause',
  KeyE: 'use',
  Space: 'space',
  KeyR: 'radio',
  KeyM: 'map',
  KeyF: 'fire',
};

export function createInput(canvas) {
  const keys = new Set();
  const queued = [];
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const input = { keys, mouse, queued };

  window.addEventListener('keydown', (event) => {
    if (!keys.has(event.code)) queued.push(ONE_SHOT[event.code] ?? event.code);
    keys.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  function setMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  canvas.addEventListener('mousemove', setMouse);
  canvas.addEventListener('mousedown', (event) => {
    setMouse(event);
    mouse.down = true;
    mouse.clicked = true;
    queued.push('click');
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  input.held = (code) => keys.has(code);
  input.forward = () => keys.has('KeyW') || keys.has('ArrowUp');
  input.back = () => keys.has('KeyS') || keys.has('ArrowDown');
  input.left = () => keys.has('KeyA') || keys.has('ArrowLeft');
  input.right = () => keys.has('KeyD') || keys.has('ArrowRight');
  input.sprint = () => keys.has('ShiftLeft') || keys.has('ShiftRight');
  input.handbrake = () => keys.has('Space');
  input.fire = () => mouse.down || keys.has('KeyJ') || keys.has('KeyF');
  input.take = () => queued.splice(0, queued.length);
  input.clearQueue = () => queued.splice(0, queued.length);
  input.setShotMouse = (x, y) => { mouse.x = x; mouse.y = y; };
  return input;
}

/** A silent input for staged screenshots and for the menus: nothing held, nothing queued. */
export function createNullInput() {
  return {
    keys: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    queued: [],
    held: () => false,
    forward: () => false,
    back: () => false,
    left: () => false,
    right: () => false,
    sprint: () => false,
    handbrake: () => false,
    fire: () => false,
    take: () => [],
    clearQueue: () => {},
    setShotMouse: () => {},
  };
}