/**
 * The "LF" mark — extracted directly from the client-provided `LULWAH.pdf`/
 * `LULWAH.ai`, not redrawn or approximated. Both files draw this monogram
 * as three real vector fills (an overlapping serif "L" and "F"), which this
 * component reproduces path-for-path: the PDF's own FlateDecode content
 * stream was inflated and its `m`/`l`/`c`/`h` path operators converted
 * straight to SVG path commands (PDF's bottom-left-origin Y flipped to
 * SVG's top-left-origin), with no manual tracing or re-interpretation.
 *
 * `currentColor`, not a hardcoded fill — `Header.tsx` sets `plum` for the
 * solid-header state and white for the transparent-over-hero state (the
 * same colour switch the old raster logo needed a `brightness-0`/`invert`
 * CSS filter hack to achieve, because that PNG's own pixels were too
 * pale to recolour any other way — a real vector mark doesn't need that:
 * it has no colour of its own until something paints it).
 *
 * Viewbox is a tight crop of the monogram's own bounding box (not the
 * source PDF's full 360×360 page), so this scales cleanly from a 24px
 * favicon-sized use up to a large lockup with no wasted canvas.
 */
export function LulwahMonogram({ className }: { className?: string }) {
  return (
    <svg viewBox="148.464 78.264 60.598 94.611" className={className} fill="currentColor" aria-hidden="true">
      <path d="M 151.464 141.677 C 158.332 139.491 158.820 138.843 158.819 131.486 C 158.818 117.849 158.796 104.212 158.831 90.575 C 158.849 83.871 158.028 82.803 151.522 81.264 L 174.453 81.264 C 174.473 81.389 174.494 81.513 174.515 81.638 C 173.825 81.740 173.134 81.842 172.444 81.946 C 168.937 82.479 167.414 83.771 167.280 87.330 C 167.014 94.442 166.992 101.565 167.004 108.684 C 167.018 117.539 167.082 126.397 167.303 135.249 C 167.387 138.575 168.710 139.685 172.051 139.821 C 175.087 139.944 177.740 140.207 180.743 139.890 C 182.890 139.663 184.160 140.862 186.255 140.170 C 187.470 141.300 188.337 140.797 189.624 140.333 C 189.391 142.302 189.969 140.159 189.789 141.677 Z" />
      <path d="M 185.087 139.608 C 192.787 141.239 196.500 139.475 199.653 132.518 L 199.653 149.207 C 196.979 140.542 192.971 141.517 185.249 141.969 C 185.101 142.683 185.258 154.946 185.070 155.844 C 183.066 155.844 180.796 155.317 178.462 155.317 C 178.462 154.031 178.463 141.770 178.462 140.501 C 178.461 134.163 178.468 127.825 178.455 121.487 C 178.444 115.917 178.129 115.517 172.924 113.938 L 206.062 113.938 L 206.062 124.662 C 205.884 124.497 205.628 124.377 205.600 124.216 C 204.616 118.622 201.466 115.582 195.878 115.161 C 192.941 114.940 189.974 114.962 187.029 115.089 C 186.362 115.119 185.179 116.036 185.170 116.559 C 185.049 124.261 185.087 131.965 185.087 139.608 Z" />
      <path d="M 191.391 169.875 L 172.210 169.875 C 172.180 169.763 172.149 169.650 172.119 169.538 C 172.602 169.362 173.073 169.118 173.572 169.022 C 177.217 168.320 178.322 167.188 178.412 163.465 C 178.520 158.968 178.437 154.466 178.437 149.750 L 185.072 149.750 C 185.072 152.968 185.068 156.236 185.074 159.504 C 185.077 160.891 185.051 162.280 185.124 163.663 C 185.320 167.357 186.212 168.331 189.833 168.965 C 190.384 169.061 190.922 169.230 191.465 169.366 C 191.441 169.536 191.416 169.706 191.391 169.875 Z" />
    </svg>
  );
}
