"use strict";

const $ = (sel) => document.querySelector(sel);

const els = {
  search: $("#search"),
  fileInput: $("#fileInput"),
  folderInput: $("#folderInput"),
  loadFiles: $("#loadFiles"),
  loadFolder: $("#loadFolder"),
  pills: document.querySelectorAll(".pill"),
  trackList: $("#trackList"),
  heroTitle: $("#heroTitle"),
  heroArtist: $("#heroArtist"),
  tBpm: $("#tBpm"),
  tFmt: $("#tFmt"),
  miniTitle: $("#miniTitle"),
  miniArtist: $("#miniArtist"),
  favBtn: $("#favBtn"),
  playBtn: $("#playBtn"),
  prevBtn: $("#prevBtn"),
  nextBtn: $("#nextBtn"),
  shuffleBtn: $("#shuffleBtn"),
  repeatBtn: $("#repeatBtn"),
  muteBtn: $("#muteBtn"),
  seek: $("#seek"),
  volume: $("#volume"),
  timeElapsed: $("#timeElapsed"),
  timeTotal: $("#timeTotal"),
  cover: $("#cover"),
  miniCover: $("#miniCover"),
  spectrum: $("#spectrum"),
};

const audioEl = document.getElementById("audio") || new Audio();
audioEl.preload = "metadata";

// ---------- STATE ----------
const state = {
  tracks: [],
  current: -1,
  playing: false,
  fav: new Set(),
  shuffle: false,
  repeat: "all", // "all" | "one" | "none" (default "all" for continuous playback)
  query: "",
  view: "ALL",
  audio: audioEl,
};

let autoAdvancing = false;

// ---------- CANVAS ART ----------
function drawCover(canvas, title, seed) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const g = ctx.createLinearGradient(0, 0, w, h);
  const hues = [265, 190, 330, 45];
  const hue = hues[Math.abs(seed) % hues.length];
  g.addColorStop(0, `hsl(${hue}, 80%, 16%)`);
  g.addColorStop(1, `hsl(${hue + 40}, 85%, 8%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(168,85,247,0.5)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const x = Math.abs(Math.sin(seed * (i + 1)) * w * 1.5);
    const y = Math.abs(Math.cos(seed * (i + 2)) * h * 2.0);
    ctx.beginPath();
    ctx.arc(x % w, y % h, 30 + (i % 3) * 26, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "bold 22px 'Courier New'";
  ctx.textAlign = "center";
  const lines = title.toUpperCase().split(" ").slice(0, 3);
  lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 - 20 + i * 24));
}

function drawMiniCover(canvas, title, seed) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const hues = [265, 190, 330, 45];
  const hue = hues[Math.abs(seed) % hues.length];
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue}, 80%, 20%)`);
  g.addColorStop(1, `hsl(${hue + 40}, 85%, 10%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "bold 8px 'Courier New'";
  ctx.textAlign = "center";
  ctx.fillText("H", w / 2, h / 2 + 2);
}

function seedOf(str) {
  let s = 0;
  for (let i = 0; i < str.length; i++) s = (s + str.charCodeAt(i) * (i + 7)) % 997;
  return s;
}

// ---------- SPECTRUM VISUALIZER ----------
function animateSpectrum() {
  const canvas = els.spectrum;
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const bars = 18;
  const bw = (w - 20) / bars;
  ctx.clearRect(0, 0, w, h);
  const t = performance.now() / 180;
  for (let i = 0; i < bars; i++) {
    let v = 0.08;
    if (state.playing) {
      const amp = (Math.sin(t + i * 0.4) + Math.cos(t * 1.5 + i * 0.8) + 2) / 4;
      v = Math.max(0.08, Math.min(0.95, amp * (0.7 + Math.random() * 0.3)));
    }
    const bh = v * (h - 8);
    ctx.fillStyle = i % 2 === 0 ? "#a855f7" : "#22d3ee";
    ctx.fillRect(10 + i * bw, h - 4 - bh, bw - 6, bh);
  }
  requestAnimationFrame(animateSpectrum);
}

// ---------- TRACK LIST ----------
function fmtTime(sec) {
  if (!sec || isNaN(sec)) return "00:00";
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderList() {
  els.trackList.innerHTML = "";
  const q = state.query.toLowerCase();
  let tracks = state.tracks;
  if (state.view === "LIKED") tracks = tracks.filter((t) => state.fav.has(t.url));
  if (q) tracks = tracks.filter((t) =>
    t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.album.toLowerCase().includes(q)
  );

  tracks.forEach((t, i) => {
    const originalIndex = state.tracks.indexOf(t);
    const row = document.createElement("div");
    row.className = "track-row" + (originalIndex === state.current ? " active" : "");
    const isNow = originalIndex === state.current;
    const isFav = state.fav.has(t.url);

    const idx = document.createElement("span");
    idx.className = "idx" + (isNow ? " now" : "");
    idx.textContent = isNow && state.playing ? "►" : String(i + 1).padStart(2, "0");

    const cols = document.createElement("div");
    cols.className = "cols";
    const ti = document.createElement("span");
    ti.className = "t-title" + (isNow ? " now" : "");
    ti.textContent = t.title;
    const ar = document.createElement("span");
    ar.className = "t-artist";
    ar.textContent = t.artist;
    cols.appendChild(ti);
    cols.appendChild(ar);

    const alb = document.createElement("span");
    alb.className = "t-album";
    alb.textContent = t.album;

    const acts = document.createElement("div");
    acts.className = "track-actions";

    const heart = document.createElement("button");
    heart.className = "heart" + (isFav ? " fav" : "");
    heart.textContent = isFav ? "\u{1F496}" : "\u{1F90D}";
    heart.title = "Toggle favourite";
    heart.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFav(t.url);
    });

    const dur = document.createElement("span");
    dur.className = "t-time";
    dur.textContent = fmtTime(t.duration);

    acts.appendChild(heart);
    acts.appendChild(dur);

    row.appendChild(idx);
    row.appendChild(cols);
    row.appendChild(alb);
    row.appendChild(acts);
    row.addEventListener("click", () => playIndex(originalIndex));
    els.trackList.appendChild(row);
  });
}

// ---------- PLAYER ----------
async function loadPlaylist() {
  try {
    const res = await fetch("/api/tracks");
    state.tracks = await res.json();
    if (state.tracks.length > 0) {
      state.audio.src = state.tracks[0].url;
    }
    renderList();
    updateHero(-1);
  } catch (err) {
    console.error("Failed to load tracks:", err);
  }
}

function playIndex(i) {
  if (i < 0 || i >= state.tracks.length) return;
  state.current = i;
  const targetUrl = state.tracks[i].url;
  const currentSrc = state.audio.getAttribute("src") || state.audio.src;
  const needsNewSrc = !currentSrc || (!currentSrc.endsWith(targetUrl) && currentSrc !== targetUrl);

  if (needsNewSrc) {
    state.audio.src = targetUrl;
  }
  state.audio.currentTime = 0;

  const p = state.audio.play();
  if (p !== undefined) {
    p.then(() => {
      state.playing = true;
      updatePlayBtn();
      renderList();
    }).catch((err) => {
      console.warn("Audio play blocked or error:", err);
      state.playing = false;
      updatePlayBtn();
      renderList();
    });
  }

  updateHero(i);
  renderList();
  updatePlayBtn();
}

function togglePlay() {
  if (state.tracks.length === 0) return;
  if (state.current === -1) {
    playIndex(0);
    return;
  }

  if (state.audio.paused) {
    const p = state.audio.play();
    if (p !== undefined) {
      p.then(() => {
        state.playing = true;
        updatePlayBtn();
        renderList();
      }).catch((err) => {
        console.warn("Audio play blocked or error:", err);
        state.playing = false;
        updatePlayBtn();
      });
    }
  } else {
    state.audio.pause();
    state.playing = false;
    updatePlayBtn();
    renderList();
  }
}

function getNextIndex() {
  const len = state.tracks.length;
  if (len <= 1) return 0;

  if (state.shuffle) {
    let rand;
    do {
      rand = Math.floor(Math.random() * len);
    } while (rand === state.current);
    return rand;
  }

  if (state.repeat === "one") {
    return state.current >= 0 ? state.current : 0;
  }

  return (state.current + 1) % len;
}

function next(isAuto = false) {
  if (state.tracks.length === 0) return;
  const nextIdx = getNextIndex();
  playIndex(nextIdx);
}

function prev() {
  if (state.tracks.length === 0) return;
  if (state.audio.currentTime > 3.0) {
    state.audio.currentTime = 0;
    state.audio.play().catch(console.warn);
    return;
  }

  const len = state.tracks.length;
  let prevIdx;
  if (state.shuffle && len > 1) {
    do {
      prevIdx = Math.floor(Math.random() * len);
    } while (prevIdx === state.current);
  } else {
    prevIdx = (state.current - 1 + len) % len;
  }
  playIndex(prevIdx);
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  els.shuffleBtn.className = "icon-btn" + (state.shuffle ? " on-cyan" : "");
  els.shuffleBtn.title = state.shuffle ? "Shuffle: ON" : "Shuffle: OFF";
}

function toggleRepeat() {
  const modes = ["all", "one", "none"];
  const nextMode = modes[(modes.indexOf(state.repeat) + 1) % modes.length];
  state.repeat = nextMode;
  updateRepeatBtn();
}

function updateRepeatBtn() {
  if (state.repeat === "one") {
    els.repeatBtn.className = "icon-btn on-pink";
    els.repeatBtn.textContent = "\u{1F502}"; // 🔂
    els.repeatBtn.title = "Repeat: ONE";
  } else if (state.repeat === "all") {
    els.repeatBtn.className = "icon-btn on-pink";
    els.repeatBtn.textContent = "\u{1F501}"; // 🔁
    els.repeatBtn.title = "Repeat: ALL";
  } else {
    els.repeatBtn.className = "icon-btn";
    els.repeatBtn.textContent = "\u{1F501}"; // 🔁
    els.repeatBtn.title = "Repeat: OFF";
  }
}

function toggleFav(url) {
  if (state.fav.has(url)) state.fav.delete(url);
  else state.fav.add(url);
  renderList();
  if (state.current >= 0 && state.tracks[state.current].url === url) {
    els.favBtn.textContent = state.fav.has(url) ? "\u{1F496}" : "\u{1F90D}";
  }
}

function updateHero(i) {
  if (i < 0) {
    els.heroTitle.textContent = "NO_TRACK_PLAYING";
    els.heroArtist.textContent = "LOAD AUDIO TO START";
    els.tBpm.textContent = "[BPM: --]";
    els.tFmt.textContent = "[STEREO --KBPS]";
    els.miniTitle.textContent = "NO_AUDIO_PLAYING";
    els.miniArtist.textContent = "CYBER_DECK_WEB";
    els.timeTotal.textContent = "00:00";
    els.favBtn.textContent = "\u{1F90D}";
    drawCover(els.cover, "AETHER DECK", 7);
    drawMiniCover(els.miniCover, "H", 7);
    return;
  }
  const t = state.tracks[i];
  const seed = seedOf(t.title);
  els.heroTitle.textContent = t.title.toUpperCase();
  els.heroArtist.textContent = t.artist.toUpperCase();
  els.tBpm.textContent = `[BPM: ${t.bpm}]`;
  els.tFmt.textContent = `[${t.genre.toUpperCase()} // 320KBPS]`;
  els.miniTitle.textContent = t.title.toUpperCase();
  els.miniArtist.textContent = t.artist.toUpperCase();
  els.timeTotal.textContent = fmtTime(t.duration);
  els.favBtn.textContent = state.fav.has(t.url) ? "\u{1F496}" : "\u{1F90D}";
  drawCover(els.cover, t.title, seed);
  drawMiniCover(els.miniCover, t.title, seed);
}

function updatePlayBtn() {
  els.playBtn.textContent = state.playing ? "[ \u23F8 PAUSE ]" : "[ \u25B6 PLAY ]";
}

function onTrackEnded() {
  if (autoAdvancing) return;
  autoAdvancing = true;
  setTimeout(() => { autoAdvancing = false; }, 600);

  if (state.repeat === "one") {
    state.audio.currentTime = 0;
    const p = state.audio.play();
    if (p !== undefined) {
      p.catch((err) => console.warn("Repeat playback error:", err));
    }
  } else {
    next(true);
  }
}

// ---------- EVENTS ----------
els.playBtn.addEventListener("click", togglePlay);
els.nextBtn.addEventListener("click", () => next(false));
els.prevBtn.addEventListener("click", prev);
els.repeatBtn.addEventListener("click", toggleRepeat);
els.shuffleBtn.addEventListener("click", toggleShuffle);
els.favBtn.addEventListener("click", () => {
  if (state.current >= 0) toggleFav(state.tracks[state.current].url);
});
els.muteBtn.addEventListener("click", () => {
  state.audio.muted = !state.audio.muted;
  els.muteBtn.textContent = state.audio.muted ? "\u{1F507}" : "\u{1F50A}";
});
els.volume.addEventListener("input", () => {
  state.audio.volume = parseFloat(els.volume.value);
  updateRangeFill(els.volume);
});
els.seek.addEventListener("input", () => {
  const d = state.audio.duration || 0;
  if (d > 0) state.audio.currentTime = (els.seek.value / 1000) * d;
  updateRangeFill(els.seek);
});
els.search.addEventListener("keyup", () => {
  state.query = els.search.value;
  renderList();
});
els.pills.forEach((p) =>
  p.addEventListener("click", () => {
    els.pills.forEach((x) => x.classList.remove("active"));
    p.classList.add("active");
    state.view = p.dataset.view;
    renderList();
  })
);

els.loadFiles.addEventListener("click", () => els.fileInput.click());
els.loadFolder.addEventListener("click", () => els.folderInput.click());
els.fileInput.addEventListener("change", () => {
  addFiles([...els.fileInput.files]);
  els.fileInput.value = "";
});
els.folderInput.addEventListener("change", () => {
  addFiles([...els.folderInput.files].filter((f) => f.type.startsWith("audio/")));
  els.folderInput.value = "";
});

function addFiles(fileList) {
  fileList.forEach((f) => {
    const url = URL.createObjectURL(f);
    state.tracks.push({
      title: f.name.replace(/\.(mp3|wav|ogg|flac|m4a|aac)$/i, ""),
      artist: "LOCAL_UPLOAD",
      album: "CYBER_DECK_V2",
      genre: "LOCAL",
      bpm: 124,
      duration: 0,
      url,
    });
  });
  if (state.current === -1 && state.tracks.length > 0) {
    state.audio.src = state.tracks[0].url;
  }
  renderList();
}

state.audio.addEventListener("play", () => { state.playing = true; updatePlayBtn(); renderList(); });
state.audio.addEventListener("pause", () => { state.playing = false; updatePlayBtn(); renderList(); });
state.audio.addEventListener("ended", onTrackEnded);
state.audio.addEventListener("timeupdate", () => {
  const d = state.audio.duration || 0;
  if (d > 0) {
    els.seek.value = (state.audio.currentTime / d) * 1000;
    updateRangeFill(els.seek);
    // Safety check for auto-advance if ended event is missed
    if (state.audio.currentTime >= d - 0.25 && state.playing && !autoAdvancing) {
      onTrackEnded();
    }
  }
  els.timeElapsed.textContent = fmtTime(state.audio.currentTime);
  els.timeTotal.textContent = fmtTime(state.audio.duration);
});

function updateRangeFill(el) {
  const min = parseFloat(el.min), max = parseFloat(el.max);
  const v = parseFloat(el.value);
  const pct = ((v - min) / (max - min)) * 100;
  el.style.setProperty("--fill", `${pct}%`);
}

// ---------- INIT ----------
updateRangeFill(els.seek);
updateRangeFill(els.volume);
updateRepeatBtn();
loadPlaylist();
animateSpectrum();
