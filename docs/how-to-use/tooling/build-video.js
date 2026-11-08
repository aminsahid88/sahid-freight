// Builds the narrated how-to video: frames (Playwright-rendered HTML) + macOS speech + ffmpeg.
// Usage: node build-video.js <imgDir> <outDir> [voice] [rate]
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const pw = require("/Users/aminabdirahman/profix/node_modules/playwright-core");

const [IMG, OUT, VOICE = "Samantha", RATE = "172"] = process.argv.slice(2);
const scenes = JSON.parse(fs.readFileSync(path.join(__dirname, "scenes.json"), "utf8"));
const FRAMES = path.join(OUT, "frames");
const AUDIO = path.join(OUT, "audio");
const CLIPS = path.join(OUT, "clips");
for (const d of [FRAMES, AUDIO, CLIPS]) fs.mkdirSync(d, { recursive: true });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const template = fs.readFileSync(path.join(__dirname, "frame.html"), "utf8");

function frameHtml(scene, index, total) {
  const step = `${String(index).padStart(2, "0")} / ${String(total - 1).padStart(2, "0")}`;
  if (scene.type === "title") {
    const bullets = (scene.bullets || []).map((b) => `<li>${esc(b)}</li>`).join("");
    return template
      .replace("{{BODY}}", `<section class="title"><div class="brand">Sahid Freight · Back office</div><h1>${esc(scene.title)}</h1><p class="sub">${esc(scene.subtitle || "")}</p>${bullets ? `<ul>${bullets}</ul>` : ""}</section>`)
      .replace("{{FOOTER}}", "");
  }
  const src = "data:image/png;base64," + fs.readFileSync(path.join(IMG, scene.image)).toString("base64"); // inline: a blank page cannot load file:// images
  return template
    .replace("{{BODY}}", `<section class="screen"><img src="${src}" alt=""></section>`)
    .replace("{{FOOTER}}", `<footer><div class="chapter">${esc(scene.chapter)}</div><div class="caption">${esc(scene.caption)}</div><div class="step">${step}</div></footer>`);
}

function duration(file) {
  return parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString());
}

(async () => {
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const list = [];
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const frame = path.join(FRAMES, `${sc.id}.png`);
    await page.setContent(frameHtml(sc, i, scenes.length), { waitUntil: "load" });
    await page.waitForTimeout(150);
    await page.screenshot({ path: frame });

    const aiff = path.join(AUDIO, `${sc.id}.aiff`);
    const m4a = path.join(AUDIO, `${sc.id}.m4a`);
    // Spoken pacing: a breath after each sentence and a short pause after colons/semicolons reads less like a machine.
    const spoken = sc.narration.replace(/([.!?])\s+/g, "$1 [[slnc 380]] ").replace(/([:;])\s+/g, "$1 [[slnc 220]] ");
    execFileSync("say", ["-v", VOICE, "-r", RATE, "-o", aiff, "[[slnc 250]] " + spoken]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", aiff, "-af", "afftdn=nf=-30,loudnorm=I=-16:TP=-1.5:LRA=11,apad=pad_dur=0.9", "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "160k", m4a]);
    const dur = duration(m4a);

    const clip = path.join(CLIPS, `${sc.id}.mp4`);
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-loop", "1", "-framerate", "30", "-t", dur.toFixed(3), "-i", frame,
      "-i", m4a,
      "-vf", `fade=t=in:st=0:d=0.35,fade=t=out:st=${Math.max(0, dur - 0.35).toFixed(3)}:d=0.35,format=yuv420p`,
      "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", "30",
      "-c:a", "aac", "-b:a", "160k", "-shortest", clip,
    ]);
    list.push(clip);
    console.log(`scene ${sc.id} ${dur.toFixed(1)}s`);
  }
  await browser.close();

  const concat = path.join(OUT, "concat.txt");
  fs.writeFileSync(concat, list.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  const final = path.join(OUT, "how-to-use.mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", "-movflags", "+faststart", final]);
  console.log("video", final, duration(final).toFixed(1) + "s");

  // Narration script as markdown, straight from the scenes so it always matches the audio.
  const md = ["# How to use — narration script", "", `Voice: ${VOICE} (macOS), ${RATE} words per minute. One section per scene; the on-screen caption is in italics.`, ""];
  scenes.forEach((sc, i) => {
    md.push(`## ${i}. ${sc.type === "title" ? sc.title : sc.chapter}`);
    if (sc.type === "screen") md.push("", `*${sc.caption}* — screen: \`img/${sc.image}\``);
    else if (sc.bullets && sc.bullets.length) md.push("", ...sc.bullets.map((b) => `- ${b}`));
    md.push("", sc.narration, "");
  });
  fs.writeFileSync(path.join(OUT, "narration.md"), md.join("\n"));
})().catch((e) => { console.error(e); process.exit(1); });
