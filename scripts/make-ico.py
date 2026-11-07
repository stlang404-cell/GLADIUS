# Multi-size Windows .ico (16–256 px) from the brand rasters.
from PIL import Image
src = {16: 'public/brand/favicon-16.png', 32: 'public/brand/favicon-32.png', 48: 'public/brand/favicon-48.png', 256: 'public/brand/favicon-256.png'}
imgs = [Image.open(src[s]).convert('RGBA') for s in sorted(src)]
imgs[-1].save('public/brand/gladius.ico', sizes=[(s, s) for s in sorted(src)], append_images=imgs[:-1])
imgs[1].save('public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)], append_images=[imgs[0], imgs[2]])
print('ico written')
