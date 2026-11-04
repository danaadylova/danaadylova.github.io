---
title: deploy safety gate
summary: I change how an AI model runs, then check if it got less safe.
status: in progress
materials: ["Python", "Ollama", "XSTest", "StrongREJECT", "pytest"]
link: https://github.com/danaadylova/deploy-safety-gate
linkLabel: see the code ↗
order: 0
---
The same AI model can act differently depending on how it's set up. Remove its chat formatting, give it the wrong formatting, or compress it, and its answers can change. At work I shipped changes to big systems with staged rollouts and checks. I wanted the same thing for AI models: <mark>a check you run before release</mark> that tells you if a change made the model less safe.

Here's how it works. I ask a small model a fixed set of questions. Some are harmful requests it should refuse. Others are harmless questions it should answer. Then I change one thing about the setup and ask again. A second model grades every answer, and I check its grading by hand. On my first 30 answers, it agreed with me 29 times.

The check gives one of four results: <mark>PASS</mark>, <mark>FAIL</mark>, <mark>INCONCLUSIVE</mark> or <mark>INCOMPLETE</mark>. It only says PASS when the numbers are clear. If the test is too small to tell, it says so. I also tested the check on made-up data, so I know how often it gets fooled.

The code works and has tests. I'm running the main study this month and will write up what I find, even if the answer is "nothing changed."
