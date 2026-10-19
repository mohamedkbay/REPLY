# Reply showcase source

The film uses actual local-demo browser footage, not a simulated interface. It shows theme waves, the layered menu, Arabic-to-English navigation, a product-code reply with its saved image/price, and the phone layout. Captures contain synthetic inventory and no live message delivery. The external inspiration video is not included.

`beats.json` is the chapter timing and caption source. `footage/` contains the five original compressed capture clips. `render.py` adds Cairo captions, the demo disclosure and the existing Reply closing identity using absolute timeline positions. `manifest.json` records sources and checksums.

## Rebuild

Use Python 3, Pillow and FFmpeg/ffprobe. These are optional video-production tools, not application runtime dependencies. Install the pinned Python dependency in your own environment if needed. From the repository root:

```bash
python3 assets/showcase/render.py --from 0 --to 32 --fps 30 --scale 1 --out docs/media
```

For a small range preview:

```bash
python3 assets/showcase/render.py --from 0 --to 2 --fps 12 --scale 0.5 --out work/showcase-preview
```

Generated working files/logs stay in the gitignored `work/showcase-render`. Outputs are a film, GIF and poster. The normal delivery is a 32-second 1920×1080 H.264/yuv420p MP4 at 30 fps, plus a 12-second 960×540 looping GIF. Silence is intentional for README autoplay and distraction-free product motion; no narration or music was requested.

The screenshot UI may retain Arabic merchant text after the interface switches to English: saved product/reply data is deliberately not auto-translated. The film demonstrates locally verified interface behavior, not official platform approval, payment processing or a production launch.
