import argparse, io, json, sys, os
from urllib.request import urlopen, Request
from PIL import Image
import torch, torch.nn as nn
import torchvision.models as models

# Silence torch/hf progress on stdout
os.environ.setdefault("TORCH_HOME", os.path.join(os.path.expanduser("~"), ".cache", "torch"))
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
torch.hub._hub_dir = os.environ["TORCH_HOME"]  # type: ignore[attr-defined]
torch.hub._validate_not_a_forked_repo = lambda *a, **k: None  # type: ignore[attr-defined]

def log(*args):
    print(*args, file=sys.stderr, flush=True)

def load_url(u: str) -> Image.Image:
    req = Request(u, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(req, timeout=15) as r:
        data = r.read()
    return Image.open(io.BytesIO(data)).convert("RGB")

def load_path(p: str) -> Image.Image:
    return Image.open(p).convert("RGB")

@torch.no_grad()
def embed(img: Image.Image):
    # Load once per process; relies on OS file caching for speed
    weights = models.ResNet50_Weights.DEFAULT
    model = models.resnet50(weights=weights)
    # Remove classifier head -> global pooled features
    model = nn.Sequential(*(list(model.children())[:-1]))
    model.eval()
    x = weights.transforms()(img).unsqueeze(0)
    f = model(x)
    f = torch.flatten(f, 1)
    f = torch.nn.functional.normalize(f, dim=1)
    return f.cpu().numpy()[0].tolist()

def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--url')
    g.add_argument('--path')
    a = ap.parse_args()

    try:
        img = load_url(a.url) if a.url else load_path(a.path)
    except Exception as e:
        log("Image load error:", e)
        print(json.dumps({"error": "image_load_failed", "detail": str(e)}))
        return

    try:
        vec = embed(img)
        # Strictly print JSON array or object to stdout only
        print(json.dumps(vec))
    except Exception as e:
        log("Embed error:", e)
        print(json.dumps({"error": "embed_failed", "detail": str(e)}))

if __name__ == "__main__":
    main()
