---
title: know me in books
date: 2026-09-29
topic: books
templateEngineOverride: njk,md
---
These are some of my most favorite series and books - some of them I reread every couple of years.

{% favorite "1885 14935 50398" %}
**Anything by Jane Austen**

- There is a special place in my heart for *Pride and Prejudice* and *Sense and Sensibility*
{% endfavorite %}

{% favorite "3 15881 6 2 1 136251" %}
**Harry Potter series**

- Has been a comfort read for me for years. It is also incredibly interesting for me to explore all the fanfiction written about it - some of it as good as the original novels (and some has even been traditionally published)
{% endfavorite %}

{% favorite "68428 68429 2767793 10803121 16065004 18739426 23947089" %}
**Cosmere novels by Brandon Sanderson**

- Favorite is *Mistborn*, all 7 of them
- Incredible hard magic system, and Brandon Sanderson is one of the few authors that can write a complicated and believable female protagonist (side eyeing the Haruki Murakami novels at my shelf)
{% endfavorite %}

{% favorite "52085140 48677941 55138117 56553921 59041700 63027990 185965151 221735399" %}
***The Unselected Journals of Emma M. Lion* series, Beth Brower**

- If you love Jane Austen and want more of her + some class A yearning.
{% endfavorite %}

{% favorite "39988431 52166786 60133986" %}
**The Daevabad Trilogy: *The Kingdom of Copper*, *The Empire of Gold* and *The River of Silver*, S.A. Chakraborty**

- This was heartbreakingly beautiful
{% endfavorite %}

{% favorite "43587154 41716919 51057191" %}
**Jade War trilogy, Fonda Lee**

- Martial arts movies and godfather - amazing combo.
{% endfavorite %}

{% favorite "56791389 56377548 57001971 57905101 60233239 125887685 216017751 228928465" %}
***Dungeon Crawler Carl* series, Matt Dinniman**

- Anarchy and chaos! If you love absurdist humor and games.
{% endfavorite %}

<p class="card-links">bookish journey, year by year:
{%- for y in books.cardYears | reverse %} <a href="/books/{{ y }}/">{{ y }}</a>{% if not loop.last %} ·{% endif %}{% endfor %}
</p>
