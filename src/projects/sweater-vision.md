---
title: sweater vision
summary: Show it a photo of a knit and it tells you what it is and how it's made, then finds Ravelry patterns like it.
status: live
materials: ["PyTorch", "CLIP", "Ravelry data", "Hugging Face", "patience"]
link: https://unraveled.danaadylova.com/#photo
linkLabel: try it with a photo ↗
order: 3
---
You see a sweater — in a shop, on a stranger, in a movie — and you want to knit it. Reverse-engineering the pattern by eye is a dark art. sweater vision is my attempt to teach a model that art: photo in, likely patterns out.

It now lives inside [[unraveled-makes|unraveled makes]] as <mark>find by photo</mark>. Upload a picture of a knit and the model reads seven things off it: what kind of item it is, how it's constructed (raglan, yoke, set-in sleeves…), the neckline, sleeves, fit, yarn weight, and stitch patterns like cables or lace, each with how sure it is. The answers it's confident about become a Ravelry search, most popular patterns first, and you can switch any of them off.

Under the hood it's a CLIP model I fine-tuned on more than 220,000 Ravelry pattern photos (designers have already tagged each pattern with its construction, neckline, yarn and so on), plus a slice of knitters' own project photos so it copes with real-life pictures, not just styled ones. It gets the item type right about four times out of five. Fit is still close to a coin toss, so that one stays out of the search. Your photos are never stored.
