---
title: sweater vision
summary: Teaching a model to look at a garment photo and find the knitting pattern for it.
status: in progress
materials: ["PyTorch", "Ravelry data", "patience"]
---
You see a sweater — in a shop, on a stranger, in a movie — and you want to knit it. Reverse-engineering the pattern by eye is a dark art. sweater vision is my attempt to teach a model that art: photo in, likely patterns out.

It's trained on Ravelry project photos, where knitters have already labeled millions of finished garments with the exact pattern they used. Once it works, it plugs straight into [[unraveled-makes]].
