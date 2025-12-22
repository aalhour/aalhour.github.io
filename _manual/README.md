# Blog Manual

## Converting Images to WebP

Use `cwebp` to convert PNG/JPG images to WebP with compression:

```bash
cwebp -q 25 input.png -o output.webp
```

### Quality Guidelines

| Quality | Use Case | Approx Size Reduction |
|---------|----------|----------------------|
| 80 | High quality, large hero images | ~10x |
| 50 | Good balance for blog images | ~20x |
| 35 | Smaller file, still decent quality | ~30x |
| 30 | Good compression | ~30-35x |
| 25 | **Recommended** - best balance | ~35-40x |

### Example

```bash
# Convert a post image
cwebp -q 25 assets/images/posts/my-image.png -o assets/images/posts/my-image.webp
```

### Installing cwebp

```bash
# macOS
brew install webp

# Ubuntu/Debian
sudo apt install webp
```

### In Post Front Matter

```yaml
image: /assets/images/posts/my-image.webp
```

