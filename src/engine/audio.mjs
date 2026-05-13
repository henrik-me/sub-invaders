function createDefaultAudio(src) {
  const AudioCtor = globalThis.Audio;
  return typeof AudioCtor === 'function' ? new AudioCtor(src) : null;
}

function normalizePoolSize(poolSize) {
  return Number.isFinite(poolSize) ? Math.max(0, Math.floor(poolSize)) : 0;
}

export function createAudioPool(opts = {}) {
  const audioFactory = opts.audioFactory ?? createDefaultAudio;
  const pools = new Map();
  let muted = false;

  function register(name, src, poolSize = 4) {
    const size = normalizePoolSize(poolSize);
    const entries = [];

    for (let index = 0; index < size; index += 1) {
      let audio = null;

      try {
        audio = audioFactory(src);
      } catch {
        audio = null;
      }

      if (audio) {
        audio.muted = muted;
        entries.push(audio);
      }
    }

    pools.set(name, { entries, nextIndex: 0 });
  }

  function play(name) {
    const pool = pools.get(name);
    if (!pool || pool.entries.length === 0) {
      return;
    }

    const audio = pool.entries[pool.nextIndex];
    pool.nextIndex = (pool.nextIndex + 1) % pool.entries.length;

    if (!audio || typeof audio.play !== 'function') {
      return;
    }

    try {
      if ('currentTime' in audio) {
        audio.currentTime = 0;
      }

      const result = audio.play();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
    } catch {
      // Audio playback can be blocked by browser policy; keep SFX optional.
    }
  }

  function setMuted(value) {
    muted = Boolean(value);

    for (const pool of pools.values()) {
      for (const audio of pool.entries) {
        if (audio) {
          audio.muted = muted;
        }
      }
    }
  }

  return Object.freeze({ register, play, setMuted });
}
