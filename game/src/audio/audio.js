// A synthesised soundtrack: engine, siren, gunshots, impacts, pickups and mission stingers, all
// built from oscillators and a noise buffer at run time. No audio files, and every call is safe
// before the first click (browsers start audio only after a gesture).

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let noise = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 52;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 680;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      const sirenFilter = ctx.createBiquadFilter();
      sirenFilter.type = 'bandpass';
      sirenFilter.frequency.value = 900;
      sirenFilter.Q.value = 1.4;
      sirenLfo = ctx.createOscillator();
      sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 190;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenFilter);
      sirenFilter.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function envelope(node, peak, attack, decay) {
    const t = ctx.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(0.0001, t);
    node.gain.linearRampToValueAtTime(peak, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function blip(freq, peak = 0.16, decay = 0.16, type = 'sine', slide = 0) {
    if (!ensure() || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + decay);
    osc.connect(gain);
    gain.connect(master);
    envelope(gain, peak, 0.008, decay);
    osc.start();
    osc.stop(ctx.currentTime + decay + 0.05);
  }

  function burst(peak, decay, cutoff, q = 1) {
    if (!ensure() || muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = q;
    const gain = ctx.createGain();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    envelope(gain, peak, 0.004, decay);
    src.start();
    src.stop(ctx.currentTime + decay + 0.05);
  }

  return {
    start() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    engine(speed, throttle, brake) {
      if (!ensure()) return;
      const target = 0.02 + speed * 0.06 + (throttle ? 0.012 : 0);
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.12);
      engineOsc.frequency.setTargetAtTime(46 + speed * 128 + (brake ? -20 : 0), ctx.currentTime, 0.09);
      engineFilter.frequency.setTargetAtTime(260 + speed * 900, ctx.currentTime, 0.1);
    },
    engineOff() {
      if (engineGain) engineGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
    },
    siren(active, intensity = 1) {
      if (!ensure()) return;
      sirenGain.gain.setTargetAtTime(active ? 0.022 * intensity : 0.0001, ctx.currentTime, 0.25);
    },
    shot(distant = false, volume = 1) {
      burst(distant ? 0.1 : 0.32 * volume, distant ? 0.16 : 0.09, distant ? 700 : 1500, 0.8);
      blip(120, distant ? 0.05 : 0.12, 0.08, 'triangle', -60);
    },
    crash(distant = false) {
      burst(distant ? 0.14 : 0.28, 0.28, 260, 0.6);
      blip(distant ? 60 : 84, 0.2, 0.22, 'triangle', -30);
    },
    pickup() { blip(760, 0.14, 0.1, 'triangle', 260); },
    cash() { blip(880, 0.13, 0.1, 'sine', 220); setTimeout(() => blip(1320, 0.1, 0.12, 'sine'), 70); },
    objective() { blip(620, 0.12, 0.14, 'triangle', 120); },
    mission() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.15, 0.24, 'triangle'), i * 105));
    },
    phone() { blip(480, 0.1, 0.09, 'square'); setTimeout(() => blip(620, 0.1, 0.12, 'square'), 120); },
    exit() { burst(0.08, 0.1, 900, 1); },
    hurt() { blip(150, 0.16, 0.2, 'sawtooth', -60); },
  };
}