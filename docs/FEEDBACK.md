# Feedback queue — read by the night engineer

Two ways feedback gets here:

1. **Tell Vivy in chat** ("I have feedback: the donut is confusing") — she saves a
   `feedback` event in the database. The night agent queries these when it has DB
   access (`select title, payload from events where type = 'feedback' and
   processed = false`).
2. **Write it below** — this file is the fallback queue the night agent always
   reads. One line per item; it ticks the box in its PR when handled.

## Queue

- [ ] *(empty — add items as `- [ ] description`)*
