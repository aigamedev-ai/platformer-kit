#!/usr/bin/env python3
"""comfy_bg.py: make one background layer with a local ComfyUI (FLUX.2-klein text-to-image) and pixelize it to a
background ramp. Standard library only. Backgrounds and organic scenery only: never the play layer.

    python3 comfy_bg.py "a calm night sky over a sea of clouds, distant ruined towers" --name far --seed 1 \\
        --palette N --ramps bg,cloud --out art/bg [--method mean --dither] [--key] [--size 400x240]

Writes OUT/<name>_raw.png (the model's image) and OUT/<name>.png (pixelized, 1 px = 1 art px; draw it at 2x),
plus OUT/<name>_2x.png for checking. Exit code 2 = ComfyUI isn't running, 3 = the model isn't installed: then draw
the background procedurally (pixel.py procbg) and say so.

--colours bg0,bg1,bg2,cloud1   exact shades instead of whole ramps (keep backgrounds dark and low contrast).
--method mode (default) keeps crisp shapes; --method mean --dither suits smooth skies (mode bands them).
--key   generate shapes on flat magenta and cut them out (transparent background): for a mid layer of separate
        silhouettes (floating islands, far ruins) that you place yourself.
--raw   send the prompt as is (no style template).
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request, uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixel import Palette, pixelize, read_png, write_png

STYLE = ('Pixel art video game background layer, side view, wide 16-bit era scenery. Flat colours, large simple '
         'shapes, clean edges, soft low contrast, no characters, no people, no text, no frame, no border, no UI. ')
KEY = (' Each shape is a solid dark silhouette isolated on a flat pure magenta (#ff00ff) background, '
       'with clear magenta space between the shapes and around the edges.')


def get(host, path, timeout=5):
    with urllib.request.urlopen(f'http://{host}{path}', timeout=timeout) as r:
        return r.read()


def post(host, path, body):
    req = urllib.request.Request(f'http://{host}{path}', json.dumps(body).encode(), {'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f'ComfyUI refused the graph ({e.code}): {e.read().decode()[:800]}')


def graph(prompt, seed, w, h, model, prefix):
    """FLUX.2-klein: distilled, so 4 steps, cfg 1.0, and negative prompts do nothing."""
    return {
        '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': model, 'weight_dtype': 'default'}},
        '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_4b.safetensors', 'type': 'flux2', 'device': 'default'}},
        '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'flux2-vae.safetensors'}},
        '4': {'class_type': 'CLIPTextEncode', 'inputs': {'text': prompt, 'clip': ['2', 0]}},
        '5': {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['4', 0]}},
        '6': {'class_type': 'CFGGuider', 'inputs': {'model': ['1', 0], 'positive': ['4', 0], 'negative': ['5', 0], 'cfg': 1.0}},
        '7': {'class_type': 'KSamplerSelect', 'inputs': {'sampler_name': 'euler'}},
        '8': {'class_type': 'Flux2Scheduler', 'inputs': {'steps': 4, 'width': w, 'height': h}},
        '9': {'class_type': 'EmptyFlux2LatentImage', 'inputs': {'width': w, 'height': h, 'batch_size': 1}},
        '10': {'class_type': 'RandomNoise', 'inputs': {'noise_seed': seed}},
        '11': {'class_type': 'SamplerCustomAdvanced', 'inputs': {'noise': ['10', 0], 'guider': ['6', 0], 'sampler': ['7', 0],
                                                                 'sigmas': ['8', 0], 'latent_image': ['9', 0]}},
        '12': {'class_type': 'VAEDecode', 'inputs': {'samples': ['11', 0], 'vae': ['3', 0]}},
        '13': {'class_type': 'SaveImage', 'inputs': {'filename_prefix': prefix, 'images': ['12', 0]}},
    }


def main(a):
    if not a or a[0] in ('-h', '--help'):
        print(__doc__); return 0
    opt = lambda k, d=None: a[a.index('--' + k) + 1] if '--' + k in a else d
    text = a[0]
    host = opt('host', '127.0.0.1:8188')
    name, seed, out = opt('name', 'bg'), int(opt('seed', 1)), opt('out', '.')
    gw, gh = (int(v) for v in opt('gen', '1280x768').split('x'))         # ~1 MP, multiples of 16
    w, h = (int(v) for v in opt('size', '400x240').split('x'))
    model = opt('model', 'flux-2-klein-4b.safetensors')
    key = '--key' in a

    # 1. is ComfyUI there, with the model?
    try:
        json.loads(get(host, '/system_stats', 3))
    except Exception as e:
        print(f'ComfyUI is not running at {host} ({e.__class__.__name__}). Start it, or draw this background '
              f'procedurally (python3 pixel.py procbg ...) and tell the user no image model was used.')
        return 2
    try:
        info = json.loads(get(host, '/object_info/UNETLoader', 10))
        have = info['UNETLoader']['input']['required']['unet_name'][0]
    except Exception:
        have = []
    if have and model not in have:
        print(f'{model} is not installed in ComfyUI. Diffusion models found: {", ".join(have) or "none"}. '
              f'Pass --model <file> to use another FLUX.2 model, or draw the background procedurally.')
        return 3

    # 2. generate
    prompt = text if '--raw' in a else STYLE + text + (KEY if key else '')
    prefix = f'pixelart_{name}_{seed}'
    r = post(host, '/prompt', {'prompt': graph(prompt, seed, gw, gh, model, prefix), 'client_id': str(uuid.uuid4())})
    if r.get('node_errors'):
        raise SystemExit(f'graph errors: {json.dumps(r["node_errors"])[:800]}')
    pid = r['prompt_id']
    t0 = time.time(); img = None
    while time.time() - t0 < float(opt('timeout', 300)):
        time.sleep(1)
        try:
            hist = json.loads(get(host, f'/history/{pid}', 10)).get(pid)
        except Exception:
            continue                                                       # server busy; try again
        if not hist: continue
        st = hist.get('status', {})
        if st.get('status_str') == 'error':
            raise SystemExit(f'ComfyUI failed: {json.dumps(st.get("messages", []))[-800:]}')
        for node in hist.get('outputs', {}).values():
            for im in node.get('images', []):
                img = im
        if img: break
    if not img:
        raise SystemExit('timed out waiting for ComfyUI (is the queue busy, or did the server run out of memory?)')
    q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img.get('subfolder', ''), 'type': img.get('type', 'output')})
    os.makedirs(out, exist_ok=True)
    raw_path = os.path.join(out, f'{name}_raw.png')
    with open(raw_path, 'wb') as f:
        f.write(get(host, f'/view?{q}', 60))
    print(f'generated {raw_path} in {time.time() - t0:.0f}s (seed {seed})')

    # 3. pixelize to the background ramp
    pal = Palette.load(opt('palette', 'N'))
    ramps = opt('ramps', 'bg')
    names = opt('colours').split(',') if opt('colours') else pal.names(ramps.split(','))
    cols = [pal[n] for n in names]
    KEYC = (255, 0, 255, 255)
    if key: cols = [KEYC] + cols
    sw, sh, src = read_png(raw_path)
    px = pixelize(src, sw, sh, w, h, cols, opt('method', 'mode'), '--dither' in a)
    if key: px = [[(0, 0, 0, 0) if p == KEYC else p for p in row] for row in px]
    path = os.path.join(out, f'{name}.png')
    write_png(path, w, h, px)
    write_png(os.path.join(out, f'{name}_2x.png'), w * 2, h * 2, [[p for p in r for _ in (0, 1)] for r in px for _ in (0, 1)])
    print(f'pixelized -> {path} ({w}x{h}, {len(cols) - key} colours: {",".join(names)})')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
