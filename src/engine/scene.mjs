function callScene(scene, method, args = []) {
  const fn = scene?.[method];
  return typeof fn === 'function' ? fn.apply(scene, args) : undefined;
}

export function createSceneStack() {
  const scenes = [];

  function current() {
    return scenes.at(-1);
  }

  function push(scene) {
    scenes.push(scene);
    callScene(scene, 'enter');
    return scene;
  }

  function pop() {
    const scene = scenes.pop();
    callScene(scene, 'exit');
    return scene;
  }

  function replace(scene) {
    pop();
    return push(scene);
  }

  function update(dt) {
    return callScene(current(), 'update', [dt]);
  }

  function render(renderer) {
    return callScene(current(), 'render', [renderer]);
  }

  function handleInput(input) {
    return callScene(current(), 'handleInput', [input]);
  }

  function size() {
    return scenes.length;
  }

  return {
    push,
    pop,
    replace,
    current,
    update,
    render,
    handleInput,
    size,
  };
}
