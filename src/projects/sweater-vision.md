---
title: sweater vision
summary: Show it a photo of a knit and it tells you what it is and how it's made, then finds Ravelry patterns like it.
status: live
materials: ["PyTorch", "CLIP", "Hugging Face", "patience"]
link: https://unraveled.danaadylova.com/#photo
linkLabel: try it with a photo ↗
order: 3
---
You see a sweater — in a shop, on a stranger, in a movie — and you want to knit it. Reverse-engineering the pattern by eye is a dark art. sweater vision is my attempt to teach a model that art: photo in, likely patterns out.

It now lives inside [[unraveled-makes|unraveled makes]] as <mark>find by photo</mark>. Upload a picture of a knit and the model reads seven things off it: what kind of item it is, how it's constructed (raglan, yoke, set-in sleeves…), the neckline, sleeves, fit, yarn weight, and stitch patterns like cables or lace, each with how sure it is. Then it searches Ravelry for patterns with the same features, using only the guesses it's fairly sure of, most popular first. Each feature shows up as a little tag above the results, so if it guessed wrong (say, it saw cables that aren't there) you can remove that tag and the search updates.

Under the hood it's an open-source CLIP model that I fine-tuned to read knitwear. It gets the item type right about four times out of five. Fit is still close to a coin toss, so that one stays out of the search. Photos aren't kept unless you tick the box to share yours to help improve the model.
