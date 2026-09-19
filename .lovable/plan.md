# Reference-Matched Step-Line Price Chart

## Goal
Match the reference’s restrained step-line rendering while preserving OLPA’s live contract data and existing chart controls.

## Changes
- Render the price path as a thin, unsmoothed step line with crisp horizontal and vertical moves.
- Give the plot a clean dark background, subtle axes, minimal grid treatment, and balanced top/bottom breathing room.
- Start the visible series near the lower-left of the plotting area while retaining a price scale that responds to live values.
- Keep the timeline horizontally scrollable as history grows and preserve the current 15px minimum / 100px maximum plot height.
- Retain the small `[H]` and `[A]` event annotations above the exact repricing steps.
- Keep OLPA’s existing chart header, live price, OHLC values, contract label, and team labels; do not add the reference’s Account Value/PNL tabs or 24h selector.

## Verification
- Run the live simulation and confirm new values produce crisp step segments without smoothing.
- Confirm event annotations remain aligned with their repricing points.
- Check horizontal scrolling and chart framing at mobile and desktop widths.
